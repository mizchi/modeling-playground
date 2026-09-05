import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';
import { solveTwoBone, IKPose } from '../viewer/ik.mjs';

const v = (x,y,z) => new Vector3(x,y,z);
test('unrelated models and incomplete IK metadata do not enable the editor', () => {
  const model=new Group();
  assert.equal(IKPose.fromModel(model),null);
  for(const spec of [{version:1,coordinateSystem:'gltf-y-up',chains:[]},
    {version:1,coordinateSystem:'gltf-y-up',hips:'Hips',chains:[{id:'x',pole:[0,0]}]}]) {
    model.userData.ikRig=JSON.stringify(spec);
    assert.equal(IKPose.fromModel(model),null);
  }
});
test('two-bone IK reaches its target, preserves lengths and follows the pole', () => {
  for (const pole of [v(0,1,0),v(0,-1,0),v(0,0,1)]) {
    const result=solveTwoBone(v(0,0,0),v(1.2,0,0),pole,1,1);
    assert.ok(Math.abs(result.joint.length()-1)<1e-6);
    assert.ok(Math.abs(result.end.distanceTo(result.joint)-1)<1e-6);
    assert.ok(result.end.distanceTo(v(1.2,0,0))<1e-6);
    assert.ok(result.joint.dot(pole)>0);
  }
});
test('unreachable and degenerate targets stay finite without stretching', () => {
  for (const target of [v(10,0,0),v(0,0,0),v(.01,0,0)]) {
    const result=solveTwoBone(v(0,0,0),target,v(1,0,0),1,.5);
    assert.ok([...result.joint,...result.end].every(Number.isFinite));
    assert.ok(Math.abs(result.joint.length()-1)<1e-5);
    assert.ok(Math.abs(result.end.distanceTo(result.joint)-.5)<1e-5);
    assert.ok(result.clamped);
  }
});
test('IK asset is valid and hands/feet follow targets while crouching keeps feet planted', async () => {
  const bytes=await readFile(new URL('../output/traveler-ik.glb',import.meta.url));
  const report=await validator.validateBytes(new Uint8Array(bytes),{uri:'traveler-ik.glb',maxIssues:20});
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const pose=IKPose.fromModel(asset.scene);
  assert.ok(pose);
  assert.equal(pose.chains.length,4);
  const feet=pose.chains.filter(c=>c.id.includes('Foot'));
  const initialFeet=feet.map(c=>c.end.getWorldPosition(new Vector3()));
  const vertices=()=>{
    const points=[];
    asset.scene.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      mesh.skeleton.update();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
        const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
        assert.ok([...p].every(Number.isFinite));
        points.push(p);
      }
    });
    return points;
  };
  const initialVertices=vertices();
  pose.targets.hips.y-=.12;
  pose.solve();
  for(let i=0;i<feet.length;i++) assert.ok(feet[i].end.getWorldPosition(new Vector3()).distanceTo(initialFeet[i])<.002);
  assert.ok(vertices().some((point,i)=>point.distanceTo(initialVertices[i])>.05));
  const arm=pose.chains.find(c=>c.id==='leftHand');
  pose.targets.leftHand.add(v(-.025,.13,.05));
  pose.solve();
  assert.ok(arm.end.getWorldPosition(new Vector3()).distanceTo(pose.targets.leftHand)<.002);
  const elbow=arm.lower.getWorldPosition(new Vector3());
  pose.targets.leftHandPole.z+=.5;
  pose.solve();
  assert.ok(arm.lower.getWorldPosition(new Vector3()).distanceTo(elbow)>.005);
  assert.ok(arm.end.getWorldPosition(new Vector3()).distanceTo(pose.targets.leftHand)<.002);
  pose.mode='FK';
  pose.fk.LeftUpperArm=v(.2,0,0);
  pose.solve();
  assert.ok(arm.end.getWorldPosition(new Vector3()).distanceTo(pose.targets.leftHand)>.01);
  pose.reset();
  for(let i=0;i<feet.length;i++) assert.ok(feet[i].end.getWorldPosition(new Vector3()).distanceTo(initialFeet[i])<.002);
});
