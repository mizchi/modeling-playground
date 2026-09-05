import { mkdir, writeFile } from 'node:fs/promises';
import { exportGlb } from './export_glb.mjs';
import { createSuzu } from '../models/suzu.mjs';

const bytes=await exportGlb(createSuzu());
const output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('suzu.glb',output),new Uint8Array(bytes));
console.log(`Suzu: ${(bytes.byteLength/1024).toFixed(0)} KB — generated entirely with Three.js`);
