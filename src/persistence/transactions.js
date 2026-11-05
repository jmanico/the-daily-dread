import postgres from 'postgres';
import { closedRecord } from '../contracts/http-results.js';

/** @typedef {string|number|boolean|null} Value */
/** @typedef {ReadonlyArray<ReadonlyArray<string|null>>} Rows */
/** @typedef {{query:(name:string,values?:readonly Value[])=>Promise<Rows>,companyId:string,operationId:string}} Transaction */
/** @typedef {{companyId:string,operationId:string,signal:AbortSignal,timeoutMs:number}} Context */
/** @typedef {{host:string,port:number,database:string,user:string,password:string,ca:string}} Configuration */
const identity=/^[A-Za-z0-9_-]{1,128}$/;
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});

/** Owner policies throw only these fixed outcomes; no arbitrary reason is retained. */
export class TransactionRejection extends Error {
  /** @param {'denied'|'not_found'|'conflict'|'invalid'} kind */
  constructor(kind) {
    super('Transaction rejected');
    if(!['denied','not_found','conflict','invalid'].includes(kind))throw new Error('Invalid transaction rejection');
    this.kind=kind;
  }
}

/** Configuration is an installation capability, never request data or a URL.
 * @param {unknown} input @returns {Configuration} */
function configuration(input) {
  if(!closedRecord(input,['host','port','database','user','password','ca']) ||
    typeof input.host!=='string' || input.host.length>253 || !/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(input.host) ||
    typeof input.port!=='number' || !Number.isInteger(input.port) || input.port<1 || input.port>65535 ||
    typeof input.database!=='string' || !identity.test(input.database) || typeof input.user!=='string' || !identity.test(input.user) ||
    typeof input.password!=='string' || input.password.length===0 || input.password.length>4096 || encoder.encode(input.password).length>4096 || /[\u0000\uD800-\uDFFF]/u.test(input.password) ||
    typeof input.ca!=='string' || input.ca.length>65536 || encoder.encode(input.ca).length>65536 || !input.ca.startsWith('-----BEGIN CERTIFICATE-----\n') ||
    !input.ca.trimEnd().endsWith('-----END CERTIFICATE-----')) throw new Error('Invalid database configuration');
  return {host:input.host,port:input.port,database:input.database,user:input.user,password:input.password,ca:input.ca};
}

/** @param {unknown} value @returns {value is Context} */
function context(value) {
  return closedRecord(value,['companyId','operationId','signal','timeoutMs']) &&
    typeof value.companyId==='string' && identity.test(value.companyId) &&
    typeof value.operationId==='string' && identity.test(value.operationId) && value.signal instanceof AbortSignal &&
    typeof value.timeoutMs==='number' && Number.isInteger(value.timeoutMs) && value.timeoutMs>=1 && value.timeoutMs<=10000;
}

/** @param {readonly Value[]} values @returns {Value[]} */
function parameters(values) {
  if(!Array.isArray(values) || values.length>32 || Reflect.ownKeys(values).length!==values.length+1)throw new TransactionRejection('invalid');
  let bytes=0;
  const result=[];
  for(let i=0;i<values.length;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(values,String(i));
    if(!descriptor || !Object.hasOwn(descriptor,'value'))throw new TransactionRejection('invalid');
    const value=descriptor.value;
    if(typeof value==='string') {
      if(value.length>8192)throw new TransactionRejection('invalid');
      const size=encoder.encode(value).length;
      if(size>8192 || /[\u0000\uD800-\uDFFF]/u.test(value))throw new TransactionRejection('invalid');
      bytes+=size;
    } else if(value!==null && typeof value!=='boolean' && !(typeof value==='number' && Number.isSafeInteger(value)))throw new TransactionRejection('invalid');
    if(bytes>65536)throw new TransactionRejection('invalid');
    result.push(value);
  }
  return result;
}

/** Returned raw bytes are explicitly copied/decoded, never returned as driver rows.
 * Each registered SQL statement must also bound rows/column bytes at the database.
 * @param {readonly (readonly (Buffer|null)[])[]} rows @returns {Rows} */
function project(rows) {
  if(rows.length>100)throw new TransactionRejection('invalid');
  let bytes=0;
  return Object.freeze(rows.map(row=>{
    if(row.length>32)throw new TransactionRejection('invalid');
    return Object.freeze(row.map(value=>{
      if(value===null)return null;
      bytes+=value.byteLength;
      if(value.byteLength>8192 || bytes>1048576)throw new TransactionRejection('invalid');
      return decoder.decode(value);
    }));
  }));
}

/** Trusted persistence composition registers fixed, reviewed SQL only. Every owner
 * statement receives company scope as $1; its SQL must enforce that scope. This
 * registry is not a SQL parser or a substitute for reviewing ownership predicates.
 * Authentication and current owner/role/revision checks belong inside work(), on
 * this same transaction. No pool, URL, driver error or network capability escapes.
 * @param {unknown} input @param {Readonly<Record<string,string>>} statements */
