import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { computeQuadNormals } from '../modeling/quad-normals.mjs';

const geometry=()=>{
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute([0,0,0,4,0,0,4,4,0,0,4,0,0,0,1,0,4,1,0,0,0],3));
  return g;
};

test('quad shading is angle weighted, not dominated by large adjoining patches or triangle diagonals',()=>{
  const g=geometry(),faces=[[0,1,2,3],[0,3,5,4]];
  computeQuadNormals(g,faces);
  const n=g.attributes.normal;
  assert.ok(Math.abs(n.getX(0)-Math.SQRT1_2)<1e-6);
  assert.ok(Math.abs(n.getZ(0)-Math.SQRT1_2)<1e-6);
  const before=n.array.slice();g.setIndex([0,1,3,1,2,3,0,3,4,3,5,4]);
  computeQuadNormals(g,faces.map(f=>[...f.slice(1),f[0]]));
  assert.deepEqual(g.attributes.normal.array,before);g.dispose();
});

test('UV duplicates share normals while positions, weights and indices stay untouched',()=>{
  const g=geometry(),before=g.attributes.position.array.slice();g.setIndex([0,1,2]);
  const index=g.index.array.slice();
  computeQuadNormals(g,[[0,1,2,3],[6,3,5,4]],[0,1,2,3,4,5,0]);
  assert.deepEqual([...g.attributes.normal.array.slice(0,3)],[...g.attributes.normal.array.slice(18,21)]);
  assert.deepEqual(g.attributes.position.array,before);assert.deepEqual(g.index.array,index);
  assert.ok(g.attributes.normal.array.every(Number.isFinite));g.dispose();
});
