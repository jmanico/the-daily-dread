import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
import { createTransactionBoundary,TransactionRejection } from '../src/persistence/transactions.js';
import { createApplication,HttpFailure,operationSignal } from '../src/http/application.js';

const statements=Object.freeze({
  authority:'select role, active::text from fixture.principals where company_id=$1 and id=$2',
  read:'select value,revision::text from fixture.records where company_id=$1 and id=$2',
  update:'update fixture.records set value=$4,revision=revision+1 where company_id=$1 and id=$2 and revision=$3::bigint returning revision::text',
  audit:'insert into fixture.audit(company_id,operation_id,revision) values ($1,$2,$3::bigint)',
  work:'insert into fixture.work(company_id,operation_id) values ($1,$2)',
  bad_work:"insert into fixture.work(company_id,operation_id) values ($1,$2 || '_missing')",
  fail:'select 1/0 where $1::text is not null',
  meta:"select pg_backend_pid()::text,current_setting('transaction_isolation'),current_setting('statement_timeout'),current_setting('lock_timeout'),current_setting('synchronous_commit') where $1::text is not null",
  pause:'select pg_sleep($2::double precision) where $1::text is not null',
  all_records:'select id,value from fixture.records where company_id=$1 order by id limit 100',
  turn_off:"update fixture.records set value='off' where company_id=$1 and id=$2",
  rows:'select x::text from generate_series(1,$2::int) x where $1::text is not null',
  output:'select $2::text where $1::text is not null',
  oversized:"select repeat('x',8193) where $1::text is not null",
  total_bytes:"select repeat('x',8192),repeat('y',8192) from generate_series(1,100) where $1::text is not null",
  columns:'select '+Array.from({length:33},()=>'$1::text').join(','),
  exact_integer:'select 9007199254740993::bigint where $1::text is not null',
  delete_audit:'delete from fixture.audit where company_id=$1',
  alter_schema:'create table fixture.forbidden as select $1::text as company_id',
});
/** @param {string} operationId @param {string} [companyId] @param {AbortSignal} [signal] @param {number} [timeoutMs] */
const context=(operationId,companyId='company_a',signal=new AbortController().signal,timeoutMs=3000)=>({companyId,operationId,signal,timeoutMs});
/** @returns {{promise:Promise<void>,resolve:()=>void}} */
function gate(){let resolve=()=>{};const promise=new Promise(r=>{resolve=()=>r(undefined);});return {promise,resolve};}

