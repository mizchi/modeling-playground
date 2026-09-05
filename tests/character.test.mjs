import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import validator from 'gltf-validator';

test('traveler is a complete, self-contained static humanoid GLB', async () => {
  const bytes = await readFile(new URL('../output/traveler.glb', import.meta.url));
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: 'traveler.glb', maxIssues: 20 });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  for (const name of ['Traveler', 'Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg', 'Backpack']) {
    assert.ok(gltf.nodes.some(node => node.name === name), `Missing body part ${name}`);
  }
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok((gltf.images ?? []).every(image => !image.uri));
  assert.equal((gltf.cameras ?? []).length, 0);
  assert.ok(!gltf.nodes.some(node => node.name.startsWith('Studio')));
  const root = gltf.nodes.find(node => node.name === 'Traveler');
  assert.equal(root.extras.units, 'meters');
  assert.equal(root.extras.rigged, false);
  assert.ok(bytes.length < 5 * 1024 * 1024);
  console.log(`Traveler validated: ${(bytes.length / 1024).toFixed(0)} KB, ${gltf.nodes.length} nodes`);
});
