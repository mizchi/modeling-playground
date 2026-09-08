import { requireMesh } from '../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createDog } from './model.ts';
import { DOG_PRESETS } from './definition.ts';
import { dogClips } from './motion.ts';
import { exportGlb } from '../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);

const preset=DOG_PRESETS[(process.argv[2]??'dog') as keyof typeof DOG_PRESETS];
if(!preset)throw new Error(`Unknown dog preset; choose ${Object.keys(DOG_PRESETS).join(', ')}`);
const root=createDog(preset),bytes=await exportGlb(root,dogClips()),mesh=requireMesh(root,preset.meshName);
const triangles=mesh.geometry.index!.count/3;
if(triangles>preset.triangleBudget||bytes.byteLength>preset.byteBudget)throw new Error(`Dog budget exceeded: ${triangles} triangles / ${bytes.byteLength} bytes`);
await writeFile(new URL(`${preset.id}.glb`,output),new Uint8Array(bytes));
console.log(`${preset.name}: ${triangles} triangles, ${mesh.geometry.attributes.position.count} vertices, 1 mesh/material, 17 bones, ${(bytes.byteLength/1024).toFixed(1)} KiB`);
