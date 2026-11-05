import { createConnection, isIP } from 'node:net';
import { connect as connectTLS, checkServerIdentity } from 'node:tls';
import { isPublicAddress, samePublicAddress } from './address-policy.js';
import { destinationPolicy, parseDestination, permitsDestination, plainRecord } from './destination-policy.js';
import { resolveDestination } from './resolve-destination.js';

/** @typedef {'denied'|'invalid'|'revoked'|'capacity'|'canceled'|'timeout'|'dns'|'address'|'connection'|'tls'} Failure */
/** @typedef {{kind:'failed',reason:Failure}} Failed */
/** @typedef {{kind:'connected',socket:import('node:tls').TLSSocket,url:string,policyId:string,revision:string,companyId:string}} Connected */
/** @typedef {{url:string,context:unknown,signal:AbortSignal}} Command */
/** @typedef {(context:unknown,policy:Readonly<import('./destination-policy.js').DestinationPolicy>)=>'allowed'|'denied'|'unavailable'} Authorize */

/** Internal adapter factory. Only the composition boundary supplies authority,
 * DNS and trust roots; no request can select an agent, proxy or TLS options.
 * Authority is an explicitly synchronous current-state owner decision, not a
 * cached Promise or caller assertion. Production identity integration is separate.
 * @param {unknown} configuration
 * @param {Authorize} authorize
 * @param {{resolve?:(hostname:string,signal:AbortSignal)=>Promise<unknown>,ca?:Buffer}} [ports]
 */
export function createDestinationConnector(configuration,authorize,ports={}) {
  const parsed = destinationPolicy(configuration);
  if (!parsed || typeof authorize !== 'function' || Object.keys(ports).some(key=>!['resolve','ca'].includes(key))) throw new Error('Invalid destination connector configuration');
  const policy=parsed;
  if (ports.ca !== undefined && (!Buffer.isBuffer(ports.ca) || ports.ca.length>65536)) throw new Error('Invalid destination trust roots');
  const ca = ports.ca === undefined ? undefined : Buffer.from(ports.ca);
  const resolve = ports.resolve ?? resolveDestination;
  /** @type {Set<AbortController>} */ const active = new Set();
  let retired = false;
  /** @param {unknown} context */
  function allowed(context) {
    try { return !retired && authorize(context,policy) === 'allowed'; }
    catch { return false; }
  }
  return Object.freeze({
    /** A revision is never repurposed. Retiring it cancels all its connections. */
    retire() { retired=true; for (const controller of active) controller.abort(); },
    /** @param {unknown} input @returns {Promise<Connected | Failed>} */
    async connect(input) {
      if (retired) return {kind:'failed',reason:'revoked'};
      if (!plainRecord(input) || Object.keys(input).length !== 3 || !Object.hasOwn(input,'context') || !(input.signal instanceof AbortSignal)) return {kind:'failed',reason:'invalid'};
      const url = parseDestination(input.url);
      if (!url || !permitsDestination(policy,url)) return {kind:'failed',reason:'invalid'};
      if (!allowed(input.context)) return {kind:'failed',reason:'denied'};
      if (input.signal.aborted) return {kind:'failed',reason:'canceled'};
      if (active.size >= 32) return {kind:'failed',reason:'capacity'};
      const controller = new AbortController();
      active.add(controller);
      const abort = () => controller.abort();
      input.signal.addEventListener('abort',abort,{once:true});
      /** @type {Failure} */ let reason='connection';
      /** @type {import('node:net').Socket | undefined} */ let tcp;
      /** @type {import('node:tls').TLSSocket | undefined} */ let tls;
      let connected=false;
      const deadline = setTimeout(()=>{reason='timeout';controller.abort();},5000);
      const total = setTimeout(()=>{reason='timeout';controller.abort();},30000);
      const externalSignal=input.signal;
      const cleanup = () => {
        clearTimeout(deadline); clearTimeout(total);
        externalSignal.removeEventListener('abort',abort);
        controller.signal.removeEventListener('abort',destroy);
        active.delete(controller);
      };
      const destroy = () => { tls?.destroy(); tcp?.destroy(); };
      controller.signal.addEventListener('abort',destroy,{once:true});
      try {
        const hostname=url.hostname.startsWith('[') ? url.hostname.slice(1,-1) : url.hostname;
        reason='dns';
        const addresses=await resolve(hostname,controller.signal);
        controller.signal.throwIfAborted();
        reason='address';
        if (!Array.isArray(addresses) || addresses.length === 0 || addresses.length>16 || !addresses.every(isPublicAddress)) return {kind:'failed',reason};
        // Copy only one validated literal. No second DNS lookup, fallback address,
        // family autoselection, environment proxy or connection pool is involved.
        const address=String(addresses[0]);
        if (!allowed(input.context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
        const port=url.port ? Number(url.port) : 443;
        reason='connection';
        tcp=createConnection({host:address,port,family:isIP(address),autoSelectFamily:false,signal:controller.signal});
        tcp.on('error',()=>{ reason='connection'; });
        await socketReady(tcp,'connect',controller.signal);
        reason='address';
        if (!samePublicAddress(address,tcp.remoteAddress) || tcp.remotePort !== port) return {kind:'failed',reason};
        if (!allowed(input.context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
        reason='tls';
        tls=connectTLS({socket:tcp,servername:isIP(hostname) ? undefined : hostname,rejectUnauthorized:true,minVersion:'TLSv1.2',ca,
          checkServerIdentity:(_name,certificate)=>checkServerIdentity(hostname,certificate)});
        tls.on('error',()=>{ reason='tls'; });
        await socketReady(tls,'secureConnect',controller.signal);
        controller.signal.throwIfAborted();
        if (!tls.authorized || !samePublicAddress(address,tls.remoteAddress) || tls.remotePort !== port) return {kind:'failed',reason:'tls'};
        if (!allowed(input.context)) return {kind:'failed',reason:retired ? 'revoked' : 'denied'};
        clearTimeout(deadline);
        tls.setTimeout(10000,()=>tls?.destroy());
        tls.once('close',cleanup);
        connected=true;
        return {kind:'connected',socket:tls,url:url.href,policyId:policy.id,revision:policy.revision,companyId:policy.companyId};
      } catch {
        return {kind:'failed',reason:retired ? 'revoked' : externalSignal.aborted ? 'canceled' : controller.signal.aborted ? 'timeout' : reason};
      } finally {
        if (!connected) { destroy(); cleanup(); }
      }
    },
  });
}

/** @param {import('node:net').Socket} socket @param {'connect'|'secureConnect'} event @param {AbortSignal} signal */
function socketReady(socket,event,signal) {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{socket.off(event,ready);socket.off('error',fail);socket.off('close',fail);signal.removeEventListener('abort',fail);};
    const ready=()=>{cleanup();resolve(undefined);};
    const fail=()=>{cleanup();reject(new Error('Destination connection failed'));};
    socket.once(event,ready);socket.once('error',fail);socket.once('close',fail);signal.addEventListener('abort',fail,{once:true});
    if (signal.aborted) fail();
  });
}
