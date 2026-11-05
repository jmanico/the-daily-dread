import { setTimeout as wait } from 'node:timers/promises';

/** An explicitly owned async iterator: consume with for-await in the supervisor's
 * task. Startup and monotonic 30-second ticks ask the durable owner to reconcile
 * persisted due work; notifications are hints. No work or authority is in a tick.
 * A slow consumer never creates overlapping callbacks or an unbounded backlog.
 * @param {AbortSignal} signal */
export async function* recoveryWakeups(signal) {
  if(!(signal instanceof AbortSignal))throw new Error('Invalid recovery signal');
  let next=performance.now();
  while(!signal.aborted) {
    const remaining=next-performance.now();
    if(remaining>0) {
      try {await wait(remaining,undefined,{signal});}
      catch(error){if(signal.aborted)return;throw error;}
    }
    if(signal.aborted)return;
    yield undefined;
    next+=30000;
    // If the owned consumer was stalled, reconcile immediately once, then resume
    // the cadence. Do not build a queue of every tick missed while unavailable.
    if(next<performance.now())next=performance.now();
  }
}
