import { writeFile } from 'node:fs/promises';
import { createLumi } from '../models/lumi.mjs';
import { exportGlb } from './export_glb.mjs';
import { encodeRgbaPng } from './png.mjs';
const root=createLumi(),bytes=new Uint8Array(await exportGlb(root));
await writeFile(new URL('../output/lumi.glb',import.meta.url),bytes);
await writeFile(new URL('../output/lumi-face.png',import.meta.url),encodeRgbaPng(root.getObjectByName('BaseBody').material.map.image));
let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});
console.log(`LUMI: ${triangles} triangles, ${(bytes.length/1024).toFixed(1)} KiB; accepted base + face texture + separate rigged hair`);
