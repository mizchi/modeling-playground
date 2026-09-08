import type { Bone, ColorRepresentation, Group } from 'three';
import type { ClipSpec, Vec3 } from '../contracts/asset.ts';

export type { Vec3 } from '../contracts/asset.ts';
export type Vec2 = [number, number];
export type Weight = [bone: string, weight: number];
export type BoneMap = Record<string, Bone>;
export interface Rig { root: Group; bones: BoneMap }
export type Tile = readonly [left: number, top: number, width: number, height: number];
export type Tiles = Readonly<Record<string, Tile>>;
export type Point = readonly number[];
export type Influences = string | ((point: Point) => Weight[]);
export type SurfaceColor = ColorRepresentation | ((point: Point) => ColorRepresentation);
export type CompactMeshBuilder = ReturnType<typeof import('./compact-mesh.ts').compactMesh>;
export type PixelPainter = ReturnType<typeof import('./pixel-atlas.ts').pixelPainter>;
export interface Pose {
  position: number[];
  rotations: Record<string, number[]>;
  scales?: Record<string, number[]>;
  quaternions?: Record<string, number[]>;
}
export interface PoseClipOptions {
  clips: Pick<ClipSpec, 'name' | 'duration' | 'fps'>[];
  rootBone: string;
  joints: string[];
  scaleJoints: string[];
  sample: (name: string, time: number) => Pose;
  extraTimes?: (name: string) => number[];
}
export interface RgbaImage {
  data: unknown;
  width: number;
  height: number;
}
export type BoneRow = [name: string, parent: string | null, position: Vec3];
