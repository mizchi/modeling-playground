import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import validator from 'gltf-validator';
import { readFile } from 'node:fs/promises';
import { createBase45 } from '../models/base45.mjs';
import { createLumi } from '../models/lumi.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

test('LUMI preserves the accepted base positions, normals, weights and body rig',()=>{
  const base=createBase45().getObjectByName('BaseBody'),root=createLumi(),body=root.getObjectByName('BaseBody');
  for(const [i,source] of body.userData.sourceVertices.entries())for(const name of ['position','normal','skinIndex','skinWeight']) {
    const a=body.geometry.attributes[name],b=base.geometry.attributes[name];
    for(let k=0;k<a.itemSize;k++)assert.equal(a.array[i*a.itemSize+k],b.array[source*b.itemSize+k]);
  }
  assert.equal(body.skeleton.bones.length,22);
  assert.ok(body.material.map);assert.ok(body.geometry.attributes.uv);
  assert.equal(root.getObjectByName('LumiHairAnchor').parent.name,'HairSocket');
  assert.equal(root.getObjectByName('Hair').parent,root);
  const unchanged=createBase45().getObjectByName('BaseBody');assert.equal(unchanged.material.map,null);
});

test('independent fitted short hair has a cap, layered locks and a rigged ahoge',()=>{
  const root=createLumi(),hair=root.getObjectByName('Hair'),g=hair.geometry;
  assert.ok(hair.isSkinnedMesh);assert.ok(hair.skeleton.bones.some(b=>b.name==='LumiAhogeTip'));
  // Side/back overlap is now explicit geometry, rather than long flat sheets.
  assert.ok(g.index.count/3<1500,'Keep the short hair plus additional front locks locally budgeted');
  assert.ok(Math.min(...Array.from({length:g.attributes.position.count},(_,i)=>g.attributes.position.getY(i)))>=1.75,'Short cut must leave the neck exposed');
  assert.ok(hair.userData.capClearance>=.012);
  const target=hair.skeleton.bones.find(b=>b.name==='LumiSideLeftMid'),joint=hair.skeleton.bones.indexOf(target);
  const sample=Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>g.attributes.skinIndex.getX(i)===joint);
  assert.ok(Number.isInteger(sample));root.updateMatrixWorld(true);
  const at=()=>hair.applyBoneTransform(sample,new Vector3().fromBufferAttribute(g.attributes.position,sample));
  const before=at();target.rotation.x=.3;root.updateMatrixWorld(true);assert.ok(before.distanceTo(at())>.005);
  for(let i=0;i<g.attributes.position.count;i++)assert.ok(Number.isFinite(g.attributes.position.getX(i)));
});

test('hair volume surrounds the face in width and depth, not just a front silhouette',()=>{
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  const band=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i)).filter(v=>v.y>2.03&&v.y<2.17);
  const span=axis=>Math.max(...band.map(v=>v[axis]))-Math.min(...band.map(v=>v[axis]));
  assert.ok(span('x')>.57,`Side/crown volume too narrow: ${span('x')}`);
  assert.ok(span('z')>.50,`Front/back volume too shallow: ${span('z')}`);
});

test('temple locks hug the outer cheek instead of leaving a hollow frame',()=>{
  const root=createLumi(),hair=root.getObjectByName('Hair');root.updateMatrixWorld(true);
  for(const side of [-1,1])for(const [x,y] of [[.225,1.98],[.205,1.90]]) {
    const ray=new Raycaster(new Vector3(side*x,y,1),new Vector3(0,0,-1));
    const hit=ray.intersectObject(hair,false)[0];
    assert.ok(hit&&hit.point.z>.15&&hit.point.z<.26,`Missing close face-framing hair at ${side*x},${y}`);
  }
});

test('hair silhouette is fuller above the temples and tapers below the cheeks',()=>{
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  const width=(low,high)=>{
    const xs=Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)>=low&&p.getY(i)<=high).map(i=>p.getX(i));
    return Math.max(...xs)-Math.min(...xs);
  };
  const crown=width(2.06,2.26),lower=width(1.70,1.86);
  assert.ok(lower<crown*.86,`Lower sides should taper: ${lower} vs crown ${crown}`);
  assert.ok(lower>.38,'Keep room for the accepted head, rather than scaling the entire hair down');
});

test('swept fringe leaves both painted pupils visible from the front',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.102,.102]) {
    const ray=new Raycaster(new Vector3(x,1.932,1),new Vector3(0,0,-1));
    const hit=ray.intersectObjects([root.getObjectByName('Hair'),root.getObjectByName('BaseBody')],false)[0];
    assert.equal(hit?.object.name,'BaseBody');
  }
});

test('lower forehead remains visible below the added front locks',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.10,.06]) {
    const ray=new Raycaster(new Vector3(x,1.975,1),new Vector3(0,0,-1));
    const hit=ray.intersectObjects([root.getObjectByName('Hair'),root.getObjectByName('BaseBody')],false)[0];
    assert.equal(hit?.object.name,'BaseBody',`Fringe gap at ${x} must reveal the forehead`);
  }
});

test('additional front locks cover the former straight forehead boundary',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.10,.06]) {
    const hit=new Raycaster(new Vector3(x,2.055,1),new Vector3(0,0,-1)).intersectObject(root.getObjectByName('Hair'),false)[0];
    assert.ok(hit&&hit.point.z>.255,`Missing raised fringe lock over the old boundary at ${x}`);
  }
});

test('upper fringe keeps its own convex volume instead of sinking into the skull cap',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.08,.08]) {
    const hit=new Raycaster(new Vector3(x,2.20,1),new Vector3(0,0,-1)).intersectObject(root.getObjectByName('Hair'),false)[0];
    assert.ok(hit&&hit.point.z>.20&&hit.point.z<.29,`Upper fringe depth at ${x}: ${hit?.point.z}`);
  }
});

test('LUMI is deterministic and exports an embedded face texture and both skeletons',async()=>{
  const bytes=Buffer.from(await exportGlb(createLumi()));
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(json.skins.length,2);assert.equal(json.images.length,1);assert.ok(Number.isInteger(json.images[0].bufferView));
  assert.deepEqual(bytes,await readFile(new URL('../output/lumi.glb',import.meta.url)));
  assert.ok(bytes.length<180*1024);
});
