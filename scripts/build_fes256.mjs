import { writeFile } from 'node:fs/promises';
import { createFes256 } from '../models/fes256.mjs';
import { FES256 } from '../models/fes256-definition.mjs';
import { exportGlb } from './export_glb.mjs';
import { encodeRgbaPng } from './png.mjs';

const root=createFes256(),parts=[];root.traverse(n=>{if(n.isMesh)parts.push(n);});
const triangles=parts.reduce((n,m)=>n+m.geometry.index.count/3,0);
if(triangles>FES256.triangleBudget)throw new Error(`Study budget exceeded: ${triangles}/${FES256.triangleBudget} triangles`);
const bytes=await exportGlb(root);
if(bytes.byteLength>FES256.byteBudget)throw new Error('FES byte budget exceeded');
await writeFile(new URL('../output/fes256.glb',import.meta.url),new Uint8Array(bytes));
await writeFile(new URL('../output/fes256-expressions.png',import.meta.url),encodeRgbaPng(root.getObjectByName('Face').material.map.image));
console.log(`${FES256.name}: ${triangles} triangles including face (study target ${FES256.triangleTarget}, relaxed cap ${FES256.triangleBudget}); ${parts.length} meshes; ${(bytes.byteLength/1024).toFixed(1)} KiB; 6 texture expressions`);
