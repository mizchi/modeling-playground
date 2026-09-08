import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createBase45Topology } from '../models/base45.mjs';
import { relaxBase45Cheek } from '../models/base45-cheek.mjs';
import { base45FaceDepth } from '../models/base45-eyes.mjs';

test('painted face turns back toward the temples without recessing the eye beds',()=>{
  const setback=base45FaceDepth(.04,1.932)-base45FaceDepth(.17,1.932);
  assert.ok(setback>.04&&setback<.05,`Face setback ${setback} should form a rounded cross section`);
  const d=createBase45Topology();
  const ids=new Set(d.faces.flatMap((f,i)=>/Lid|Eye/.test(d.regions[i])?f:[]));
  for(const id of ids){
    const[x,y,z]=d.positions[id];
    assert.ok(Math.abs(z-base45FaceDepth(x,y))<.002,'Keep texture beds on the face, not inside eye sockets');
  }
});

test('lower lateral cheek and chin strips turn gradually instead of making a hard jaw band',()=>{
  const d=createBase45Topology(),edges=new Map();
  const normal=f=>{const[a,b,c]=f.map(i=>new Vector3(...d.positions[i]));return b.sub(a).cross(c.sub(a)).normalize();};
  d.faces.forEach((f,i)=>f.forEach((a,k)=>{
    const b=f[(k+1)%f.length],key=[a,b].sort((a,b)=>a-b).join();
    const e=edges.get(key)??{ids:[a,b],faces:[]};e.faces.push(i);edges.set(key,e);
  }));
  const seams=[...edges.values()].filter(e=>e.faces.every(i=>d.regions[i].includes('Contour'))&&e.ids.every(i=>{
    const[x,y,z]=d.positions[i];return x>.065&&y<1.94&&z>-.04;
  }));
  assert.ok(seams.length>=15);
  const turns=seams.map(e=>normal(d.faces[e.faces[0]]).angleTo(normal(d.faces[e.faces[1]]))*180/Math.PI);
  assert.ok(Math.max(...turns)<28,`Lateral jaw band turns ${Math.max(...turns).toFixed(2)} degrees`);
  assert.equal(d.positions.length,722);assert.equal(d.faces.length,720);
});

test('cheek relaxation preserves feature anchors, topology, weights, symmetry and rear neck',()=>{
  const d=createBase45Topology(),before=structuredClone(d),fixed=new Set();
  d.faces.forEach((f,i)=>{if(/Ear|Orbit|Lid|Eye/.test(d.regions[i]))f.forEach(id=>fixed.add(id));});
  relaxBase45Cheek(d);
  for(let i=0;i<d.positions.length;i++){
    const [x,y,z]=before.positions[i];
    if(fixed.has(i)||Math.abs(x)<=.055||y>=1.99||y<=1.748||z<=-.08)
      assert.deepEqual(d.positions[i],before.positions[i]);
  }
  for(const key of ['faces','weights','regions'])assert.deepEqual(d[key],before[key]);
  for(const[x,y,z]of d.positions)assert.ok(d.positions.some(p=>Math.hypot(p[0]+x,p[1]-y,p[2]-z)<1e-8));
});
