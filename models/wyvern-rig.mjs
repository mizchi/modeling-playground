import { Bone, Scene, Skeleton, SkinnedMesh, Uint16BufferAttribute, Float32BufferAttribute, Vector3, Triangle } from 'three';
import { createWyvern, WYVERN } from './wyvern.mjs';

/** Bind-space anchors in meters. Local offsets are derived from these world positions. */
export const WYVERN_BONES = Object.freeze([
  ['FlightRoot', null, [0, 0, 0]],
  ['Chest', 'FlightRoot', [0, 2.8, 0]],
  ['NeckJoint', 'Chest', [0, 3.60, .05]],
  ['HeadJoint', 'NeckJoint', [0, 4.69, .65]],
  ['TailBase', 'Chest', [0, 1.92, -.51]],
  ['TailMiddle', 'TailBase', [0, 1.51, -2.07]],
  ['TailTip', 'TailMiddle', [.22, 1.58, -4.17]],
  ...[1, -1].flatMap(side => {
    const prefix = side === 1 ? 'Left' : 'Right';
    const mirror = p => [p[0] * side, p[1], p[2]];
    return [
      [`${prefix}Shoulder`, 'Chest', mirror(WYVERN.shoulder)],
      [`${prefix}Elbow`, `${prefix}Shoulder`, mirror(WYVERN.elbow)],
      [`${prefix}Wrist`, `${prefix}Elbow`, mirror(WYVERN.wrist)],
      [`${prefix}Fan`, `${prefix}Wrist`, mirror(WYVERN.wrist)],
      ...WYVERN.fingers.slice(0, 4).map((tip, index) => {
        const hinge = WYVERN.wrist.map((v, axis) => v + (tip[axis] - v) * .52);
        hinge[1] += .14;
        return [`${prefix}Rib${index}`, `${prefix}Fan`, mirror(hinge)];
      }),
      [`${prefix}Hip`, 'Chest', mirror([.29, 2.08, -.38])],
      [`${prefix}Knee`, `${prefix}Hip`, mirror([.93, 1.22, .30])],
      [`${prefix}Ankle`, `${prefix}Knee`, mirror([.98, .36, -.26])],
    ];
  }),
].map(([name, parent, position]) => Object.freeze({ name, parent, position: Object.freeze(position) })));

const clamp = x => Math.max(0, Math.min(1, x));
const blend = (a, b, t) => [[a, 1 - clamp(t)], [b, clamp(t)]];
const panels = WYVERN.fingers.slice(0, -1).map((tip, i) =>
  new Triangle(new Vector3(...WYVERN.wrist), new Vector3(...tip), new Vector3(...WYVERN.fingers[i + 1])));

/** Interpolate across adjacent ribs and along their length; leave the inner body anchor fixed. */
function membraneInfluences(side, x, y, z, structural) {
  const point = new Vector3(Math.abs(x), y, z), projected = new Vector3();
  let nearest = Infinity, panelIndex = 0, barycentric = new Vector3();
  panels.forEach((panel, i) => {
    panel.closestPointToPoint(point, projected);
    const distance = projected.distanceToSquared(point);
    if (distance < nearest) {
      nearest = distance; panelIndex = i; panel.getBarycoord(projected, barycentric);
    }
  });
  const radius = barycentric.y + barycentric.z;
  if (radius < 1e-6) return [[`${side}Fan`, 1]];
  const u = clamp((radius - .40) / .40), flex = u * u * (3 - 2 * u);
  const share = clamp(barycentric.y / radius);
  const ribWeights = [[panelIndex, share], [panelIndex + 1, 1 - share]]
    .filter(([index]) => index < 4).map(([index, weight]) => [`${side}Rib${index}`, flex * weight]);
  const total = clamp(ribWeights.reduce((sum, [, weight]) => sum + weight, 0));
  // Only the innermost panel blends back into the torso attachment. The remaining
  // fan belongs to the claw pivot, not the X-based shoulder/elbow skinning bands.
  const anchor = Math.min(1 - total, panelIndex === 3 ? (1 - share) * clamp(radius) : 0);
  return [...structural.map(([name, weight]) => [name, weight * anchor]),
    [`${side}Fan`, 1 - total - anchor], ...ribWeights].filter(([, weight]) => weight > 0);
}

