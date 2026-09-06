/** Shared Three.js resource ownership helpers, independent of the DOM/viewer. */
export function modelMaterials(root) {
  const materials = new Set();
  root.traverse(object => {
    for (const material of [object.material].flat()) if (material) materials.add(material);
  });
  return materials;
}

export function disposeModel(root) {
  const geometry = new Set();
  const textures = new Set();
  const skeletons = new Set();
  root.traverse(object => {
    if (object.geometry) geometry.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
  });
  for (const material of modelMaterials(root)) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const value of geometry) value.dispose();
  for (const value of textures) { value.dispose(); value.source?.data?.close?.(); }
  for (const skeleton of skeletons) skeleton.dispose();
}
