import test from 'node:test';
import assert from 'node:assert/strict';
import { compactMesh } from '../modeling/compact-mesh.mjs';

test('optional corner UVs split seams without changing legacy palette geometry',()=>{
  const points=[[0,0,0],[1,0,0],[0,1,0]],faces=[[0,1,2]];
  const plain=compactMesh(['Root']);plain.surface(points,faces,'#ffffff','Root');
  assert.equal(plain.finish().attributes.uv,undefined);
  const mapped=compactMesh(['Root']);
  mapped.surface(points,faces,'#ffffff','Root',[[0,0],[1,0],[0,1]]);
  mapped.surface(points,faces,'#ffffff','Root',[[1,1],[1,0],[0,1]]);
  const g=mapped.finish();assert.equal(g.attributes.position.count,4);
  assert.equal(g.attributes.uv.count,4);
  const first=g.index.getX(0),seam=g.index.getX(3);
  assert.notEqual(first,seam);
  assert.equal(g.attributes.uv.getX(first),0);assert.equal(g.attributes.uv.getX(seam),1);
  assert.equal(g.attributes.skinWeight.getX(seam),1);
});
