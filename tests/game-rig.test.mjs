import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createStrix } from '../models/strix.mjs';
import { strixPose } from '../models/strix-motion.mjs';
import { PilotAnimator } from '../game/animation.ts';
import { createPilot } from '../game/simulation.ts';

test('waist, head and weapons keep facing the focus point during strafe, reverse and boost',()=>{
  const {root,bones}=createStrix(),animator=new PilotAnimator(root);
  const state=createPilot(),focus=[-8,3,30];
  for(const velocity of [[-3.2,0,0],[0,0,-3.2],[0,0,14.4]]) {
    state.velocity=velocity;state.boostWeight=velocity[2]>10?1:0;
    for(let i=0;i<120;i++){state.gaitTime+=1/60;animator.update(state,focus,1/60);}
    root.updateMatrixWorld(true);
    for(const name of ['Torso','Head','LeftCannon','RightCannon','RightHand']) {
      const bone=bones[name],wanted=new Vector3(...focus).sub(bone.getWorldPosition(new Vector3())).normalize();
      const forward=new Vector3(0,0,1).transformDirection(bone.matrixWorld);
      assert.ok(forward.dot(wanted)>.99999,`${name} points at focus, not travel`);
    }
    if(velocity[0]!==0)assert.ok(Math.abs(bones.Torso.quaternion.y)>.1,'The waist actually turns relative to the chassis while strafing');
  }
});

test('opposite travel directions fit the same chassis axis, including exact sideways ties',()=>{
  for(const yaw of [0,Math.PI/4,Math.PI/2,3*Math.PI/4,-Math.PI/2]) {
    const rigs=[createStrix(),createStrix()],animators=rigs.map(r=>new PilotAnimator(r.root));
    const states=[createPilot(),createPilot()];
    states[0].velocity=[Math.sin(yaw)*3.2,0,Math.cos(yaw)*3.2];
    states[1].velocity=states[0].velocity.map(v=>-v);
    for(let i=0;i<120;i++)for(let j=0;j<2;j++)animators[j].update(states[j],[0,3,30],1/60);
    assert.ok(rigs[0].root.quaternion.angleTo(rigs[1].root.quaternion)<1e-7,`Same axis for yaw ${yaw} and its reverse`);
    assert.ok(Math.abs(rigs[0].root.rotation.y)<=Math.PI/2+1e-8,'Fit with at most a quarter turn');
  }
});

test('forward/reverse and right/left switches never turn the chassis around, and idle holds its axis',()=>{
  for(const velocity of [[0,0,3.2],[-3.2,0,0],[0,0,14.4]]) {
    const {root}=createStrix(),animator=new PilotAnimator(root),state=createPilot();
    state.velocity=velocity;state.boostWeight=Math.abs(velocity[2])>10?1:0;
    for(let i=0;i<180;i++)animator.update(state,[0,3,30],1/60);
    const before=root.quaternion.clone();
    state.velocity=velocity.map(v=>-v);
    for(let i=0;i<180;i++) {
      animator.update(state,[0,3,30],1/60);
      assert.ok(root.quaternion.angleTo(before)<1e-7,'No reversal spin at any frame');
    }
    state.velocity=[0,0,0];state.yaw=Math.PI;
    for(let i=0;i<120;i++)animator.update(state,[0,3,30],1/60);
    assert.ok(root.quaternion.angleTo(before)<1e-7,'Stopping or looking around does not turn the leg base');
  }
});

test('reverse walking subtracts phase increments without reflecting the whole accumulated phase',()=>{
  const {root,bones}=createStrix(),animator=new PilotAnimator(root),state=createPilot();
  state.velocity=[0,0,3.2];
  for(let i=0;i<180;i++)animator.update(state,[0,3,30],1/60);
  state.gaitTime=.37;animator.update(state,[0,3,30],1/60);
  const before=bones.FrontLeftUpper.quaternion.clone();
  state.velocity=[0,0,-3.2];animator.update(state,[0,3,30],0);
  assert.ok(bones.FrontLeftUpper.quaternion.angleTo(before)<1e-7,'Direction switch alone does not jump the pose');
  state.gaitTime+=.07;animator.update(state,[0,3,30],1/60);
  const expected=new Quaternion().setFromEuler(new Euler(...strixPose('Walk',.30).rotations.FrontLeftUpper));
  assert.ok(bones.FrontLeftUpper.quaternion.angleTo(expected)<1e-7,'Walk backward from the existing phase');
});

test('resetting the pilot also resets its fitted axis and signed gait phase',()=>{
  const {root,bones}=createStrix(),animator=new PilotAnimator(root),state=createPilot();
  state.velocity=[-3.2,0,0];
  for(let i=0;i<120;i++){state.gaitTime+=1/60;animator.update(state,[0,3,30],1/60);}
  assert.ok(Math.abs(root.rotation.y)>1);
  animator.update(createPilot(),[0,3,30],1/60);
  assert.equal(root.rotation.y,0);
  const idle=new Quaternion().setFromEuler(new Euler(...strixPose('Idle',0).rotations.FrontLeftUpper));
  assert.ok(bones.FrontLeftUpper.quaternion.angleTo(idle)<1e-7);
});

test('vertical jump motion holds the fitted leg axis while the upper body keeps aiming',()=>{
  const {root,bones}=createStrix(),animator=new PilotAnimator(root),state=createPilot(),focus=[10,8,30];
  state.velocity=[-3.2,0,0];
  for(let i=0;i<180;i++)animator.update(state,focus,1/60);
  const axis=root.rotation.y;state.velocity=[0,7.5,0];state.grounded=false;state.position[1]=10;
  for(let i=0;i<120;i++)animator.update(state,focus,1/60);
  assert.equal(root.rotation.y,axis);
  const wanted=new Vector3(...focus).sub(bones.Torso.getWorldPosition(new Vector3())).normalize();
  assert.ok(new Vector3(0,0,1).transformDirection(bones.Torso.matrixWorld).dot(wanted)>.99999);
});

test('aiming a loaded GLB clone changes neither cached bones, locomotion joints nor simulation state',async()=>{
  const bytes=await readFile(new URL('../output/strix.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=clone(scene),animator=new PilotAnimator(root),state=createPilot();
  state.velocity=[0,0,14.4];state.boostWeight=1;
  const original=structuredClone(state),cached=scene.getObjectByName('Torso').quaternion.clone();
  animator.update(state,[20,5,10],.1);
  const joints=['Hull','FrontLeftUpper','FrontLeftLower','RearRightFoot'];
  const before=joints.map(name=>root.getObjectByName(name).quaternion.clone());
  const focus=[-20,8,10];animator.update(state,focus,0);
  for(const [i,name] of joints.entries())assert.deepEqual(root.getObjectByName(name).quaternion.toArray(),before[i].toArray());
  const torso=root.getObjectByName('Torso');
  assert.ok(new Vector3(0,0,1).transformDirection(torso.matrixWorld)
    .dot(new Vector3(...focus).sub(torso.getWorldPosition(new Vector3())).normalize())>.99999);
  assert.deepEqual(scene.getObjectByName('Torso').quaternion.toArray(),cached.toArray());
  assert.deepEqual(state,original);
  assert.deepEqual(root.position.toArray(),state.position);
  assert.equal(root.getObjectByName('Motion').position.z,0,'No extra boost root travel');
});
