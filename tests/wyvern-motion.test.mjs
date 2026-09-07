import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWyvernRig } from '../models/wyvern-rig.mjs';
import { createWyvern } from '../models/wyvern.mjs';
import { WYVERN_FLIGHT, wyvernPose, wyvernClips } from '../models/wyvern-motion.mjs';

test('wingbeat is periodic, mirrored, articulated and keeps its hover position', () => {
  const duration = WYVERN_FLIGHT.duration;
  const start = wyvernPose('Hover', 0), end = wyvernPose('Hover', duration);
  const near = (a, b, tolerance = 1e-8) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tolerance));
  near(start.position, end.position);
  for (const name of Object.keys(start.rotations)) near(start.rotations[name], end.rotations[name]);
  for (let i = 0; i <= 60; i++) {
    const pose = wyvernPose('Hover', duration * i / 60);
    assert.equal(pose.position[0], 0); assert.equal(pose.position[2], 0);
    for (const joint of ['Shoulder', 'Elbow', 'Wrist']) {
      assert.ok(Math.abs(pose.rotations[`Left${joint}`][2] + pose.rotations[`Right${joint}`][2]) < 1e-8);
    }
  }
  const epsilon = 1e-4;
  const before = wyvernPose('Hover', duration - epsilon), after = wyvernPose('Hover', epsilon);
  for (const name of Object.keys(start.rotations)) {
    near(start.rotations[name].map((v, i) => (v - before.rotations[name][i]) / epsilon),
      after.rotations[name].map((v, i) => (v - start.rotations[name][i]) / epsilon), .002);
  }
});

function verifyAnimation(root, clips) {
  const skins = []; root.traverse(n => { if (n.isSkinnedMesh) skins.push(n); });
  assert.equal(skins.length, 17);
  assert.equal(skins[0].skeleton.bones.length, 29);
  for (const skin of skins) {
    const weights = skin.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) {
      const values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      assert.ok(values.every(v => v >= 0 && v <= 1));
      assert.ok(Math.abs(values.reduce((a, b) => a + b) - 1) < 1e-6);
    }
  }
  const clip = clips.find(c => c.name === 'Hover'); assert.ok(clip);
  const mixer = new AnimationMixer(root); mixer.clipAction(clip).play();
  let lowest = Infinity, tipLow = Infinity, tipHigh = -Infinity;
  const tipMesh = skins.find(n => n.name === 'LeftWing_hide');
  const positions = tipMesh.geometry.attributes.position;
  let tipIndex = 0;
  for (let i = 0; i < positions.count; i++) if (positions.getX(i) > positions.getX(tipIndex)) tipIndex = i;
  const point = new Vector3(); let first, last;
  for (let frame = 0; frame <= 60; frame++) {
    mixer.setTime(clip.duration * frame / 60); root.updateMatrixWorld(true);
    skins.forEach(skin => skin.skeleton.update());
    const snapshot = [];
    for (const skin of skins) {
      const p = skin.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        skin.getVertexPosition(i, point).applyMatrix4(skin.matrixWorld);
        assert.ok(point.toArray().every(Number.isFinite)); lowest = Math.min(lowest, point.y);
        if (frame === 0 || frame === 60) snapshot.push(...point);
      }
    }
    if (frame === 0) first = snapshot; if (frame === 60) last = snapshot;
    tipMesh.getVertexPosition(tipIndex, point).applyMatrix4(tipMesh.matrixWorld);
    tipLow = Math.min(tipLow, point.y); tipHigh = Math.max(tipHigh, point.y);
  }
  assert.ok(lowest > .5, `All wing/claw vertices must stay airborne: ${lowest}`);
  assert.ok(tipHigh - tipLow > 5, `A genuine large wing stroke: ${tipHigh - tipLow}`);
  first.forEach((v, i) => assert.ok(Math.abs(v - last[i]) < 1e-5, 'No pop at the loop seam'));
  mixer.stopAllAction(); mixer.uncacheRoot(root);
}

test('weighted wyvern deforms actual wings with airborne feet for a complete loop', () => {
  verifyAnimation(createWyvernRig(), wyvernClips());
});

