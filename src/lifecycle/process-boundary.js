import process from 'node:process';

/** Exit status is a bounded diagnostic for the external supervisor. Fatal handlers
 * never inspect exceptions or write potentially blocking stdout/stderr. They do
 * not resume work or attempt asynchronous recovery in an undefined process state.
 * Native aborts, SIGKILL and a blocked event loop still require an external monitor.
 */
export const exitCodes=Object.freeze({uncaught:70,unhandled:71,critical_stream:72,startup:73,shutdown_failure:74,shutdown_timeout:75});
let installed=false;

/** Install exactly once, at trusted composition before starting the service.
 * stopAdmission is synchronous; drain owns resources and obeys its cancellation.
 * No request, remote administration endpoint or caller-selected exit code is exposed.
 * @param {()=>void} stopAdmission @param {(signal:AbortSignal)=>Promise<void>} drain */
export function installProcessBoundary(stopAdmission,drain) {
  if(installed || typeof stopAdmission!=='function' || typeof drain!=='function' || process.hasUncaughtExceptionCaptureCallback() ||
    ['uncaughtException','uncaughtExceptionMonitor','unhandledRejection','SIGTERM','SIGINT'].some(event=>process.listenerCount(event)!==0)) throw new Error('Unsafe process-boundary configuration');
  installed=true;
  let stopping=false;
  async function shutdown() {
    const controller=new AbortController();
    const timer=setTimeout(()=>{try{controller.abort();}finally{process.exit(exitCodes.shutdown_timeout);}},5000);
    try {
      const result=stopAdmission();
      if(result!==undefined)process.exit(exitCodes.shutdown_failure);
      const work=drain(controller.signal);
      if(!(work instanceof Promise))process.exit(exitCodes.shutdown_failure);
      await work;
      process.exit(controller.signal.aborted ? exitCodes.shutdown_timeout : 0);
    } catch {process.exit(exitCodes.shutdown_failure);}
    finally {clearTimeout(timer);}
  }
  async function beginShutdown() {
    if(stopping)return;
    stopping=true;
    await shutdown();
  }
  // Explicitly owned shutdown task; it catches every failure and terminates.
  function onSignal() { return beginShutdown(); }
  process.on('SIGTERM',onSignal);process.on('SIGINT',onSignal);
  process.on('uncaughtException',(_error,origin)=>process.exit(origin==='unhandledRejection'?exitCodes.unhandled:exitCodes.uncaught));
  process.on('unhandledRejection',()=>process.exit(exitCodes.unhandled));
  return Object.freeze({
    shutdown:beginShutdown,
    stopping:()=>stopping,
    startupFailure:()=>process.exit(exitCodes.startup),
    /** Only explicitly critical internal streams belong here. Request/provider
     * socket errors are ordinary adapter outcomes, not process-fatal events.
     * @param {import('node:events').EventEmitter} stream */
    watchCriticalStream(stream) {
      const fail=()=>process.exit(exitCodes.critical_stream);
      stream.on('error',fail);
      return ()=>{stream.removeListener('error',fail);};
    },
  });
}
