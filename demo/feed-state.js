import { closedRecord } from '../src/contracts/http-results.js';
import { snapshot } from './live-model.js';
/** @typedef {{state:'checking'|'live'|'stale'|'paused',checkedAt:string|null,nextCheckAt:string|null,data:NonNullable<ReturnType<typeof snapshot>>|null,omitted:number}} FeedState */
/** @param {unknown} value */
const stamp=value=>value===null || typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
/** @param {unknown} value @returns {FeedState|null} */
export function feedState(value) {
  if(!closedRecord(value,['state','checkedAt','nextCheckAt','data','omitted']) || !['checking','live','stale','paused'].includes(/** @type {string} */(value.state)) || !stamp(value.checkedAt) || !stamp(value.nextCheckAt) || !Number.isSafeInteger(value.omitted) || /** @type {number} */(value.omitted)<0 || /** @type {number} */(value.omitted)>30)return null;
  if(value.data!==null && !closedRecord(value.data,['retrievedAt','items','rejected'],['retrievedAt','items']))return null;
  const data=value.data===null?null:snapshot(value.data);
  if(value.data!==null && (!data || data.rejected!==0) || value.state==='live' && (!data || value.checkedAt===null) || value.state==='paused' && value.nextCheckAt!==null)return null;
  return {state:/** @type {FeedState['state']} */(value.state),checkedAt:/** @type {string|null} */(value.checkedAt),nextCheckAt:/** @type {string|null} */(value.nextCheckAt),data,omitted:/** @type {number} */(value.omitted)};
}