export function createTransactionBoundary(input,statements) {
  const config=configuration(input);
  const names=Object.keys(statements);
  if(names.length===0 || names.length>100 || !closedRecord(statements,names) || names.some(name=>
    !/^[a-z][a-z0-9_]{0,63}$/.test(name) || typeof statements[name]!=='string' || statements[name].length>16384 || encoder.encode(statements[name]).length>16384 ||
    statements[name].includes('\0')))throw new Error('Invalid statement registry');
  const registry=new Map(names.map(name=>[name,statements[name]]));
  let active=0,closed=false;
  /** @type {Set<import('postgres').Sql>} */
  const pools=new Set();
  /** @type {Set<AbortController>} */
  const controllers=new Set();

  /** One owned connection per operation avoids returning canceled/broken sessions
   * to a shared pool. At most two are admitted and no waiting queue is retained.
   * Whole-operation retry belongs to the durable owner and its existing schedule;
   * a retryable result never repeats statements or external effects here.
   * @template T @param {unknown} inputContext @param {(tx:Transaction)=>Promise<T>} work */
  async function run(inputContext,work) {
    if(!context(inputContext) || typeof work!=='function')return Object.freeze({kind:'invalid'});
    if(closed || active>=2)return Object.freeze({kind:'unavailable'});
    const companyId=inputContext.companyId, operationId=inputContext.operationId;
    const signal=inputContext.signal;
    if(signal.aborted)return Object.freeze({kind:'cancelled',operationId});
    active++;
    const abort=new AbortController();
    controllers.add(abort);
    const combined=AbortSignal.any([signal,abort.signal]);
    let live=true,committing=false,queryActive=false,queries=0,poisoned=false;
    // All options are code-owned: environment/URL settings cannot disable TLS,
    // enable tracing/debugging/type discovery, or enlarge pool/pipeline limits.
    /** @type {import('postgres').Sql} */
    let sql;
    try {sql=postgres({host:config.host,port:config.port,database:config.database,user:config.user,password:config.password,
      ssl:{ca:config.ca,rejectUnauthorized:true,minVersion:'TLSv1.2'},sslnegotiation:null,channel_binding:'require',
      max:1,min:0,max_pipeline:1,connect_timeout:2,queue_timeout:2,idle_timeout:2,max_lifetime:30,
      prepare:false,infer:false,fetch_types:false,scheduler:false,backoff:0,keep_alive:5,debug:false,
      onnotice:()=>{},connection:{application_name:'daily-dread',search_path:'pg_catalog'},
      target_session_attrs:'read-write'});}
    catch {controllers.delete(abort);active--;return Object.freeze({kind:'unavailable',operationId});}
    pools.add(sql);
    const timeout=setTimeout(()=>abort.abort(),inputContext.timeoutMs);
    /** @type {(()=>void)|undefined} */
    let onAbort;
    /** @type {Promise<never>} */
    const cancelled=new Promise((_,reject)=>{
      onAbort=()=>{live=false;reject(new Error('Operation cancelled'));};
      combined.addEventListener('abort',onAbort,{once:true});
    });
    /** @type {import('postgres').ReservedSql|undefined} */
    let client;
    try {
      const result=await Promise.race([execute(),cancelled]);
      return Object.freeze({kind:'committed',operationId,value:result});
    } catch(error) {
      // A server serialization/deadlock response proves the transaction did not
      // commit, including a serialization failure reported by COMMIT itself.
      const code=error instanceof postgres.PostgresError?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;
      if(code==='40001' || code==='40P01')return Object.freeze({kind:'retryable',operationId});
      if(committing)return Object.freeze({kind:'unknown',operationId});
      if(combined.aborted)return Object.freeze({kind:'cancelled',operationId});
      if(error instanceof TransactionRejection)return Object.freeze({kind:error.kind,operationId});
      return Object.freeze({kind:'unavailable',operationId});
    } finally {
      live=false;
      clearTimeout(timeout);
      if(onAbort)combined.removeEventListener('abort',onAbort);
      // Destroy this operation's connection even if rollback, cancellation or the
      // callback stalls. PostgreSQL rolls back an uncommitted disconnected session.
      // Already-sent COMMIT is uncertain until reconciled by the durable owner.
      await sql.end({timeout:0});
      client?.release();
      pools.delete(sql);controllers.delete(abort);active--;
    }

    async function execute() {
      const reserved=await sql.reserve();
      client=reserved;
      if(!live || combined.aborted)throw new Error('Operation cancelled');
      await reserved`begin isolation level serializable`.raw().signal(combined);
      await reserved`select set_config('statement_timeout','2000',true),set_config('lock_timeout','1000',true),set_config('idle_in_transaction_session_timeout','3000',true),set_config('synchronous_commit','on',true)`.raw().signal(combined);
      /** @type {Transaction} */
      const tx=Object.freeze({companyId,operationId,query});
      const result=await work(tx);
      if(!live || combined.aborted || queryActive || poisoned)throw new Error('Operation cancelled');
      live=false;committing=true;
      const committed=await reserved`commit`.raw().signal(combined);
      if(committed.command!=='COMMIT')throw new Error('Commit not acknowledged');
      return result;

      /** @param {string} name @param {readonly Value[]} [values] @returns {Promise<Rows>} */
      async function query(name,values=[]) {
        if(!live || combined.aborted || queryActive || ++queries>100) {poisoned=true;throw new TransactionRejection('invalid');}
        queryActive=true;
        try {
          const text=registry.get(name);
          if(text===undefined)throw new TransactionRejection('invalid');
          const params=parameters(values);
          // unsafe denotes the driver's fixed-string API, not interpolated SQL.
          // Registry identity, primitive bound values and mandatory $1 scope are
          // selected above; owner-specific SQL remains a reviewed trust boundary.
          const rows=await reserved.unsafe(text,[companyId,...params]).raw().signal(combined);
          if(!live || combined.aborted)throw new Error('Operation cancelled');
          return project(rows);
        } catch(error) {poisoned=true;throw error;}
        finally {queryActive=false;}
      }
    }
  }

  return Object.freeze({run,status:()=>Object.freeze({active,closed}),async close(){
    closed=true;
    for(const controller of controllers)controller.abort();
    await Promise.all([...pools].map(sql=>sql.end({timeout:0})));
  }});
}
