import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

/** One cancelable resolver per connection; no cached/preflight result followed by
 * an independent socket lookup. The socket layer receives only validated IPs.
 * @param {string} hostname @param {AbortSignal} signal
 * @returns {Promise<unknown>}
 */
export async function resolveDestination(hostname,signal) {
  signal.throwIfAborted();
  if (isIP(hostname)) return [hostname];
  const resolver = new Resolver({timeout:5000,tries:1});
  const cancel = () => resolver.cancel();
  signal.addEventListener('abort',cancel,{once:true});
  try {
    const answers = await Promise.allSettled([resolver.resolve4(hostname),resolver.resolve6(hostname)]);
    signal.throwIfAborted();
    /** @type {string[]} */ const addresses=[];
    for (const answer of answers) {
      if (answer.status === 'fulfilled') addresses.push(...answer.value);
      else if (!answer.reason || !['ENODATA','ENOTFOUND'].includes(answer.reason.code)) throw new Error('Destination resolution failed');
    }
    return addresses;
  } finally { signal.removeEventListener('abort',cancel); }
}