function verifyDistalFlap(root, clips) {
  const mixer = new AnimationMixer(root); mixer.clipAction(clips.find(c => c.name === 'Hover')).play();
  const mesh = root.getObjectByName('LeftWing_hide'), p = mesh.geometry.attributes.position;
  let tipIndex = 0, clawIndex = 0, nearest = Infinity;
  const point = new Vector3(), clawRest = new Vector3(4.19, 5.36, .98);
  for (let i = 0; i < p.count; i++) {
    if (p.getX(i) > p.getX(tipIndex)) tipIndex = i;
    const distance = point.fromBufferAttribute(p, i).distanceTo(clawRest);
    if (distance < nearest) { nearest = distance; clawIndex = i; }
  }
  let tipMin = Infinity, tipMax = -Infinity, wristMin = Infinity, wristMax = -Infinity;
  for (let i = 0; i <= 60; i++) {
    mixer.setTime(WYVERN_FLIGHT.duration * i / 60); root.updateMatrixWorld(true); mesh.skeleton.update();
    const wrist = root.getObjectByName('LeftWrist');
    const tip = wrist.worldToLocal(mesh.getVertexPosition(tipIndex, point).applyMatrix4(mesh.matrixWorld));
    tipMin = Math.min(tipMin, tip.y); tipMax = Math.max(tipMax, tip.y);
    const wristPosition = root.getObjectByName('Chest').worldToLocal(wrist.getWorldPosition(new Vector3()));
    wristMin = Math.min(wristMin, wristPosition.y); wristMax = Math.max(wristMax, wristPosition.y);
  }
  assert.ok(wristMax - wristMin > 2 && wristMax - wristMin < 3.5,
    'The shoulder must visibly carry the wing, without returning to a shoulder-only stroke');
  assert.ok(tipMax - tipMin > 2.8, 'The fan must visibly flap relative to the claw pivot itself');
  mixer.setTime(0); root.updateMatrixWorld(true); mesh.skeleton.update();
  const tipBefore = mesh.getVertexPosition(tipIndex, new Vector3());
  const clawBefore = mesh.getVertexPosition(clawIndex, new Vector3());
  const fan = root.getObjectByName('LeftFan'); assert.ok(fan, 'Independent hinge at the wing claw');
  fan.quaternion.identity(); root.updateMatrixWorld(true); mesh.skeleton.update();
  assert.ok(tipBefore.distanceTo(mesh.getVertexPosition(tipIndex, new Vector3())) > .8);
  assert.ok(clawBefore.distanceTo(mesh.getVertexPosition(clawIndex, new Vector3())) < 1e-5, 'Fan rotation must not drag the claw/forearm');
  mixer.stopAllAction(); mixer.uncacheRoot(root);
}

test('shoulder and claw-side fan share the stroke while the fan leaves the claw itself intact', () => {
  verifyDistalFlap(createWyvernRig(), wyvernClips());
});

test('recovery flexes membrane ribs without folding the whole arm toward the chest', () => {
  const root = createWyvernRig(), mixer = new AnimationMixer(root);
  mixer.clipAction(wyvernClips()[0]).play();
  const mesh = root.getObjectByName('LeftWing_hide'), positions = mesh.geometry.attributes.position;
  let tipIndex = 0;
  for (let i = 0; i < positions.count; i++) if (positions.getX(i) > positions.getX(tipIndex)) tipIndex = i;
  const measure = fraction => {
    mixer.setTime(WYVERN_FLIGHT.duration * fraction); root.updateMatrixWorld(true); mesh.skeleton.update();
    const shoulder = root.getObjectByName('LeftShoulder').getWorldPosition(new Vector3());
    const elbow = root.getObjectByName('LeftElbow').getWorldPosition(new Vector3());
    const wrist = root.getObjectByName('LeftWrist').getWorldPosition(new Vector3());
    return { wristReach: wrist.distanceTo(shoulder), bend: elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow)) };
  };
  const open = measure(.28), curled = measure(.78);
  assert.ok(Math.abs(curled.bend - open.bend) < .25, 'No crawl-like elbow folding');
  assert.ok(curled.wristReach > open.wristReach * .92, 'Keep the structural wing arm extended');
  const point = new Vector3();
  const flexed = mesh.getVertexPosition(tipIndex, point).clone();
  const bones = mesh.skeleton.bones.filter(b => b.name.includes('Rib'));
  assert.equal(bones.length, 8, 'Four separately weighted membrane ribs per wing');
  for (const bone of bones) {
    assert.ok(bone.quaternion.angleTo(bone.quaternion.clone().identity()) < .45, 'Restrained flex, not a sharp fold');
    bone.quaternion.identity();
  }
  root.updateMatrixWorld(true); mesh.skeleton.update();
  const unflexed = mesh.getVertexPosition(tipIndex, point).clone();
  assert.ok(flexed.distanceTo(unflexed) > .18, 'Actual distal geometry must bend independently of shoulder/elbow/wrist');
});

test('Rest resets the complete flight pose back to the original static geometry', () => {
  const rig = createWyvernRig(), original = createWyvern(), clips = wyvernClips();
  const mixer = new AnimationMixer(rig);
  const hover = mixer.clipAction(clips[0]); hover.play(); mixer.setTime(.7);
  hover.stop(); mixer.clipAction(clips[1]).play(); mixer.setTime(.3);
  rig.updateMatrixWorld(true);
  const point = new Vector3(), expected = new Vector3();
  rig.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    const positions = original.getObjectByName(mesh.name).geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
      expected.fromBufferAttribute(positions, i);
      assert.ok(point.distanceTo(expected) < 1e-5, `${mesh.name}: Rest must preserve the authored silhouette`);
    }
  });
});

test('delivered GLB retains its skeleton and wingbeat after reimport', async () => {
  const bytes = await readFile(new URL('../output/wyvern.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.deepEqual(gltf.animations.map(c => c.name), ['Hover', 'Rest']);
  verifyAnimation(gltf.scene, gltf.animations);
  verifyDistalFlap(gltf.scene, gltf.animations);
});
