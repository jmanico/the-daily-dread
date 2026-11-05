/** @typedef {{bytes:number,depth:number,entries:number,timeMs:number}} ParserLimits */
const ceilings = Object.freeze({ bytes: 10 * 1024 * 1024, depth: 64, entries: 100000, timeMs: 2000 });
/** Code-owned composition only. Never accept limits from a document or request.
 * @param {unknown} [input] @returns {Readonly<ParserLimits>} */
export function parserLimits(input = {}) {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error('Invalid parser limits');
  const keys = Reflect.ownKeys(input);
  if (keys.some(key => typeof key !== 'string' || !Object.hasOwn(ceilings, key))) throw new Error('Invalid parser limits');
  /** @type {ParserLimits} */
  const result = { bytes: ceilings.bytes, depth: ceilings.depth, entries: ceilings.entries, timeMs: ceilings.timeMs };
  for (const key of /** @type {(keyof ParserLimits)[]} */ (Object.keys(ceilings))) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor) continue;
    const value = descriptor.value;
    if (!Object.hasOwn(descriptor, 'value') || !Number.isSafeInteger(value) || value < 1 || value > ceilings[key]) throw new Error('Invalid parser limits');
    result[key] = value;
  }
  return Object.freeze(result);
}
