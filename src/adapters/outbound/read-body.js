import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createInflate } from 'node:zlib';

/** @typedef {ReturnType<typeof import('./retrieval-budget.js').createRetrievalBudget>} Budget */
/** @typedef {import('./retrieval-budget.js').BudgetFailure|'encoding'|'body'} BodyFailure */
/** Consume raw HTTP response-body bytes before any syntax parser. One supported
 * decoding stage only; unknown or stacked encodings fail closed. Every stream
 * belongs to this call and is destroyed on failure; streams are never reused.
 * @param {import('node:stream').Readable} source @param {unknown} encoding @param {Budget} budget
 * @returns {Promise<{kind:'body',body:Buffer}|{kind:'failed',reason:BodyFailure}>}
 */
export async function readBoundedBody(source,encoding,budget) {
  if (!['identity','gzip','deflate'].includes(/** @type {string} */(encoding))) {
    source.destroy();return {kind:'failed',reason:'encoding'};
  }
  /** @type {Buffer[]} */ const blocks=[];
  let current=Buffer.alloc(0),offset=0,length=0;
  const wire=new Transform({transform(chunk,_encoding,callback){
    if (!Buffer.isBuffer(chunk) || !budget.charge('wire',chunk.length)) {callback(new Error('Retrieval wire limit'));return;}
    budget.touchRead();callback(null,chunk);
  }});
  const sink=new Writable({write(chunk,_encoding,callback){
    if (!Buffer.isBuffer(chunk) || !budget.charge('decoded',chunk.length)) {callback(new Error('Retrieval decoded limit'));return;}
    // Pack tiny hostile chunks into fixed-size slabs: the metadata allocation
    // stays bounded too, rather than retaining one object per incoming byte.
    let position=0;
    while(position<chunk.length) {
      if (offset===current.length) {current=Buffer.alloc(Math.min(65536,budget.limits.decodedBytes-length));offset=0;blocks.push(current);}
      const count=Math.min(current.length-offset,chunk.length-position);
      chunk.copy(current,offset,position,position+count);
      offset+=count;position+=count;length+=count;
    }
    callback();
  }});
  const decoder=encoding==='gzip' ? createGunzip({chunkSize:16384}) : encoding==='deflate' ? createInflate({chunkSize:16384}) : undefined;
  budget.touchRead();
  try {
    if (decoder) await pipeline(source,wire,decoder,sink,{signal:budget.signal});
    else await pipeline(source,wire,sink,{signal:budget.signal});
    budget.signal.throwIfAborted();
    if (blocks.length) blocks[blocks.length-1]=current.subarray(0,offset);
    const body=Buffer.concat(blocks,length);
    if (!budget.check()) return {kind:'failed',reason:budget.snapshot().failure ?? 'body'};
    return {kind:'body',body};
  } catch {
    return {kind:'failed',reason:budget.snapshot().failure ?? 'body'};
  } finally {
    budget.endRead();source.destroy();wire.destroy();decoder?.destroy();sink.destroy();
  }
}
