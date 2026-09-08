import { meshTextureImage } from '../../../../modeling/scene-objects.ts';
import { isMesh } from '../../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createLumi } from './model.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { encodeRgbaPng } from '../../../../modeling/png.ts';

const output=await prepareOutput(import.meta.url);
const root=createLumi(),bytes=new Uint8Array(await exportGlb(root));
await writeFile(new URL('lumi.glb',output),bytes);
await writeFile(new URL('lumi-face.png',output),encodeRgbaPng(meshTextureImage(root,'BaseBody')));
await writeFile(new URL('lumi-hair.png',output),encodeRgbaPng(meshTextureImage(root,'Hair')));
let triangles=0;root.traverse(o=>{if(isMesh(o))triangles+=o.geometry.index!.count/3;});
console.log(`LUMI: ${triangles} triangles, ${(bytes.length/1024).toFixed(1)} KiB; accepted base + face texture + separate rigged hair`);
