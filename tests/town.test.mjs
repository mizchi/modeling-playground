import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import validator from 'gltf-validator';

const path = new URL('../output/little-town.glb', import.meta.url);

test('GLB is a valid, self-contained glTF 2.0 asset', async () => {
  const bytes = await readFile(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const report = await validator.validateBytes(new Uint8Array(bytes), {
    uri: 'little-town.glb', maxIssues: 30,
  });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues, null, 2));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok((gltf.images ?? []).every(image => !image.uri));
  assert.equal((gltf.cameras ?? []).length, 0, 'Presentation camera is excluded');
  assert.ok(!gltf.nodes.some(node => node.name?.startsWith('Studio')));
  for (const name of ['Town', 'Fountain', 'ClockTower', 'Cafe', 'Bakery', 'Bookshop']) {
    assert.ok(gltf.nodes.some(node => node.name === name), `Missing ${name}`);
  }
  const positions = gltf.meshes.flatMap(mesh => mesh.primitives.map(p => gltf.accessors[p.attributes.POSITION]));
  assert.ok(gltf.nodes.filter(node => node.mesh !== undefined).length > 100, 'Town must have modeled detail, including shared mesh instances');
  assert.ok(positions.every(a => [...a.min, ...a.max].every(Number.isFinite)));
  assert.ok(bytes.length < 30 * 1024 * 1024, 'Keep the asset usable in web viewers');
  console.log(`Validated ${(bytes.length / 1024 / 1024).toFixed(2)} MiB, ${gltf.nodes.length} nodes, ${gltf.meshes.length} meshes`);
});
