import { constants } from 'node:fs';
import { lstat, realpath, mkdir, open, link, unlink } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { closedRecord } from '../contracts/http-results.js';
import { parseJSONTask } from '../workers/json-tasks.js';

const profile='local-workstation-v1',origin='http://127.0.0.1:4173';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** @typedef {{version:1,profile:string,origin:string,workspaceRef:string,actorRef:string,integrations:Readonly<{oidc:false,github:false,ai:false,delivery:false}>}} Manifest */
/** @param {unknown} input @returns {Readonly<Manifest>|null} */
export function localManifest(input) {
  if(!closedRecord(input,['version','profile','origin','workspaceRef','actorRef','integrations']) || input.version!==1 || input.profile!==profile || input.origin!==origin ||
    typeof input.workspaceRef!=='string' || !uuid.test(input.workspaceRef) || typeof input.actorRef!=='string' || !uuid.test(input.actorRef) || input.actorRef===input.workspaceRef ||
    !closedRecord(input.integrations,['oidc','github','ai','delivery']) || Object.values(input.integrations).some(value=>value!==false))return null;
  return Object.freeze({version:1,profile,origin,workspaceRef:input.workspaceRef,actorRef:input.actorRef,integrations:Object.freeze({oidc:false,github:false,ai:false,delivery:false})});
}
class WorkspaceFailure extends Error {
  /** @param {'invalid'|'unsafe'|'missing'|'incomplete'|'canceled'} kind */
  constructor(kind){super('Local workspace unavailable');this.kind=kind;}
}
/** @param {unknown} error @param {string} value */
function hasCode(error,value){return error instanceof Error && 'code' in error && error.code===value;}
/** @param {AbortSignal} signal */
function active(signal){if(signal.aborted)throw new WorkspaceFailure('canceled');}
/** Fixed OS-home-relative paths only. The composition boundary supplies OS userInfo,
 * never an HTTP claim or environment-selected home. Same-account/privileged host
 * compromise is outside this profile; these checks do not claim openat isolation.
 * @param {unknown} context @param {boolean} initialize @param {AbortSignal} signal
 * @returns {Promise<{kind:'ready',created:boolean,root:string,manifest:Readonly<Manifest>}|{kind:'invalid'|'unsafe'|'missing'|'incomplete'|'canceled'|'unavailable'}>} */
export async function prepareWorkspace(context,initialize,signal) {
  if(!closedRecord(context,['home','uid']) || typeof context.home!=='string' || context.home.length>2048 || context.home.includes('\0') || !isAbsolute(context.home) || resolve(context.home)!==context.home ||
    !Number.isSafeInteger(context.uid) || /** @type {number} */(context.uid)<=0 || typeof initialize!=='boolean' || !(signal instanceof AbortSignal))return {kind:'invalid'};
  const home=context.home,uid=/** @type {number} */(context.uid);
  /** @type {import('node:fs/promises').FileHandle|undefined} */let pending;
  const root=join(home,'Library','Application Support','The Daily Dread'),stage=join(root,'workspace.pending'),target=join(root,'workspace.json');
  try {
    active(signal);
    if(await realpath(home)!==home)throw new WorkspaceFailure('unsafe');
    let path=home;
    for(const segment of ['', 'Library','Application Support','The Daily Dread']) {
      if(segment)path=join(path,segment);
      active(signal);
      if(initialize && segment){try{await mkdir(path,{mode:0o700});}catch(error){if(!hasCode(error,'EEXIST'))throw error;}}
      const stat=await lstat(path);
      if(!stat.isDirectory() || stat.isSymbolicLink() || stat.uid!==uid || (stat.mode&0o022)!==0 || (path===root && (stat.mode&0o7777)!==0o700))throw new WorkspaceFailure('unsafe');
      if(await realpath(path)!==path)throw new WorkspaceFailure('unsafe');
    }
    active(signal);
    // A previous interrupted publication requires explicit recovery, not deletion.
    try{await lstat(stage);throw new WorkspaceFailure('incomplete');}catch(error){if(!hasCode(error,'ENOENT'))throw error;}
    try{return {kind:'ready',created:false,root,manifest:await readManifest(target,uid,signal)};}catch(error){if(!hasCode(error,'ENOENT'))throw error;}
    if(!initialize)throw new WorkspaceFailure('missing');
    active(signal);
    pending=await open(stage,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    const stat=await pending.stat();if(!stat.isFile() || stat.uid!==uid || (stat.mode&0o7777)!==0o600 || stat.nlink!==1)throw new WorkspaceFailure('unsafe');
    const manifest=localManifest({version:1,profile,origin,workspaceRef:randomUUID(),actorRef:randomUUID(),integrations:{oidc:false,github:false,ai:false,delivery:false}});
    if(!manifest)throw new WorkspaceFailure('invalid');
    await pending.writeFile(JSON.stringify(manifest)+'\n');await pending.sync();await pending.close();pending=undefined;
    active(signal);
    // link publishes complete bytes atomically and fails instead of overwriting.
    await link(stage,target);
    await unlink(stage);
    const directory=await open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try{await directory.sync();}finally{await directory.close();}
    active(signal);
    return {kind:'ready',created:true,root,manifest:await readManifest(target,uid,signal)};
  }catch(error){
    return {kind:error instanceof WorkspaceFailure?error.kind:hasCode(error,'ENOENT')?'missing':hasCode(error,'EEXIST')?'incomplete':'unavailable'};
  }finally{
    // Failed/interrupted staging is bounded and intentionally retained for recovery.
    // No attempt may remove an unknown pending file or roll back published identity.
    if(pending){try{await pending.close();}catch{return {kind:'unavailable'};}}
  }
}
/** @param {string} path @param {number} uid @param {AbortSignal} signal @returns {Promise<Readonly<Manifest>>} */
async function readManifest(path,uid,signal) {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const stat=await file.stat();
    if(!stat.isFile() || stat.uid!==uid || (stat.mode&0o7777)!==0o600 || stat.nlink!==1)throw new WorkspaceFailure('unsafe');
    if(stat.size>4096)throw new WorkspaceFailure('invalid');
    const buffer=Buffer.alloc(4097);let used=0;
    while(used<buffer.length){active(signal);const result=await file.read(buffer,used,buffer.length-used,used);if(!result.bytesRead)break;used+=result.bytesRead;}
    if(used>4096)throw new WorkspaceFailure('invalid');
    const raw=await parseJSONTask(buffer.subarray(0,used),{bytes:4096,depth:4,entries:64,timeMs:1000},signal,false);
    const manifest=localManifest(raw);if(!manifest)throw new WorkspaceFailure('invalid');
    active(signal);return manifest;
  }finally{await file.close();}
}
