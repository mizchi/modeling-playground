/** V1 uses meters, seconds, radians, Y-up and +Z-forward. Transforms are bone-local.
 * Bones and sockets have identity rest rotation/scale; add a new schema version to change that.
 */
export type Vec3 = [number, number, number];
export interface BoneSpec { name: string; parent: string | null; position: Vec3 }
export interface SocketSpec { id: string; node: string; bone: string; position: Vec3 }
export interface ColliderSpec { id: string; bone: string; shape: 'box'; center: Vec3; halfExtents: Vec3 }
export interface AttackSpec { id: string; from: string; to: string; radius: number }
export interface EmitterSpec {
  id: string; socket: string; direction: Vec3; preset: string;
  rate: number; lifetime: number; speed: number;
}
/** Half-open clip-local interval [start, end). Events use unwrapped clip time. */
export interface WindowSpec { kind: 'attack' | 'emitter'; id: string; start: number; end: number }
export interface ClipSpec { name: string; duration: number; fps: number; mode: 'once' | 'repeat'; windows: WindowSpec[] }
export interface AssetSpec {
  version: 1; id: string; units: 'meters'; coordinateSystem: 'gltf-y-up'; forward: '+Z'; groundLevel: number;
  rig: { bones: BoneSpec[] }; sockets: SocketSpec[]; colliders: ColliderSpec[];
  attacks: AttackSpec[]; emitters: EmitterSpec[]; clips: ClipSpec[];
}
/** Rejects unknown fields, broken references, invalid numbers and unsupported versions. */
export function validateAssetSpec(value: unknown): AssetSpec;
