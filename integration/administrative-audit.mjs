import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { startPostgres } from '../test-support/postgres-container.mjs';
import { createTransactionBoundary,TransactionRejection } from '../src/persistence/transactions.js';
import { createAdministrativeAudit,auditStatements } from '../src/persistence/administrative-audit.js';
import { createApplication,HttpFailure,operationSignal } from '../src/http/application.js';
import { closedRecord } from '../src/contracts/http-results.js';

/** @param {string} operationId @param {string} [companyId] */
const context=(operationId,companyId='company_a')=>({companyId,operationId,signal:new AbortController().signal,timeoutMs:3000});
/** @template T @param {{kind:string,value?:T}} result @returns {T} */
function value(result){assert.equal(result.kind,'committed');if(result.value===undefined)throw Error('Missing committed value');return result.value;}
const configuration={producerRef:'producer_a',environment:'test'};
const statements={...auditStatements,
  unsafe_commit:"select set_config('synchronous_commit','off',true) where $1::text is not null",
  principal:'select actor_id,role from fixture.principals where company_id=$1 and actor_id=$2 and enabled for share',
  target:'select revision::text from fixture.settings where company_id=$1 and id=$2 for update',
  mutate:'update fixture.settings set revision=revision+1,value=$4 where company_id=$1 and id=$2 and revision=$3::bigint returning revision::text',
  work:'insert into fixture.work(company_id,operation_id,config_ref,revision) values($1,$2,$3,$4::bigint)',
};

/** Fixture owner only: real tables/locks and current synthetic authority, no OIDC
 * claim. Bound actor comes from trusted composition, not submitted command data.
 * @param {string} [actor] @returns {import('../src/persistence/administrative-audit.js').Owner} */
function policy(actor='admin_a') {
  /** @param {import('../src/persistence/transactions.js').Transaction} tx */
  const read=async tx=>{const rows=await tx.query('principal',[actor]);return rows.length===1 && rows[0][1]==='admin'?'allowed':'denied';};
  return {read,authorize:async(tx,input)=>{
    if(await read(tx)!=='allowed')return {kind:'denied'};
    if(!closedRecord(input,['configRef','revision','value']) || typeof input.configRef!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.configRef) ||
      typeof input.revision!=='number' || !Number.isSafeInteger(input.revision) || input.revision<1 || input.revision>=Number.MAX_SAFE_INTEGER || typeof input.value!=='boolean')return {kind:'invalid'};
    const rows=await tx.query('target',[input.configRef]);
    if(rows.length===0)return {kind:'not_found'};
    if(rows[0][0]!==String(input.revision))return {kind:'conflict'};
    const configRef=input.configRef,revision=input.revision,newValue=input.value;
    return {kind:'allowed',grant:{actorRef:actor,actorKind:'user',provenance:'verified_session',configRef,revisionRef:`revision_${revision+1}`,changeKind:'reconfigure'},mutation:async tx=>{
      const changed=await tx.query('mutate',[configRef,revision,newValue]);if(changed.length!==1)throw new TransactionRejection('conflict');
      await tx.query('work',[tx.operationId,configRef,revision+1]);
    }};
  }};
}
const command=()=>({configRef:'audit_config',revision:1,value:true});

