import { mkdir, writeFile } from 'node:fs/promises';
import { bindAsset } from '../runtime/asset.ts';
import { exportGlb } from './export-glb.ts';
import type { Object3D, AnimationClip } from 'three';
import type { AssetSpec } from '../contracts/asset.ts';

export interface AssetExport {
  root: Object3D;
  clips: AnimationClip[];
  definition: AssetSpec;
}

/** Generate both artifacts from one validated definition. Node-only I/O boundary. */
export async function exportAsset({root,clips,definition}: AssetExport,directory: URL): Promise<ArrayBuffer> {
  bindAsset(root,clips,definition);
  const bytes=await exportGlb(root,clips);
  const json=JSON.stringify(definition,null,2)+'\n';
  await mkdir(directory,{recursive:true});
  await Promise.all([
    writeFile(new URL(`${definition.id}.glb`,directory),new Uint8Array(bytes)),
    writeFile(new URL(`${definition.id}.asset.json`,directory),json),
  ]);
  return bytes;
}
