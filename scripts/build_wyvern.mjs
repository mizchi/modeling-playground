import { mkdir, writeFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { createWyvernRig } from '../models/wyvern-rig.mjs';
import { wyvernClips } from '../models/wyvern-motion.mjs';
import { exportGlb } from './export_glb.mjs';

const model=createWyvernRig(),bytes=await exportGlb(model,wyvernClips()),output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('wyvern.glb',output),new Uint8Array(bytes));
let triangles=0,meshes=0;model.traverse(n=>{if(n.isMesh){meshes++;triangles+=n.geometry.attributes.position.count/3;}});
console.log(`CINDERWING: ${triangles} triangles, ${meshes} meshes, ${(bytes.byteLength/1024).toFixed(1)} KiB; bounds ${new Box3().setFromObject(model).getSize(new Vector3()).toArray().map(v=>v.toFixed(2)).join(' × ')} m`);
