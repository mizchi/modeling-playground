import { isMesh } from '../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { createWyvernRig } from './rig.ts';
import { wyvernClips } from './motion.ts';
import { exportGlb } from '../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);

const model=createWyvernRig(),bytes=await exportGlb(model,wyvernClips());
await writeFile(new URL('wyvern.glb',output),new Uint8Array(bytes));
let triangles=0,meshes=0;model.traverse(n=>{if(isMesh(n)){meshes++;triangles+=n.geometry.attributes.position.count/3;}});
console.log(`CINDERWING: ${triangles} triangles, ${meshes} meshes, ${(bytes.byteLength/1024).toFixed(1)} KiB; bounds ${new Box3().setFromObject(model).getSize(new Vector3()).toArray().map(v=>v.toFixed(2)).join(' × ')} m`);
