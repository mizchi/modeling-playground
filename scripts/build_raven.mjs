import { mkdir, writeFile } from 'node:fs/promises';
import { createRaven } from '../models/raven.mjs';
import { exportGlb } from './export_glb.mjs';

const {root,bones,clips}=createRaven();
const bytes=await exportGlb(root,clips),output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('raven.glb',output),new Uint8Array(bytes));
console.log(`RAVEN-03: ${(bytes.byteLength/1024).toFixed(0)} KB, ${Object.keys(bones).length} bones, ${clips.map(c=>c.name).join(', ')}`);
