import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, PerspectiveCamera } from 'three';
import { frameModel, inspectModel, validateGlb } from '../viewer/model.mjs';
import { readFile } from 'node:fs/promises';

test('all corners fit the camera, including narrow phone viewports and off-center models', () => {
  const bounds = new Box3(new Vector3(100, -2, -40), new Vector3(128, 9, -16));
  for (const aspect of [0.45, 1, 2.1]) {
    for (const direction of [new Vector3(1, .85, 1.4), new Vector3(0, 1, .0001), new Vector3(0, 0, 1)]) {
      const camera = new PerspectiveCamera(40, aspect, .1, 1000);
      const { target, position, near, far } = frameModel(bounds, camera.fov, aspect, direction);
      camera.position.copy(position);
      camera.near = near;
      camera.far = far;
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1, `Clipped at aspect ${aspect}: ${p.toArray()}`);
      }
    }
  }
});

test('empty or malformed content reports an actionable error', () => {
  assert.throws(() => frameModel(new Box3(), 40, 1), /形状/);
  assert.throws(() => validateGlb(new ArrayBuffer(20)), /GLB/);
});

test('the delivered town is accepted and truncated files are rejected', async () => {
  const buffer = await readFile(new URL('../output/little-town.glb', import.meta.url));
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  assert.doesNotThrow(() => validateGlb(bytes));
  assert.throws(() => validateGlb(bytes.slice(0, -4)), /GLB/);
});

test('model measurements respect world transforms and count instances', async () => {
  const { Group, Mesh, BoxGeometry, MeshStandardMaterial } = await import('three');
  const model = new Group();
  const a = new Mesh(new BoxGeometry(2, 3, 4), new MeshStandardMaterial());
  const b = a.clone();
  b.position.x = 4;
  model.add(a, b);
  model.scale.setScalar(2);
  const info = inspectModel(model);
  assert.deepEqual(info.size.toArray(), [12, 6, 8]);
  assert.equal(info.meshes, 2);
  assert.equal(info.triangles, 24);
});
