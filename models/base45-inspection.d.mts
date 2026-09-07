import type { DataTexture, Group } from 'three';
export type InspectionSurface = 'clay' | 'eyes' | 'grid';
/** Frontal projection, not a production body UV atlas. */
export function faceCheckUV(position: readonly [number,number,number]): [number,number];
export function createFaceCheckTexture(surface: Exclude<InspectionSurface,'clay'>): DataTexture;
export function createBase45Inspection(options?: {surface?: InspectionSurface}): Group;
