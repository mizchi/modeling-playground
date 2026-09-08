import type { Bone, Mesh, Object3D, SkinnedMesh, Texture } from 'three';
import type { RgbaImage } from './types.ts';

// Three.js flags also work for objects created by another copy of the library.
export function isMesh(value: unknown): value is Mesh {
  return !!value && typeof value === 'object' && 'isMesh' in value && value.isMesh === true;
}
export function isSkinnedMesh(value: unknown): value is SkinnedMesh {
  return !!value && typeof value === 'object' && 'isSkinnedMesh' in value && value.isSkinnedMesh === true;
}
export function isBone(value: unknown): value is Bone {
  return !!value && typeof value === 'object' && 'isBone' in value && value.isBone === true;
}
export function isTexture(value: unknown): value is Texture {
  return !!value && typeof value === 'object' && 'isTexture' in value && value.isTexture === true;
}

export function requireMesh(root: Object3D, name: string): Mesh {
  const object = root.getObjectByName(name);
  if (!isMesh(object)) throw new Error(`Expected mesh: ${name}`);
  return object;
}

export function meshTextureImage(root: Object3D, name: string): RgbaImage {
  const material = requireMesh(root, name).material;
  if (Array.isArray(material) || !('map' in material) || !isTexture(material.map)) {
    throw new Error(`Expected one textured material: ${name}`);
  }
  const image: unknown = material.map.image;
  if (!image || typeof image !== 'object' || !('data' in image) ||
      !('width' in image) || typeof image.width !== 'number' ||
      !('height' in image) || typeof image.height !== 'number') {
    throw new Error(`Expected RGBA texture image: ${name}`);
  }
  return {data: image.data, width: image.width, height: image.height};
}
