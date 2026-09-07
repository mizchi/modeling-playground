import { writeFile } from 'node:fs/promises';
import { createDog } from '../models/dog.mjs';
import { DOG_PRESETS } from '../models/dog-definition.mjs';
import { dogClips } from '../models/dog-motion.mjs';
import { exportGlb } from './export_glb.mjs';

const preset=DOG_PRESETS[process.argv[2]??'dog'];
if(!preset)throw new Error('Unknown dog preset; choose dog or corgi');
const root=createDog(preset),bytes=await exportGlb(root,dogClips()),mesh=root.getObjectByName(preset.meshName);
const triangles=mesh.geometry.index.count/3;
if(triangles>preset.triangleBudget||bytes.byteLength>preset.byteBudget)throw new Error(`Dog budget exceeded: ${triangles} triangles / ${bytes.byteLength} bytes`);
await writeFile(new URL(`../output/${preset.id}.glb`,import.meta.url),new Uint8Array(bytes));
console.log(`${preset.name}: ${triangles} triangles, ${mesh.geometry.attributes.position.count} vertices, 1 mesh/material, 17 bones, ${(bytes.byteLength/1024).toFixed(1)} KiB`);
