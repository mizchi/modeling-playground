import { mkdir, writeFile } from 'node:fs/promises';
import { Group } from 'three';
import { createAster } from '../models/aster.mjs';
import { createAsterHead } from '../models/aster-head.mjs';
import { createAsterHair } from '../models/aster-hair.mjs';
import { ASTER } from '../models/aster-definition.mjs';
import { exportGlb } from './export_glb.mjs';
import { encodeRgbaPng } from './png.mjs';
const root=createAster();let triangles=0;
root.traverse(n=>{if(n.isMesh)triangles+=n.geometry.index.count/3;});
if(triangles>ASTER.triangleBudget)throw new Error(`Triangle budget: ${triangles}/${ASTER.triangleBudget}`);
const bytes=await exportGlb(root);
if(bytes.byteLength>ASTER.byteBudget)throw new Error('Aster byte budget exceeded');
await writeFile(new URL('../output/aster.glb',import.meta.url),new Uint8Array(bytes));
await writeFile(new URL('../output/aster-expressions.png',import.meta.url),encodeRgbaPng(root.getObjectByName('Face').material.map.image));
// Both independent parts use the same Head-local origin; they assemble without offsets.
await mkdir(new URL('../output/parts/',import.meta.url),{recursive:true});
const head=new Group();head.name='AsterHead';const {face,skull}=createAsterHead();head.add(face,skull);
for(const [name,part] of [['aster-head',head],['aster-hair',createAsterHair()]])
  await writeFile(new URL(`../output/parts/${name}.glb`,import.meta.url),new Uint8Array(await exportGlb(part)));
let boneCount=0;root.traverse(n=>{if(n.isBone)boneCount++;});
console.log(`ASTER: ${triangles} triangles; ${(bytes.byteLength/1024).toFixed(1)} KiB; ${boneCount} bones; 6 texture expressions`);
