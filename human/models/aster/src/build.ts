import type { Object3D } from 'three';
import { meshTextureImage } from '../../../../modeling/scene-objects.ts';
import { isMesh, isBone } from '../../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../../modeling/output.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { Group } from 'three';
import { createAster } from './model.ts';
import { createAsterHead } from './head.ts';
import { createAsterHair } from './hair.ts';
import { ASTER } from './definition.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { encodeRgbaPng } from '../../../../modeling/png.ts';

const output=await prepareOutput(import.meta.url);
const root=createAster();let triangles=0;
root.traverse(n=>{if(isMesh(n))triangles+=n.geometry.index!.count/3;});
if(triangles>ASTER.triangleBudget)throw new Error(`Triangle budget: ${triangles}/${ASTER.triangleBudget}`);
const bytes=await exportGlb(root);
if(bytes.byteLength>ASTER.byteBudget)throw new Error('Aster byte budget exceeded');
await writeFile(new URL('aster.glb',output),new Uint8Array(bytes));
await writeFile(new URL('aster-expressions.png',output),encodeRgbaPng(meshTextureImage(root,'Face')));
// Both independent parts use the same Head-local origin; they assemble without offsets.
await mkdir(new URL('parts/',output),{recursive:true});
const head=new Group();head.name='AsterHead';const {face,skull}=createAsterHead();head.add(face,skull);
for(const [name,part] of [['aster-head',head],['aster-hair',createAsterHair()]] satisfies [string,Object3D][])
  await writeFile(new URL(`parts/${name}.glb`,output),new Uint8Array(await exportGlb(part)));
let boneCount=0;root.traverse(n=>{if(isBone(n))boneCount++;});
console.log(`ASTER: ${triangles} triangles; ${(bytes.byteLength/1024).toFixed(1)} KiB; ${boneCount} bones; 6 texture expressions`);
