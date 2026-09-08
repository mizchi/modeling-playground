import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';
import { createDog, DOG } from '../models/dog/src/model.ts';
import { dogClips } from '../models/dog/src/motion.ts';
import { exportGlb } from '../modeling/export-glb.ts';

test('dog is a compact, single-draw-call skinned low-poly character', () => {
  const root = createDog(), meshes = []; root.traverse(n => { if(n.isMesh) meshes.push(n); });
  assert.equal(meshes.length, 1);
  const mesh = meshes[0], g = mesh.geometry;
  assert.ok(mesh.isSkinnedMesh); assert.equal(mesh.skeleton.bones.length, 17);
  assert.ok(!Array.isArray(mesh.material)); assert.equal(mesh.material.map, null);
  assert.ok(g.index.count / 3 <= DOG.triangleBudget);
  assert.ok(g.attributes.position.count < g.index.count * .65, 'Share vertices instead of exporting triangle soup');
  assert.ok(g.attributes.color.array instanceof Uint8Array);
  assert.ok(g.attributes.skinWeight.array instanceof Uint8Array);
  assert.ok(g.attributes.skinWeight.normalized);
  assert.ok(!g.attributes.normal, 'Flat normals are derived by the renderer, not stored redundantly');
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++) {
    assert.ok(new Vector3().fromBufferAttribute(p,i).toArray().every(Number.isFinite));
    const weights=g.attributes.skinWeight.array.slice(i*4,i*4+4);
    assert.equal(weights.reduce((a,b)=>a+b),255);
  }
  const a=new Vector3(),b=new Vector3(),c=new Vector3();
  for(let i=0;i<g.index.count;i+=3) {
    a.fromBufferAttribute(p,g.index.getX(i)); b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));
    assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-9, 'No degenerate faces');
  }
});

function verifyRig(root, clips) {
  let mesh;root.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});
  const mixer=new AnimationMixer(root);mixer.clipAction(clips.find(c=>c.name==='Idle')).play();
  const p=mesh.geometry.attributes.position, point=new Vector3();let first,last;
  for(let frame=0;frame<=32;frame++) {
    mixer.setTime(clips[0].duration*frame/32);root.updateMatrixWorld(true);mesh.skeleton.update();
    const snapshot=[];
    for(let i=0;i<p.count;i++) {
      mesh.getVertexPosition(i,point);assert.ok(point.toArray().every(Number.isFinite));
      assert.ok(point.y>=-.002,'Idle keeps all four paws above the floor');snapshot.push(...point);
    }
    if(frame===0)first=snapshot;if(frame===32)last=snapshot;
  }
  first.forEach((v,i)=>assert.ok(Math.abs(v-last[i])<1e-5));
  mixer.stopAllAction();root.updateMatrixWorld(true);mesh.skeleton.update();
  // The leg rig must move actual weighted vertices, not just decorative bones.
  const leg=root.getObjectByName('FrontLeftLower');assert.ok(leg);
  const before=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()));
  leg.rotation.x=.3;root.updateMatrixWorld(true);mesh.skeleton.update();
  assert.ok(before.some((v,i)=>v.distanceTo(mesh.getVertexPosition(i,point))>.02));
}

test('dog idle loops and the four-leg rig moves actual geometry',()=>verifyRig(createDog(),dogClips()));

test('delivered dog GLB is small, deterministic, portable and keeps its rig',async()=>{
  const bytes=await readFile(new URL('../models/dog/output/dog.glb',import.meta.url));
  assert.ok(bytes.length<=DOG.byteBudget, `${bytes.length} bytes exceeds the 32 KiB budget`);
  assert.deepEqual(bytes,Buffer.from(await exportGlb(createDog(),dogClips())));
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.materials.length,1);assert.equal(json.meshes.length,1);assert.ok(!json.images);
  assert.ok(!json.extensionsRequired?.length,'No extra decoder needed');
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let mesh;loaded.scene.traverse(n=>{if(n.isMesh)mesh=n;});
  assert.equal(mesh.material.flatShading,true,'A standard GLB reload must retain the faceted look without stored normals');
  verifyRig(loaded.scene,loaded.animations);
});
