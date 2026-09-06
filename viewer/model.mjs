import { Box3, Vector3 } from 'three';
export { modelMaterials, disposeModel } from '../modeling/resources.mjs';

/** Return camera parameters without changing the model's original coordinates. */
export function frameModel(bounds, fov, aspect, direction = new Vector3(1, .85, 1.4)) {
  if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite)) {
    throw new Error('表示できる形状がありません。');
  }
  const target = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, .001);
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  const backward = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), backward).normalize();
  if (right.lengthSq() < .000001) right.set(1, 0, 0);
  const up = new Vector3().crossVectors(backward, right).normalize();
  let distance = radius;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new Vector3(x, y, z).sub(target);
    distance = Math.max(distance, corner.dot(backward) + Math.max(Math.abs(corner.dot(right)) / Math.tan(horizontal), Math.abs(corner.dot(up)) / Math.tan(vertical)));
  }
  distance *= 1.16;
  return {
    target,
    position: target.clone().addScaledVector(backward, distance),
    near: Math.max(radius / 1000, .00001),
    far: distance + radius * 100,
    radius,
  };
}

export function inspectModel(model) {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  let meshes = 0;
  let triangles = 0;
  let groundY;
  model.traverse(object => {
    if (Number.isFinite(object.userData.groundLevel)) groundY = object.localToWorld(new Vector3(0, object.userData.groundLevel, 0)).y;
    if (!object.isMesh) return;
    const instances = object.isInstancedMesh ? object.count : 1;
    meshes += instances;
    triangles += ((object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3) * instances;
  });
  if (!meshes || bounds.isEmpty()) throw new Error('表示できる形状がありません。');
  return { bounds, size: bounds.getSize(new Vector3()), meshes, triangles, groundY };
}

export function validateGlb(bytes) {
  if (bytes.byteLength < 20) throw new Error('有効なGLBファイルではありません。');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('GLB 2.0ファイルを選んでください。ファイルが破損している可能性もあります。');
  }
}

/** Prefer author-supplied focus groups; otherwise use the top-level model part. */
export function focusTarget(object, root) {
  for (let ancestor = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
    if (ancestor.userData.focusTarget && ancestor.parent !== root) return ancestor;
  }
  let content = root;
  while (content.children.length === 1 && !content.children[0].isMesh) content = content.children[0];
  while (object.parent && object.parent !== content && object.parent !== root) object = object.parent;
  return object;
}
