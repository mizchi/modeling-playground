import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Euler } from 'three';
import { createProject, restPose, validateProject } from '../motion/contract.ts';
import { putKey, moveKey, deleteKey, samplePose, resizeClip, createMotionHistory, referenceTime } from '../motion/project.ts';
import { createHuman, disposeHuman } from '../human/model.ts';
import { presetRecipe } from '../human/contract.ts';
import { createMotionRig, capturePose, applyPose, compileClip } from '../motion/rig.ts';

test('motion JSON is strict, detached and rejects invalid times, bones and rotations', () => {
  const p = createProject();
  assert.equal(p.keys.length, 2);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  const next = validateProject(p); next.keys[0].pose.root[0] = 2;
  assert.equal(p.keys[0].pose.root[0], 0);
  for (const change of [
    p => p.version = 3,
    p => p.fps = 0,
    p => p.frames = Infinity,
    p => p.keys[1].frame = 0,
    p => p.keys[0].pose.rotations.Head = [0,0,0,0],
    p => p.keys[0].pose.rotations.Unknown = [0,0,0,1],
    p => delete p.keys[0].pose.rotations.Head,
    p => p.keys[0].pose.root[0] = NaN,
    p => p.reference = {name:'x',duration:2,in:2,out:1},
  ]) { const bad = structuredClone(p); change(bad); assert.throws(() => validateProject(bad)); }
});

test('keys overwrite, move without collisions, delete with undo; endpoints are protected', () => {
  let p = createProject(); const pose = restPose(); pose.hips[1] = -.1;
  p = putKey(p, 15, pose); p = putKey(p, 15, pose);
  assert.equal(p.keys.length, 3);
  p = moveKey(p, 15, 20); assert.equal(p.keys[1].frame, 20);
  assert.throws(() => moveKey(p, 20, p.frames));
  assert.throws(() => deleteKey(p, 0));
  const history = createMotionHistory(p);
  history.commit(deleteKey(p,20)); assert.equal(history.value.keys.length, 2);
  assert.equal(history.undo().keys.length, 3); assert.equal(history.redo().keys.length, 2);
  assert.throws(() => history.commit({...p,frames:0}));
  assert.equal(history.value.keys.length, 2);
});

test('sampling slerps rotations, lerps offsets and preserves the exact last frame', () => {
  let p = createProject(); const end = restPose();
  end.rotations.Head = new Quaternion().setFromEuler(new Euler(0,Math.PI/2,0)).toArray(); end.root[2] = 2;
  p = putKey(p,p.frames,end);
  const mid = samplePose(p,p.frames/2);
  assert.ok(new Quaternion(...mid.rotations.Head).angleTo(new Quaternion().setFromEuler(new Euler(0,Math.PI/4,0))) < 1e-6);
  assert.equal(mid.root[2],1); assert.deepEqual(samplePose(p,p.frames),end);
  const shorter = resizeClip(p,30);
  assert.equal(shorter.keys.at(-1).frame,30); assert.equal(shorter.keys.at(-1).pose.root[2],1);
  assert.equal(p.frames,60);
});

test('reference timeline is clip-local and clamps to the selected source interval', () => {
  const p = createProject(); p.reference = {name:'dance.mp4',duration:10,in:3,out:5};
  assert.equal(referenceTime(p,0),3); assert.equal(referenceTime(p,30),4); assert.equal(referenceTime(p,60),5);
  assert.equal(referenceTime(p,300),5);
});

test('shared male/female/lumi rigs support IK, relative positions and exported tracks', () => {
  for (const model of ['base45','base45-female','lumi']) {
    const root = createHuman(presetRecipe(model));
    try {
      const rig = createMotionRig(root), pose = restPose();
      assert.equal(rig.ik.chains.length,4);
      pose.hips[1] = -.05; applyPose(rig,pose);
      assert.ok(Math.abs(capturePose(rig).hips[1]+.05)<1e-8);
      rig.ik.capture(); rig.ik.targets.leftHand.z += .1; rig.ik.solve();
      assert.ok(Object.values(rig.ik.errors).every(e => e < .015));
      const clip = compileClip(createProject(),rig);
      assert.equal(clip.duration,2); assert.equal(clip.tracks.length,24);
      assert.equal(clip.tracks.find(t=>t.name==='Hips.position').values[1],Math.fround(rig.rest.Hips[1]));
    } finally { disposeHuman(root); }
  }
});