test('selected PostgreSQL 18.6 transaction and transport boundaries',{timeout:90000},async t=>{
  const fixture=await startPostgres();t.after(()=>fixture.close());
  const admin=postgres({...fixture.config,ssl:{ca:fixture.config.ca,rejectUnauthorized:true},channel_binding:'require',max:2,fetch_types:false,onnotice:false,debug:false});
  t.after(()=>admin.end({timeout:0}));
  assert.equal((await admin`show server_version_num`.raw())[0][0]?.toString(),'180006');
  await admin.unsafe(`create role dread_app login password 'synthetic-app-fixture' nosuperuser nocreatedb nocreaterole noinherit;
    create schema fixture;
    create table fixture.companies(id text primary key);
    create table fixture.principals(company_id text references fixture.companies,id text,role text not null,active boolean not null,primary key(company_id,id));
    create table fixture.records(company_id text references fixture.companies,id text,value varchar(64) not null,revision bigint not null check(revision>0),primary key(company_id,id));
    create table fixture.audit(company_id text references fixture.companies,operation_id text,revision bigint not null,primary key(company_id,operation_id));
    create table fixture.work(company_id text,operation_id text,primary key(company_id,operation_id),foreign key(company_id,operation_id) references fixture.audit);
    grant usage on schema fixture to dread_app;
    grant select on fixture.principals,fixture.records,fixture.audit,fixture.work to dread_app;
    grant update on fixture.records to dread_app;
    grant insert on fixture.audit,fixture.work to dread_app;
    insert into fixture.companies values('company_a'),('company_b'),('company_c');
    insert into fixture.principals values('company_a','admin_a','admin',true),('company_a','reader_a','reader',true),('company_a','revoked_a','admin',false),('company_b','admin_b','admin',true),('company_c','admin_c','admin',true);
    insert into fixture.records values('company_a','item','initial',1),('company_b','item','other-company-secret',1);`).raw();
  const config={...fixture.config,user:'dread_app',password:'synthetic-app-fixture'};
  const boundary=createTransactionBoundary(config,statements);t.after(()=>boundary.close());

  /** A synthetic owner invokes the production transaction boundary. This fixture
   * proves the primitive, not the still-unimplemented product identity owner.
   * @param {string} operation @param {string} actor @param {string} revision @param {string} value @param {boolean} [fail] @param {string} [company] */
  async function mutate(operation,actor,revision,value,fail=false,company='company_a') {
    return boundary.run(context(operation,company),async tx=>{
      const authority=await tx.query('authority',[actor]);
      if(authority[0]?.[0]!=='admin' || authority[0]?.[1]!=='true')throw new TransactionRejection('denied');
      const resource=await tx.query('read',['item']);
      if(resource.length!==1)throw new TransactionRejection('not_found');
      const changed=await tx.query('update',['item',revision,value]);
      if(changed.length!==1)throw new TransactionRejection('conflict');
      if(fail)await tx.query('fail');
      await tx.query('audit',[tx.operationId,changed[0][0]]);
      await tx.query('work',[tx.operationId]);
      return Object.freeze({revision:changed[0][0]});
    });
  }

  await t.test('verified TLS, channel binding, exact decoding and one serializable connection',async()=>{
    const result=await boundary.run(context('metadata'),async tx=>{
      const first=await tx.query('meta');const second=await tx.query('meta');
      assert.deepEqual(second,first);assert.deepEqual(first[0].slice(1),['serializable','2s','1s','on']);
      assert.ok(Object.isFrozen(first) && Object.isFrozen(first[0]));return first[0][0];
    });
    assert.equal(result.kind,'committed');
    const exact=await boundary.run(context('exact_integer'),tx=>tx.query('exact_integer'));
    assert.equal(exact.kind,'committed');assert.deepEqual(exact.value,[['9007199254740993']]);
    for(const value of [null,true,false,Number.MAX_SAFE_INTEGER,'😀','x'.repeat(8192)]) {
      const result=await boundary.run(context('valid_value'),tx=>tx.query('output',[value]));
      assert.equal(result.kind,'committed');assert.deepEqual(result.value,[[value===null?null:String(value)]]);
    }
    const next=await boundary.run(context('next'),async tx=>(await tx.query('meta'))[0][0]);
    assert.equal(next.kind,'committed');assert.notEqual(next.value,result.value);
    const other=await startPostgres(true);
    try{for(const bad of [{...config,password:'wrong-secret'}, {...config,ca:other.config.ca},other.config]) {
      const denied=createTransactionBoundary(bad,statements);let called=false;
      try{assert.equal((await denied.run(context('bad_connection'),async()=>{called=true;})).kind,'unavailable');assert.equal(called,false);}
      finally{await denied.close();}
    }}finally{await other.close();}
  });

  await t.test('company-scoped reads, current authority, revisions and atomic mutation/audit/work',async()=>{
    for(const actor of ['missing','reader_a','revoked_a','admin_b'])assert.equal((await mutate('denied_'+actor,actor,'1','forbidden')).kind,'denied');
    assert.equal((await mutate('missing_resource','admin_c','1','forbidden',false,'company_c')).kind,'not_found');
    assert.equal((await mutate('stale','admin_a','2','forbidden')).kind,'conflict');
    assert.equal((await mutate('success','admin_a','1',"';drop table fixture.records;--")).kind,'committed');
    const records=await admin`select company_id,value,revision::text from fixture.records order by company_id`.raw();
    assert.deepEqual(records.map(row=>row.map(x=>x?.toString())),[['company_a',"';drop table fixture.records;--",'2'],['company_b','other-company-secret','1']]);
    assert.equal((await admin`select count(*)::text from fixture.audit`.raw())[0][0]?.toString(),'1');
    assert.equal((await admin`select count(*)::text from fixture.work`.raw())[0][0]?.toString(),'1');
    assert.equal((await mutate('failure','admin_a','2','must-rollback',true)).kind,'unavailable');
    assert.equal((await mutate('success','admin_a','2','duplicate-operation')).kind,'unavailable');
    assert.equal((await boundary.run(context('work_failure'),async tx=>{
      await tx.query('update',['item','2','must-rollback']);await tx.query('audit',[tx.operationId,'3']);await tx.query('bad_work',[tx.operationId]);
    })).kind,'unavailable');
    assert.equal((await admin`select revision::text from fixture.records where company_id='company_a'`.raw())[0][0]?.toString(),'2');
    assert.equal((await admin`select count(*)::text from fixture.audit`.raw())[0][0]?.toString(),'1');
    assert.equal((await boundary.run(context('no_audit_delete'),tx=>tx.query('delete_audit'))).kind,'unavailable');
    assert.equal((await boundary.run(context('no_migration'),tx=>tx.query('alter_schema'))).kind,'unavailable');
  });

  await t.test('invalid parameters/results or swallowed query errors poison the whole transaction',async()=>{
    let invoked=0;
    /** @type {string[]} */
    const getter=Object.defineProperty([],'0',{get(){invoked++;return 'secret';},enumerable:true});getter.length=1;
    const invalid=[['x'.repeat(8193)],['NUL\0'],['\ud800'],[NaN],[Number.MAX_SAFE_INTEGER+1],[{}],new Array(1),getter,Array(33).fill('x'),Array(9).fill('x'.repeat(8192))];
    for(const values of invalid) {
      const result=await boundary.run(context('invalid'),async tx=>{
        await tx.query('update',['item','2','must-rollback']);
        await tx.query('output',/** @type {string[]} */(values));
      });
      assert.equal(result.kind,'invalid');assert.doesNotMatch(JSON.stringify(result),/must-rollback|NUL|secret/);
    }
    assert.equal(invoked,0);
    assert.equal((await boundary.run(context('unknown_statement'),tx=>tx.query('caller_selected_sql'))).kind,'invalid');
    assert.equal((await boundary.run(context('too_many_rows'),tx=>tx.query('rows',[101]))).kind,'invalid');
    assert.equal((await boundary.run(context('oversized_result'),tx=>tx.query('oversized'))).kind,'invalid');
    assert.equal((await boundary.run(context('total_result_bytes'),tx=>tx.query('total_bytes'))).kind,'invalid');
    assert.equal((await boundary.run(context('result_columns'),tx=>tx.query('columns'))).kind,'invalid');
    assert.equal((await boundary.run(context('parallel_queries'),tx=>Promise.all([tx.query('pause',[0.1]),tx.query('read',['item'])]))).kind,'invalid');
    assert.equal((await boundary.run(context('statement_budget'),async tx=>{for(let i=0;i<101;i++)await tx.query('output',['bounded']);})).kind,'invalid');
    const swallowed=await boundary.run(context('swallowed'),async tx=>{
      await tx.query('update',['item','2','must-rollback']);
      await tx.query('fail').catch(()=>undefined);return 'not success';
    });
    assert.equal(swallowed.kind,'unavailable');
    assert.equal((await admin`select revision::text from fixture.records where company_id='company_a'`.raw())[0][0]?.toString(),'2');
  });

  await t.test('registered HTTP handler enforces access and returns only its scoped projection',async()=>{
    let owners=0;
    const app=createApplication(async request=>request.headers['x-fixture-auth']==='valid'?'allowed':'unauthenticated');
    app.get('/record',{schema:{response:{200:{type:'object',additionalProperties:false,required:['revision'],properties:{revision:{type:'string',pattern:'^[0-9]+$',maxLength:20}}}}}},async request=>{
      owners++;
      const result=await boundary.run(context('http_read','company_a',operationSignal(request)),async tx=>{
        const authority=await tx.query('authority',['admin_a']);
        if(authority[0]?.[1]!=='true')throw new TransactionRejection('denied');
        const row=await tx.query('read',['item']);return {revision:row[0][1]};
      });
      if(result.kind!=='committed')throw new HttpFailure(result.kind==='denied'?403:503);
      return result.value;
    });
    try {
      assert.equal((await app.inject('/record')).statusCode,401);assert.equal(owners,0);
      const reply=await app.inject({url:'/record?company=company_b',headers:{'x-fixture-auth':'valid'}});
      assert.equal(reply.statusCode,200);assert.deepEqual(reply.json(),{revision:'2'});
      assert.doesNotMatch(reply.body,/other-company-secret|fixture|dread_app|drop table/);
      await admin`update fixture.principals set active=false where company_id='company_a' and id='admin_a'`.raw();
      assert.equal((await app.inject({url:'/record',headers:{'x-fixture-auth':'valid'}})).statusCode,403);
    }finally{await app.close();await admin`update fixture.principals set active=true where company_id='company_a' and id='admin_a'`.raw();}
  });

  await t.test('real lock deadline and terminated database connection roll back without leaking errors',async()=>{
    const locked=gate(),release=gate();
    const holder=admin.begin(async tx=>{await tx`update fixture.records set revision=revision where company_id='company_a' and id='item'`.raw();locked.resolve();await release.promise;});
    await locked.promise;
    try {
      const start=performance.now();
      assert.equal((await boundary.run(context('lock_timeout'),tx=>tx.query('update',['item','2','must-rollback']))).kind,'unavailable');
      assert.ok(performance.now()-start<2500);
    }finally{release.resolve();await holder;}
    const result=await boundary.run(context('terminated'),async tx=>{
      await tx.query('update',['item','2','must-rollback']);
      const pid=(await tx.query('meta'))[0][0];
      await admin`select pg_terminate_backend(${pid}::int)`.raw();
      return tx.query('read',['item']);
    });
    assert.equal(result.kind,'unavailable');assert.doesNotMatch(JSON.stringify(result),/must-rollback|fixture|password|terminating connection/);
    assert.equal((await admin`select revision::text from fixture.records where company_id='company_a' and id='item'`.raw())[0][0]?.toString(),'2');
  });

  await t.test('raw results do not generate code even beyond the decoder compilation threshold',async()=>{
    const native=globalThis.Function;let attempts=0;
    globalThis.Function=new Proxy(native,{construct(){attempts++;throw new Error('Code generation prohibited');}});
    try {
      const result=await boundary.run(context('raw_rows'),tx=>tx.query('rows',[100]));
      assert.equal(result.kind,'committed');assert.equal(result.value?.length,100);assert.equal(attempts,0);
    }finally{globalThis.Function=native;}
  });

  await t.test('cancellation fences late owner work, rolls back writes and frees admission',async()=>{
    const started=gate(),release=gate(),late=gate();const abort=new AbortController();
    let lateKind='';
    const pending=boundary.run(context('cancelled','company_a',abort.signal),async tx=>{
      await tx.query('update',['item','2','must-rollback']);started.resolve();await release.promise;
      try{await tx.query('audit',[tx.operationId,'3']);lateKind='forbidden-success';}
      catch{lateKind='fenced';}finally{late.resolve();}
    });
    await started.promise;abort.abort();assert.equal((await pending).kind,'cancelled');
    release.resolve();await late.promise;assert.equal(lateKind,'fenced');
    assert.equal((await admin`select revision::text from fixture.records where company_id='company_a'`.raw())[0][0]?.toString(),'2');
    const startedAt=performance.now();
    const timeout=await boundary.run(context('timeout','company_a',undefined,100),tx=>tx.query('pause',[5]));
    assert.equal(timeout.kind,'cancelled');assert.ok(performance.now()-startedAt<1500);
    assert.equal(boundary.status().active,0);
    assert.equal((await boundary.run(context('recovered'),tx=>tx.query('read',['item']))).kind,'committed');
  });

  await t.test('two admitted transactions, no unbounded queue; shutdown destroys owned connections',async()=>{
    const local=createTransactionBoundary(config,statements);const ready=[gate(),gate()],release=gate();
    const work=ready.map((gate,i)=>local.run(context('slot_'+i),async tx=>{await tx.query('meta');gate.resolve();await release.promise;return tx.query('read',['item']);}));
    await Promise.all(ready.map(x=>x.promise));
    assert.deepEqual(local.status(),{active:2,closed:false});
    assert.equal((await local.run(context('overload'),async()=>{throw Error('must not run');})).kind,'unavailable');
    await local.close();release.resolve();
    const results=await Promise.all(work);assert.ok(results.every(x=>x.kind!=='committed'));
    assert.deepEqual(local.status(),{active:0,closed:true});
  });

  await t.test('serializable write-skew conflict requires a fresh whole-operation decision',async()=>{
    await admin`insert into fixture.records values('company_a','doctor_a','on',1),('company_a','doctor_b','on',1)`.raw();
    const ready=[gate(),gate()],release=gate();let decisions=0;
    /** @param {string} id @param {number} [index] */
    function decision(id,index){return boundary.run(context('shift_'+id),async tx=>{
      decisions++;
      const authority=await tx.query('authority',['admin_a']);assert.equal(authority[0][1],'true');
      const rows=await tx.query('all_records');
      if(index!==undefined){ready[index].resolve();await release.promise;}
      if(rows.filter(x=>x[1]==='on').length<2)throw new TransactionRejection('denied');
      await tx.query('turn_off',[id]);return id;
    });}
    const attempts=[decision('doctor_a',0),decision('doctor_b',1)];
    await Promise.all(ready.map(x=>x.promise));release.resolve();
    const results=await Promise.all(attempts);
    assert.deepEqual(results.map(x=>x.kind).sort(),['committed','retryable']);
    const loser=results[0].kind==='retryable'?'doctor_a':'doctor_b';
    const retry=await decision(loser);assert.equal(retry.kind,'denied');assert.equal(retry.operationId,'shift_'+loser);assert.equal(decisions,3);
    assert.equal((await admin`select count(*)::text from fixture.records where value='on'`.raw())[0][0]?.toString(),'1');
  });

  await t.test('a real deadlock is retryable only after PostgreSQL aborts one whole transaction',async()=>{
    const ready=[gate(),gate()],release=gate();
    const results=[['doctor_a','doctor_b'],['doctor_b','doctor_a']].map((ids,index)=>boundary.run(context('deadlock_'+index),async tx=>{
      await tx.query('turn_off',[ids[0]]);ready[index].resolve();await release.promise;await tx.query('turn_off',[ids[1]]);
    }));
    await Promise.all(ready.map(x=>x.promise));release.resolve();
    assert.deepEqual((await Promise.all(results)).map(x=>x.kind).sort(),['committed','retryable']);
  });

  await t.test('commit acknowledgement loss is unknown, never blindly retryable or false success',async()=>{
    await admin`alter system set synchronous_standby_names='*'`.raw();
    await admin`select pg_reload_conf()`.raw();
    try {
      await delay(100);
      const pending=boundary.run(context('uncertain_commit','company_a',undefined,1000),async tx=>{
        await tx.query('update',['item','2','commit-uncertain']);
        await tx.query('audit',[tx.operationId,'3']);await tx.query('work',[tx.operationId]);
      });
      let waiting=false;
      for(let i=0;i<50;i++) {
        const rows=await admin`select pid from pg_stat_activity where usename='dread_app' and wait_event='SyncRep'`.raw();
        if(rows.length===1){waiting=true;break;}await delay(10);
      }
      assert.equal(waiting,true,'the real COMMIT must reach synchronous replication wait');
      const result=await pending;
      assert.equal(result.kind,'unknown');assert.equal(result.operationId,'uncertain_commit');
      // Release the replication wait before checking visibility. Local WAL commit
      // precedes this wait, but other sessions need not see it until wait completion.
      await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();
      for(let i=0;i<50;i++) {
        const rows=await admin`select operation_id from fixture.audit where operation_id='uncertain_commit'`.raw();
        if(rows.length===1)break;await delay(10);
      }
      assert.equal((await admin`select value from fixture.records where company_id='company_a' and id='item'`.raw())[0][0]?.toString(),'commit-uncertain');
    }finally{await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();}
  });
});
