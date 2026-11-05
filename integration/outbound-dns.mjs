import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDestination} from '../src/adapters/outbound/resolve-destination.js';
import {isPublicAddress} from '../src/adapters/outbound/address-policy.js';

test('selected Linux runtime resolves the existing approved GitHub advisory host with native DNS',async()=>{
  const answers=await resolveDestination('api.github.com',AbortSignal.timeout(5000));
  assert.ok(Array.isArray(answers) && answers.length>0 && answers.length<=16 && answers.every(isPublicAddress));
});
