import type { Mesh } from 'three';
import { meshTextureImage } from '../../../../modeling/scene-objects.ts';
import { isMesh } from '../../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createFes256 } from './model.ts';
import { FES256 } from './definition.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { encodeRgbaPng } from '../../../../modeling/png.ts';

const output=await prepareOutput(import.meta.url);

const root=createFes256(),parts:Mesh[]=[];root.traverse(n=>{if(isMesh(n))parts.push(n);});
const triangles=parts.reduce((n,m)=>n+m.geometry.index!.count/3,0);
if(triangles>FES256.triangleBudget)throw new Error(`Study budget exceeded: ${triangles}/${FES256.triangleBudget} triangles`);
const bytes=await exportGlb(root);
if(bytes.byteLength>FES256.byteBudget)throw new Error('FES byte budget exceeded');
await writeFile(new URL('fes256.glb',output),new Uint8Array(bytes));
await writeFile(new URL('fes256-expressions.png',output),encodeRgbaPng(meshTextureImage(root,'Face')));
console.log(`${FES256.name}: ${triangles} triangles including face (study target ${FES256.triangleTarget}, relaxed cap ${FES256.triangleBudget}); ${parts.length} meshes; ${(bytes.byteLength/1024).toFixed(1)} KiB; 6 texture expressions`);
