/** Bounded operational capture, not the authoritative audit destination.
 * Raw Fastify calls are suppressed before Pino examines their arguments.
 * Only immutable snapshots constructed here can enter the encoding path.
 * @typedef {{take:()=>string|undefined,status:()=>Readonly<{queued:number,bytes:number,dropped:number,suppressed:number,rejected:number}>}} Capture
 * @typedef {Readonly<Record<string,string|number>>} Snapshot
 * @typedef {{options:Exclude<import('fastify').FastifyServerOptions['logger'],boolean|undefined>,bind:(logger:import('fastify').FastifyBaseLogger)=>void,emit:(record:Snapshot)=>boolean,reject:()=>void}} Owner
 */
/** @type {WeakMap<Capture,Owner>} */
const owners = new WeakMap();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const methods = new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','CONNECT','TRACE','OTHER']);
const increment = (/** @type {number} */ value) => Math.min(Number.MAX_SAFE_INTEGER,value+1);
/** @returns {Capture} */
export function createDiagnosticCapture() {
  /** @type {string[]} */ const queue=[];
  let bytes=0,dropped=0,suppressed=0,rejected=0,accepted=false;
  /** @type {((record:Snapshot)=>void)|undefined} */ let encode;
  const approved=new WeakSet();
  const capture=Object.freeze({
    take() { const line=queue.shift();if(line!==undefined)bytes-=Buffer.byteLength(line);return line; },
    status() { return Object.freeze({queued:queue.length,bytes,dropped,suppressed,rejected}); },
  });
  const reject=()=>{rejected=increment(rejected);};
  /** @type {Exclude<import('fastify').FastifyServerOptions['logger'],boolean|undefined>} */
  const options={
    level:'info',base:null,timestamp:false,
    serializers:{req:()=>({}),res:()=>({}),err:()=>({type:'Error',message:'redacted',stack:''})},
    formatters:{bindings:()=>({}),level:label=>({level:label})},
    hooks:{logMethod(args,method) {
      const value=args[0];
      if(args.length!==1 || typeof value!=='object' || value===null || !approved.has(value)) {suppressed=increment(suppressed);return;}
      method.call(this,value);
    }},
    stream:{write(line) {
      if(typeof line!=='string' || Buffer.byteLength(line)>4096 || queue.length>=32 || bytes+Buffer.byteLength(line)>131072) {dropped=increment(dropped);return;}
      queue.push(line);bytes+=Buffer.byteLength(line);accepted=true;
    }},
  };
  owners.set(capture,{options,reject,
    bind(logger) {
      if(encode)throw new Error('Diagnostic capture already bound');
      // Pino resets its binding formatter for children. Do not let child inputs
      // reach that serializer at all. Request identity is in our explicit snapshot.
      Object.defineProperty(logger,'child',{value:()=>logger,writable:false,configurable:false});
      Object.defineProperty(logger,'setBindings',{value:()=>undefined,writable:false,configurable:false});
      // Retain this code-owned INFO method independently of later level selection.
      const info=logger.info.bind(logger),warn=logger.warn.bind(logger),error=logger.error.bind(logger);
      encode=record=>{if(record.kind==='http_ingress_rejected'){if(record.status===503)error(record);else warn(record);}else info(record);};
    },
    emit(record) {
      if(!encode){reject();return false;}
      approved.add(record);accepted=false;
      try {encode(record);return accepted;} catch {dropped=increment(dropped);return false;}
      finally {approved.delete(record);}
    },
  });
  return capture;
}
/** Composition-only access; arbitrary injected logger configurations are rejected.
 * @param {Capture} capture */
export function diagnosticOptions(capture) {
  const owner=owners.get(capture);if(!owner)throw new Error('Invalid diagnostic capture');return owner.options;
}
/** @param {Capture} capture @param {import('fastify').FastifyBaseLogger} logger */
export function bindDiagnostics(capture,logger) {
  const owner=owners.get(capture);if(!owner)throw new Error('Invalid diagnostic capture');owner.bind(logger);
}
/** Inputs are trusted factory primitives, never a request/response/error object.
 * Only registered code-owned templates may be supplied by the HTTP owner.
 * @param {Capture} capture @param {string} id @param {string} method @param {string} route
 * Undefined status means the connection aborted without a completed response.
 * @param {number|undefined} status @param {number} duration */
export function recordHttpOutcome(capture,id,method,route,status,duration) {
  const owner=owners.get(capture);if(!owner)return false;
  if(typeof id!=='string' || !uuid.test(id) || typeof method!=='string' || !methods.has(method) || typeof route!=='string' || route.length>256 || !/^(?:unmatched|\/[A-Za-z0-9_/:.*-]*)$/.test(route) ||
    status!==undefined && (!Number.isInteger(status) || status<100 || status>599) || !Number.isSafeInteger(duration) || duration<0) {owner.reject();return false;}
  /** @type {Record<string,string|number>} */
  const record={kind:status===undefined?'http_aborted':'http_completed',timestamp:new Date().toISOString(),request_id:id,method,route,duration_ms:duration};
  if(status!==undefined)record.status=status;
  return owner.emit(Object.freeze(record));
}
/** Native parser failures have no trusted method/route or complete request.
 * @param {Capture} capture @param {string} id @param {number} [status] */
export function recordIngressRejection(capture,id,status=400) {
  const owner=owners.get(capture);if(!owner)return false;
  if(typeof id!=='string' || !uuid.test(id) || ![400,503].includes(status)){owner.reject();return false;}
  return owner.emit(Object.freeze({kind:'http_ingress_rejected',timestamp:new Date().toISOString(),request_id:id,status}));
}