test('administrative changes, revisions, append-only audit and work commit atomically',{timeout:90000},async t=>{
  const fixture=await startPostgres();t.after(()=>fixture.close());
  const admin=postgres({...fixture.config,ssl:{ca:fixture.config.ca,rejectUnauthorized:true},channel_binding:'require',max:2,fetch_types:false,onnotice:false});t.after(()=>admin.end({timeout:0}));
  await admin.unsafe(await readFile(new URL('../db/002-administrative-audit.sql',import.meta.url),'utf8')).raw();
  await admin.unsafe(`create role dread_audit_app login password 'synthetic-audit-fixture' nosuperuser nocreatedb nocreaterole noinherit;
    create schema fixture;
    create table fixture.principals(company_id text,actor_id text,role text,enabled boolean,primary key(company_id,actor_id));
    create table fixture.settings(company_id text,id text,revision bigint,value boolean,primary key(company_id,id));
    create table fixture.work(company_id text,operation_id text,config_ref text,revision bigint,primary key(company_id,operation_id),foreign key(company_id,config_ref) references fixture.settings);
    grant usage on schema dread_audit,fixture to dread_audit_app;
    grant select,insert on dread_audit.events,dread_audit.mutation_receipts to dread_audit_app;
    grant select,update on fixture.principals,fixture.settings to dread_audit_app;
    grant insert on fixture.work to dread_audit_app;
    insert into fixture.principals values('company_a','admin_a','admin',true),('company_a','user_a','user',true),('company_b','admin_b','admin',true);
    insert into fixture.settings values('company_a','audit_config',1,false),('company_b','audit_config',1,false);`).raw();
  const config={...fixture.config,user:'dread_audit_app',password:'synthetic-audit-fixture'};
  const boundary=createTransactionBoundary(config,statements);t.after(()=>boundary.close());
  const owner=createAdministrativeAudit(boundary,configuration,policy());
  t.beforeEach(async()=>{await admin.unsafe('truncate dread_audit.mutation_receipts,dread_audit.events,fixture.work; update fixture.settings set revision=1,value=false; update fixture.principals set enabled=true').raw();});
  async function counts(){return (await admin`select (select count(*) from dread_audit.events)::text,(select count(*) from dread_audit.mutation_receipts)::text,(select count(*) from fixture.work)::text,(select revision from fixture.settings where company_id='company_a')::text`.raw())[0].map(x=>x?.toString());}

  await t.test('current admin commits one immutable attributed event, revision and work intent; receipt is scoped',async()=>{
    const result=value(await owner.change(context('success'),command()));
    assert.deepEqual(await counts(),['1','1','1','2']);
    const rows=await admin`select encoded,ingested_at::text from dread_audit.events`.raw();
    const record=JSON.parse(rows[0][0].toString());
    assert.equal(record.event_id,result.eventId);assert.equal(record.outcome,'success');assert.equal(record.reason_code,'committed');assert.equal(record.actor_ref,'admin_a');assert.equal(record.tenant_ref,'company_a');assert.equal(record.operation_ref,'success');assert.equal(record.revision_ref,'revision_2');assert.equal(record.severity,'info');assert.equal(record.audit_required,true);assert.ok(rows[0][1]);
    assert.deepEqual(value(await owner.reconcile(context('success'))),{eventId:result.eventId,outcome:'success'});
    assert.equal((await owner.reconcile(context('missing'))).kind,'not_found');
    const other=createAdministrativeAudit(boundary,configuration,policy('admin_b'));assert.equal((await other.reconcile(context('success','company_b'))).kind,'not_found');
    assert.equal((await owner.change(context('success'),{...command(),revision:2})).kind,'conflict');assert.deepEqual(await counts(),['1','1','1','2']);
  });

  await t.test('missing, ordinary, revoked, wrong-company actors and malformed or stale commands have no effect',async()=>{
    for(const actor of ['missing','user_a','admin_b']) {
      const denied=createAdministrativeAudit(boundary,configuration,policy(actor));assert.equal((await denied.change(context('denied'),command())).kind,'denied');assert.equal((await denied.reconcile(context('denied'))).kind,'denied');
    }
    assert.equal((await owner.change(context('cross','company_b'),command())).kind,'denied');
    await admin`update fixture.principals set enabled=false where actor_id='admin_a'`.raw();assert.equal((await owner.change(context('revoked'),command())).kind,'denied');
    await admin`update fixture.principals set enabled=true where actor_id='admin_a'`.raw();
    for(const input of [null,{...command(),actorRef:'admin_a'},{...command(),extra:'secret-input'},Object.create(command()),{...command(),value:'true'},{...command(),revision:1.2},{...command(),configRef:'secret/../../../'}])assert.equal((await owner.change(context('invalid'),input)).kind,'invalid');
    assert.equal((await owner.change(context('missing'),{...command(),configRef:'unavailable'})).kind,'not_found');
    assert.equal((await owner.change(context('stale'),{...command(),revision:2})).kind,'conflict');assert.deepEqual(await counts(),['0','0','0','1']);
  });

  await t.test('audit privilege loss, work failure and throwing owner roll back every write and suppress secret errors',async()=>{
    await admin`revoke insert on dread_audit.events from dread_audit_app`.raw();
    try{const result=await owner.change(context('audit_failure'),command());assert.equal(result.kind,'unavailable');assert.deepEqual(await counts(),['0','0','0','1']);}
    finally{await admin`grant insert on dread_audit.events to dread_audit_app`.raw();}
    await admin`revoke insert on fixture.work from dread_audit_app`.raw();
    try{assert.equal((await owner.change(context('work_failure'),command())).kind,'unavailable');assert.deepEqual(await counts(),['0','0','0','1']);}
    finally{await admin`grant insert on fixture.work to dread_audit_app`.raw();}
    const base=policy();const failed=createAdministrativeAudit(boundary,configuration,{...base,authorize:async(tx,input)=>{
      const decision=await base.authorize(tx,input);if(decision.kind!=='allowed')return decision;
      return {...decision,mutation:async(tx,grant)=>{await decision.mutation(tx,grant);throw Error('secret-private-owner-error');}};
    }});
    const result=await failed.change(context('owner_failure'),command());assert.equal(result.kind,'unavailable');assert.doesNotMatch(JSON.stringify(result),/secret-private-owner-error/);assert.deepEqual(await counts(),['0','0','0','1']);
  });

  await t.test('receipt failure and weakened synchronous commit abort the mutation rather than acknowledge durability',async()=>{
    await admin`revoke insert on dread_audit.mutation_receipts from dread_audit_app`.raw();
    try{assert.equal((await owner.change(context('receipt_failure'),command())).kind,'unavailable');assert.deepEqual(await counts(),['0','0','0','1']);}
    finally{await admin`grant insert on dread_audit.mutation_receipts to dread_audit_app`.raw();}
    const base=policy();const weak=createAdministrativeAudit(boundary,configuration,{...base,authorize:async(tx,input)=>{
      const decision=await base.authorize(tx,input);if(decision.kind!=='allowed')return decision;
      return {...decision,mutation:async(tx,grant)=>{await decision.mutation(tx,grant);await tx.query('unsafe_commit');}};
    }});
    assert.equal((await weak.change(context('weak_commit'),command())).kind,'unavailable');assert.deepEqual(await counts(),['0','0','0','1']);
  });

  await t.test('slow audit storage hits the real database lock deadline and rolls back pending work',async()=>{
    let locked=()=>{},release=()=>{};const ready=new Promise(resolve=>{locked=()=>resolve(undefined);});const gate=new Promise(resolve=>{release=()=>resolve(undefined);});
    const holder=admin.begin(async tx=>{await tx`lock table dread_audit.events in access exclusive mode`.raw();locked();await gate;});
    await ready;
    try{const start=performance.now();assert.equal((await owner.change(context('slow_storage'),command())).kind,'unavailable');assert.ok(performance.now()-start<2500);}
    finally{release();await holder;}
    assert.deepEqual(await counts(),['0','0','0','1']);
  });

  await t.test('production HTTP factory admits only authenticated current-authority receipt reads',async()=>{
    value(await owner.change(context('http_receipt'),command()));let calls=0;
    const app=createApplication(async request=>request.headers['x-fixture-auth']==='valid'?'allowed':'unauthenticated');
    app.get('/audit-receipt',{schema:{response:{200:{type:'object',additionalProperties:false,required:['outcome'],properties:{outcome:{type:'string',enum:['success']}}}}}},async request=>{
      calls++;const result=await owner.reconcile({...context('http_receipt'),signal:operationSignal(request)});
      if(result.kind!=='committed')throw new HttpFailure(result.kind==='denied'?403:503);
      return {outcome:result.value.outcome};
    });
    try{
      assert.equal((await app.inject('/audit-receipt')).statusCode,401);assert.equal(calls,0);
      const reply=await app.inject({url:'/audit-receipt?company=company_b',headers:{'x-fixture-auth':'valid'}});assert.equal(reply.statusCode,200);assert.deepEqual(reply.json(),{outcome:'success'});assert.doesNotMatch(reply.body,/admin_a|company_a|producer_a|revision|encoded/);
      await admin`update fixture.principals set enabled=false where actor_id='admin_a'`.raw();assert.equal((await app.inject({url:'/audit-receipt',headers:{'x-fixture-auth':'valid'}})).statusCode,403);
    }finally{await app.close();}
  });

  await t.test('database roles cannot rewrite, delete, truncate or replace audit history or receipts',async()=>{
    value(await owner.change(context('protected'),command()));
    const runtime=postgres({...config,ssl:{ca:config.ca,rejectUnauthorized:true},channel_binding:'require',max:1,fetch_types:false,onnotice:false});
    try{for(const statement of ['update dread_audit.events set encoded=encoded','delete from dread_audit.events','truncate dread_audit.events cascade','drop table dread_audit.events cascade','alter table dread_audit.events add column unsafe text','update dread_audit.mutation_receipts set operation_ref=operation_ref','delete from dread_audit.mutation_receipts','create table dread_audit.unsafe(id int)'])await assert.rejects(runtime.unsafe(statement).raw(),{code:'42501'});}
    finally{await runtime.end({timeout:0});}
    assert.deepEqual(await counts(),['1','1','1','2']);
  });

  await t.test('duplicate event IDs and inconsistent company or operation fields cannot alter history',async()=>{
    value(await owner.change(context('immutable'),command()));
    const row=(await admin`select producer_ref,event_id::text,encoded from dread_audit.events`.raw())[0];
    const producer=row[0].toString(),eventId=row[1].toString(),encoded=row[2].toString();
    await assert.rejects(admin`insert into dread_audit.events(company_id,producer_ref,event_id,operation_ref,encoded) values('company_a',${producer},${eventId}::uuid,'immutable',${encoded})`.raw(),{code:'23505'});
    const conflict=JSON.parse(encoded);conflict.revision_ref='revision_3';
    await assert.rejects(admin`insert into dread_audit.events(company_id,producer_ref,event_id,operation_ref,encoded) values('company_a',${producer},${eventId}::uuid,'immutable',${JSON.stringify(conflict)})`.raw(),{code:'23505'});
    for(const bad of ['{}',encoded.replace('"tenant_ref":"company_a"','"tenant_ref":"company_b"'),encoded.replace('"operation_ref":"immutable"','"operation_ref":"different"')])await assert.rejects(admin`insert into dread_audit.events(company_id,producer_ref,event_id,operation_ref,encoded) values('company_a',${producer},${eventId}::uuid,'immutable',${bad})`.raw(),{code:'23514'});
    await assert.rejects(admin`insert into dread_audit.mutation_receipts values('company_a',${producer},'mismatched_operation',${eventId}::uuid)`.raw(),{code:'23503'});
    assert.equal((await admin`select encoded from dread_audit.events`.raw())[0][0]?.toString(),encoded);assert.deepEqual(await counts(),['1','1','1','2']);
    assert.deepEqual(Object.keys(owner).sort(),['change','reconcile']);
  });

  await t.test('authority contract failures, mutable grants and submitted mutation races cannot change captured attribution',async()=>{
    for(const decision of [true,undefined,{kind:'allowed'},{kind:'unavailable'},{kind:'allowed',grant:{},mutation:async()=>{}},{kind:'denied',extra:'secret'}]) {
      const bad=createAdministrativeAudit(boundary,configuration,{...policy(),authorize:async()=>/** @type {import('../src/persistence/administrative-audit.js').Decision} */(/** @type {unknown} */(decision))});
      assert.ok(['invalid','unavailable'].includes((await bad.change(context('bad_policy'),command())).kind));
    }
    for(const read of [async()=> 'unavailable',async()=>true,async()=>{throw Error('private-read-secret');}]) {
      const bad=createAdministrativeAudit(boundary,configuration,{...policy(),read:/** @type {import('../src/persistence/administrative-audit.js').Owner['read']} */(read)});
      const result=await bad.reconcile(context('unavailable_reader'));assert.equal(result.kind,'unavailable');assert.doesNotMatch(JSON.stringify(result),/private-read-secret/);
    }
    for(const badGrant of [{actorRef:'x'.repeat(8193)},{configRef:'private/path'},{revisionRef:undefined},{provenance:'untrusted'},{actorKind:'unknown'},{changeKind:'invented'},{extra:'private-note'}]) {
      const base=policy();const bad=createAdministrativeAudit(boundary,configuration,{...base,authorize:async(tx,input)=>{const decision=await base.authorize(tx,input);if(decision.kind!=='allowed')return decision;return {...decision,grant:/** @type {import('../src/persistence/administrative-audit.js').Grant} */({...decision.grant,...badGrant})};}});
      assert.equal((await bad.change(context('invalid_grant'),command())).kind,'invalid');
    }
    let getters=0;const input=Object.defineProperty(command(),'value',{get(){getters++;return true;}});assert.equal((await owner.change(context('getter'),input)).kind,'invalid');assert.equal(getters,0);
    const base=policy(),mutable=command();const capture=createAdministrativeAudit(boundary,configuration,{...base,authorize:async(tx,input)=>{
      const decision=await base.authorize(tx,input);if(decision.kind!=='allowed')return decision;
      return {...decision,mutation:async(tx,grant)=>{decision.grant.actorRef='forged_actor';mutable.value=false;assert.equal(grant.actorRef,'admin_a');assert.ok(Object.isFrozen(grant));await decision.mutation(tx,grant);}};
    }});
    value(await capture.change(context('captured'),mutable));
    assert.equal((await admin`select value::text from fixture.settings where company_id='company_a'`.raw())[0][0]?.toString(),'true');
    const encoded=(await admin`select encoded from dread_audit.events`.raw())[0][0]?.toString();assert.doesNotMatch(encoded,/forged_actor|secret/);assert.equal(JSON.parse(encoded).actor_ref,'admin_a');
  });

  await t.test('concurrent changes and cancellation preserve one revision and forbid late audit success',async()=>{
    const results=await Promise.all([owner.change(context('race_a'),command()),owner.change(context('race_b'),command())]);
    assert.equal(results.filter(r=>r.kind==='committed').length,1);assert.ok(results.every(r=>['committed','conflict','retryable'].includes(r.kind)));assert.deepEqual(await counts(),['1','1','1','2']);
    const base=policy();let resume=()=>{};const gate=new Promise(resolve=>{resume=()=>resolve(undefined);});let entered=()=>{};const ready=new Promise(resolve=>{entered=()=>resolve(undefined);});
    const slow=createAdministrativeAudit(boundary,configuration,{...base,authorize:async(tx,input)=>{const decision=await base.authorize(tx,input);if(decision.kind!=='allowed')return decision;return {...decision,mutation:async(tx,grant)=>{await decision.mutation(tx,grant);entered();await gate;}};}});
    const controller=new AbortController();const pending=slow.change({...context('cancelled'),signal:controller.signal},{...command(),revision:2});await ready;controller.abort();assert.equal((await pending).kind,'cancelled');resume();await delay(50);assert.deepEqual(await counts(),['1','1','1','2']);
  });

  await t.test('lost commit acknowledgment remains unknown and reconciles to the same durable receipt without replay',async()=>{
    await admin`alter system set synchronous_standby_names='*'`.raw();await admin`select pg_reload_conf()`.raw();
    try {
      await delay(100);const pending=owner.change({...context('unknown_commit'),timeoutMs:1000},command());
      let waiting=false;for(let i=0;i<50;i++){const rows=await admin`select pid from pg_stat_activity where usename='dread_audit_app' and wait_event='SyncRep'`.raw();if(rows.length===1){waiting=true;break;}await delay(10);}
      assert.equal(waiting,true);assert.equal((await pending).kind,'unknown');
      await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();
      for(let i=0;i<50;i++){if((await counts())[0]==='1')break;await delay(10);}
      const receipt=value(await owner.reconcile(context('unknown_commit')));assert.equal(receipt.outcome,'success');assert.deepEqual(await counts(),['1','1','1','2']);
      assert.equal((await owner.change(context('unknown_commit'),{...command(),revision:2})).kind,'conflict');
    }finally{await admin`alter system reset synchronous_standby_names`.raw();await admin`select pg_reload_conf()`.raw();}
  });
});