/** Shared vertex positions receive identical weights, including the duplicated flat-shaded faces. */
function influences(part, x, y, z) {
  if (part === 'Head') return [['HeadJoint', 1]];
  if (part === 'Neck' || (part === 'DorsalSpines' && y > 3.6)) {
    return y < 4.05 ? blend('Chest', 'NeckJoint', (y - 3.6) / .45)
      : blend('NeckJoint', 'HeadJoint', (y - 4.25) / .44);
  }
  if (part === 'Tail') return z > -2.07
    ? blend('TailBase', 'TailMiddle', (-z - .8) / 1.27)
    : blend('TailMiddle', 'TailTip', (-z - 2.6) / 1.57);
  const side = part.startsWith('Left') ? 'Left' : 'Right';
  if (part.endsWith('Wing')) {
    const u = Math.abs(x);
    if (u < .9) return blend('Chest', `${side}Shoulder`, (u - .42) / .48);
    if (u < 2.02) return blend(`${side}Shoulder`, `${side}Elbow`, (u - 1.3) / .72);
    return blend(`${side}Elbow`, `${side}Wrist`, (u - 2.6) / 1.26);
  }
  if (part.endsWith('Leg')) {
    if (y > 1.7) return blend('Chest', `${side}Hip`, (2.15 - y) / .45);
    if (y > .82) return blend(`${side}Hip`, `${side}Knee`, (1.48 - y) / .66);
    return blend(`${side}Knee`, `${side}Ankle`, (.6 - y) / .3);
  }
  return [['Chest', 1]];
}

export function createWyvernRig() {
  const authored = createWyvern(), root = new Scene();
  root.name = authored.name; root.userData = { ...authored.userData };
  root.add(...authored.children);
  root.userData.rigged = true;
  root.userData.version = 4;
  const bones = new Map(), anchors = new Map(WYVERN_BONES.map(b => [b.name, b.position]));
  for (const definition of WYVERN_BONES) {
    const bone = new Bone(); bone.name = definition.name;
    const parentAnchor = anchors.get(definition.parent) ?? [0, 0, 0];
    bone.position.set(...definition.position.map((v, i) => v - parentAnchor[i]));
    (bones.get(definition.parent) ?? root).add(bone);
    bones.set(bone.name, bone);
  }
  root.updateMatrixWorld(true);
  const ordered = [...bones.values()], skeleton = new Skeleton(ordered);
  const indicesByName = new Map(ordered.map((bone, index) => [bone.name, index]));
  const meshes = []; root.traverse(n => { if (n.isMesh) meshes.push(n); });
  for (const mesh of meshes) {
    const geometry = mesh.geometry, positions = geometry.attributes.position;
    const indices = new Uint16Array(positions.count * 4), weights = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      let values = influences(mesh.parent.name, x, y, z);
      if (geometry.attributes.wingSurface?.getX(i)) {
        values = membraneInfluences(mesh.parent.name.startsWith('Left') ? 'Left' : 'Right', x, y, z, values);
      }
      values.forEach(([name, weight], slot) => {
        indices[i * 4 + slot] = weight > 0 ? indicesByName.get(name) : 0;
        weights[i * 4 + slot] = weight;
      });
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    geometry.deleteAttribute('wingSurface');
    const skin = new SkinnedMesh(geometry, mesh.material); skin.name = mesh.name;
    skin.userData = { focusTarget: true, part: mesh.parent.name };
    // glTF skinned meshes must be scene roots; all motion comes from the bones.
    root.add(skin); skin.bind(skeleton); skin.frustumCulled = false;
    mesh.removeFromParent();
  }
  for (const child of [...root.children]) if (child.isGroup && child.children.length === 0) child.removeFromParent();
  return root;
}
