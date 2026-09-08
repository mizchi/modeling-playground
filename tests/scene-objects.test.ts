import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, DataTexture, Group, Mesh, MeshBasicMaterial } from 'three';
import { isBone, isMesh, isTexture, requireMesh, meshTextureImage } from '../modeling/scene-objects.ts';

test('scene guards narrow mesh, bone and texture objects, including missing parents', () => {
  assert.equal(isBone(undefined), false);
  assert.equal(isMesh(null), false);
  assert.equal(isMesh(new Group()), false);
  assert.equal(isMesh(new Mesh()), true);
  assert.equal(isBone(new Bone()), true);
  assert.equal(isTexture(new DataTexture()), true);
});

test('export inspection requires a named mesh and an RGBA texture', () => {
  const root = new Group();
  const data = new Uint8Array([255, 128, 0, 255]);
  const texture = new DataTexture(data, 1, 1);
  const material = new MeshBasicMaterial({map: texture});
  const mesh = new Mesh(undefined, material);
  mesh.name = 'Face';
  root.add(mesh);
  assert.equal(requireMesh(root, 'Face'), mesh);
  assert.deepEqual(meshTextureImage(root, 'Face'), {data, width: 1, height: 1});
  assert.throws(() => requireMesh(root, 'Missing'), /Expected mesh/);
  material.map = null;
  assert.throws(() => meshTextureImage(root, 'Face'), /textured material/);
  material.map = texture;
  texture.image = {width: 1, height: 1};
  assert.throws(() => meshTextureImage(root, 'Face'), /RGBA texture/);
  mesh.geometry.dispose();
  material.dispose();
  texture.dispose();
});
