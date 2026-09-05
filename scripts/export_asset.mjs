import { mkdir, writeFile } from 'node:fs/promises';
import { bindAsset } from '../runtime/asset.mjs';
import { exportGlb } from './export_glb.mjs';

/** Generate both artifacts from one validated definition. Node-only I/O boundary. */
export async function exportAsset({root,clips,definition},directory) {
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
