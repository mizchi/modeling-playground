import { isTexture, isMesh, isSkinnedMesh } from './scene-objects.ts';
import type { Object3D, Material, BufferGeometry, Skeleton, Texture } from 'three';
/** Shared Three.js resource ownership helpers, independent of the DOM/viewer. */
export function modelMaterials(root: Object3D): Set<Material> {
  const materials = new Set<Material>();
  root.traverse(object => {
    for (const material of [isMesh(object) ? object.material : []].flat()) if (material) materials.add(material);
  });
  return materials;
}

export function disposeModel(root: Object3D): void {
  const geometry = new Set<BufferGeometry>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  root.traverse(object => {
    if (isMesh(object)) geometry.add(object.geometry);
    if (isSkinnedMesh(object)) skeletons.add(object.skeleton);
  });
  for (const material of modelMaterials(root)) {
    for (const value of Object.values(material)) if (isTexture(value)) textures.add(value);
    material.dispose();
  }
  for (const value of geometry) value.dispose();
  for (const value of textures) {
    value.dispose();
    const image: unknown=value.source?.data;
    if (image && typeof image==='object' && 'close' in image && typeof image.close==='function') image.close();
  }
  for (const skeleton of skeletons) skeleton.dispose();
}
