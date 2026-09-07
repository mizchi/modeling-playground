import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer, Matrix3, Vector3 } from 'three';
import { presetRecipe, validateRecipe } from '../human/contract.mjs';
import { createHuman, disposeHuman, exportRig } from '../human/model.mjs';
import { createMotions } from '../human/motion.mjs';
import { createBase45Topology } from '../models/base45.mjs';
import { validateBaseTopology } from '../contracts/base-topology.mjs';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { exportGlb } from '../scripts/export_glb.mjs';

test('female base is a neutral compatible preset, not a replacement for existing models',()=>{
  const r=presetRecipe('base45-female');assert.equal(r.hair,'none');assert.equal(r.face,'clay');
  assert.deepEqual(validateRecipe(JSON.parse(JSON.stringify(r))),r);
  const male=createHuman(presetRecipe('base45')),female=createHuman(r),m=male.getObjectByName('BaseBody').geometry,f=female.getObjectByName('BaseBody').geometry;
  assert.equal(f.attributes.position.count,662);assert.deepEqual(f.index.array,m.index.array);
  assert.deepEqual(f.attributes.skinWeight.array,m.attributes.skinWeight.array);
  assert.deepEqual(f.attributes.skinIndex.array,m.attributes.skinIndex.array);
  for(let i=0;i<m.attributes.position.count;i++)if(m.attributes.position.getY(i)>=1.65)for(const axis of ['getX','getY','getZ'])assert.equal(f.attributes.position[axis](i),m.attributes.position[axis](i),'Preserve head and neck');
  disposeHuman(male);disposeHuman(female);
});

test('female proportions narrow shoulders and waist and give the pelvis and torso depth',()=>{
  const roots=['base45','base45-female'].map(id=>createHuman(presetRecipe(id)));
  const [m,f]=roots.map(root=>root.getObjectByName('BaseBody').geometry.attributes.position);
  const width=(p,y,t=.015)=>Math.max(...Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(m.getY(i)-y)<t&&Math.abs(m.getX(i))<.28).map(i=>Math.abs(p.getX(i))))*2;
  assert.ok(width(f,1.535)<width(m,1.535)*.94);assert.ok(width(f,1.24)<width(m,1.24)*.9);
  assert.ok(width(f,1.025)>width(m,1.025)*1.07);
  const chest=Array.from({length:m.count},(_,i)=>i).filter(i=>m.getY(i)>1.39&&m.getY(i)<1.48&&m.getZ(i)>.10&&Math.abs(m.getX(i))>.04);
  assert.ok(chest.some(i=>f.getZ(i)-m.getZ(i)>.02),'Chest volume must exist in profile, not just a front silhouette');
  const hips=Array.from({length:m.count},(_,i)=>i).filter(i=>m.getY(i)>1&&m.getY(i)<1.12&&m.getZ(i)<-.10);
  assert.ok(hips.some(i=>f.getZ(i)<m.getZ(i)-.015));
  assert.ok(exportRig(roots[1]).bones.find(b=>b.name==='LeftUpperArm').position[0]<.27);
  roots.forEach(disposeHuman);
});

test('female mesh stays closed and skinned at rest and during shared motions',()=>{
  const root=createHuman(presetRecipe('base45-female')),mesh=root.getObjectByName('BaseBody'),d=createBase45Topology();
  const p=mesh.geometry.attributes.position;d.positions=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);validateBaseTopology(d);
  root.updateMatrixWorld(true);mesh.skeleton.update();
  for(let i=0;i<p.count;i++) {
    const v=new Vector3().fromBufferAttribute(p,i);assert.ok(mesh.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-6);
  }
  const normal=points=>points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
  const mixer=new AnimationMixer(root);
  for(const clip of createMotions(root)) {
    mixer.stopAllAction();mixer.clipAction(clip).play();
    for(let t=0;t<clip.duration;t+=.25) {
      mixer.setTime(t);root.updateMatrixWorld(true);mesh.skeleton.update();
      const frames=mesh.skeleton.bones.map((b,i)=>new Matrix3().setFromMatrix4(b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i])));
      for(const f of d.faces)for(const ids of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]) {
        const rest=ids.map(i=>new Vector3(...d.positions[i]));
        const posed=rest.map((v,k)=>mesh.applyBoneTransform(ids[k],v.clone())),rn=normal(rest),pn=normal(posed);
        const expected=new Vector3();for(const i of ids)for(const [name,w] of d.weights[i])expected.addScaledVector(rn.clone().applyMatrix3(frames[mesh.skeleton.bones.findIndex(b=>b.name===name)]),w/3);
        assert.ok(posed.every(v=>v.toArray().every(Number.isFinite)));
        assert.ok(pn.length()/rn.length()>.1,`Collapsed face in ${clip.name}`);
        assert.ok(pn.dot(expected)>0,`Flipped face in ${clip.name}`);
      }
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);disposeHuman(root);
});

test('female accepts LUMI hair and face plus facial edits without moving the hair envelope',()=>{
  const r=presetRecipe('base45-female');r.hair='lumi-short';r.face='lumi';
  const female=createHuman(r),lumi=createHuman(presetRecipe('lumi'));
  assert.deepEqual(female.getObjectByName('Hair').geometry.attributes.position.array,lumi.getObjectByName('Hair').geometry.attributes.position.array);
  assert.ok(female.getObjectByName('BaseBody').material.map);
  r.shape.noseHeight=.5;r.shape.eyeSpacing=-.5;const edited=createHuman(r);
  assert.ok(edited.getObjectByName('BaseBody').geometry.attributes.position.array.every(Number.isFinite));
  [female,lumi,edited].forEach(disposeHuman);
});

test('delivered female GLB and quad source match the independent preset and validate',async()=>{
  const root=createHuman(presetRecipe('base45-female'));
  const bytes=await readFile(new URL('../output/human-female.glb',import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(root)));
  const report=await validateBytes(bytes);assert.equal(report.issues.numErrors,0);
  const d=JSON.parse(await readFile(new URL('../output/human-female.topology.json',import.meta.url),'utf8'));validateBaseTopology(d);
  assert.equal(d.faces.length,660);assert.equal(d.bones.length,22);assert.deepEqual(d.bones,exportRig(root).bones);
  const p=root.getObjectByName('BaseBody').geometry.attributes.position;
  assert.deepEqual(d.positions,Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]));
  disposeHuman(root);
});
