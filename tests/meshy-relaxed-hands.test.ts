import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relaxHandPoint,relaxHandNormal} from '../human/models/lumi-meshy-v2/src/relax-hands.ts';

test('relaxed hand preserves wrist/palm and gently curls fingertips toward the palm',()=>{
  for(const point of [[0,0,0],[.025,.005,0],[.05,-.004,-.02]])assert.deepEqual(relaxHandPoint(point),point);
  const tip=relaxHandPoint([.16,0,0]);
  assert.ok(tip[0]>.1&&tip[0]<.16);assert.ok(tip[1]<-.04&&tip[1]>-.09);assert.equal(tip[2],0);
  const thumb=relaxHandPoint([.075,0,.07]);assert.ok(thumb[1]<0);assert.ok(thumb[2]<.07);
});
test('curl remains continuous at finger roots and keeps transformed normals normalized',()=>{
  const a=relaxHandPoint([.065-1e-7,0,0]),b=relaxHandPoint([.065+1e-7,0,0]);
  assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6);
  const n=relaxHandNormal([.16,0,0],[0,1,0]);assert.ok(Math.abs(Math.hypot(...n)-1)<1e-6);assert.ok(n[0]>.8);
  assert.throws(()=>relaxHandPoint([NaN,0,0]));
});
