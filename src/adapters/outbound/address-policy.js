import { BlockList, isIP } from 'node:net';

// IANA special-purpose registries reviewed 2026-11-05. Special-purpose exceptions
// are deliberately not authorized for ordinary source/provider retrieval.
const denied4 = new BlockList();
/** @type {[string,number][]} */
const ipv4Ranges = [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
  ['192.31.196.0',24],['192.52.193.0',24],['192.88.99.0',24],['192.168.0.0',16],
  ['192.175.48.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4],
];
for (const [address,prefix] of ipv4Ranges) denied4.addSubnet(address,prefix,'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::',3,'ipv6');
const denied6 = new BlockList();
/** @type {[string,number][]} */
const ipv6Ranges = [['2001::',23],['2001:db8::',32],['2002::',16],['2620:4f:8000::',48],['3ffe::',16],['3fff::',20]];
for (const [address,prefix] of ipv6Ranges) denied6.addSubnet(address,prefix,'ipv6');

/** Address syntax and subnet interpretation belong to Node, not a custom IP parser.
 * @param {unknown} address
 */
export function isPublicAddress(address) {
  if (typeof address !== 'string' || address.length > 45 || address.includes('%')) return false;
  const family = isIP(address);
  if (family === 4) return !denied4.check(address,'ipv4');
  return family === 6 && global6.check(address,'ipv6') && !denied6.check(address,'ipv6');
}

/** @param {string} expected @param {string | undefined} actual */
export function samePublicAddress(expected, actual) {
  if (!isPublicAddress(expected) || !isPublicAddress(actual) || !actual) return false;
  const exact = new BlockList();
  exact.addAddress(expected,isIP(expected) === 4 ? 'ipv4' : 'ipv6');
  return exact.check(actual,isIP(actual) === 4 ? 'ipv4' : 'ipv6');
}
