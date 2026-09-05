import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import validator from 'gltf-validator';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, Vector3 } from 'three';

test('walk GLB contains a weighted humanoid skeleton and a seamless grounded cycle', async () => {
  const bytes = await readFile(new URL('../output/traveler-walk.glb', import.meta.url));
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: 'traveler-walk.glb', maxIssues: 30 });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(gltf.skins.length > 0);
  assert.ok(gltf.skins.every(skin => skin.joints.length >= 18));
  assert.ok(gltf.animations.some(clip => clip.name === 'Walk'));
  assert.ok(gltf.meshes.every(mesh => mesh.primitives.every(p => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined)));
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const clip = asset.animations.find(a => a.name === 'Walk');
  assert.ok(Math.abs(clip.duration - 1.2) < .001);
  const mixer = new AnimationMixer(asset.scene);
  const action = mixer.clipAction(clip).play();
  const skinned = [];
  asset.scene.traverse(o => { if(o.isSkinnedMesh) skinned.push(o); });
  assert.ok(skinned.length >= 7);
  const poseAt = time => {
    action.time = time;
    mixer.update(0);
    asset.scene.updateMatrixWorld(true);
    for (const mesh of skinned) mesh.skeleton.update();
    const bones = {};
    asset.scene.traverse(o => { if(o.isBone) bones[o.name] = o.matrixWorld.toArray(); });
    return bones;
  };
  const start = poseAt(0);
  const end = poseAt(clip.duration - .00001);
  for (const name of Object.keys(start)) for (let i=0;i<16;i++) assert.ok(Math.abs(start[name][i]-end[name][i]) < .001, `Loop seam at ${name}`);
  const middle = poseAt(.3);
  assert.notDeepEqual(start.LeftFoot, middle.LeftFoot);
  let lowest = Infinity;
  for (let frame=0;frame<36;frame++) {
    poseAt(frame / 30);
    for (const mesh of skinned) {
      const positions=mesh.geometry.attributes.position;
      for (let i=0;i<positions.count;i++) {
        const p = mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
        assert.ok(p.toArray().every(Number.isFinite));
        lowest = Math.min(lowest, p.y);
      }
    }
  }
  assert.ok(lowest >= -.006, `Ground penetration: ${lowest} m`);
  console.log(`Walk verified: ${skinned.length} skinned meshes, ${clip.duration.toFixed(1)} s, lowest vertex ${lowest.toFixed(4)} m`);
});
