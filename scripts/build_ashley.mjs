import { mkdir, writeFile } from 'node:fs/promises';
import { createAshley } from '../models/ashley.mjs';
import { createAshleyAtlas } from '../models/ashley-texture.mjs';
import { exportGlb } from './export_glb.mjs';
import { encodeRgbaPng } from './png.mjs';
import { inspectModel } from '../viewer/model.mjs';

const root=createAshley(),bytes=await exportGlb(root),output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
await Promise.all([
  writeFile(new URL('ashley.glb',output),new Uint8Array(bytes)),
  writeFile(new URL('ashley-atlas.png',output),encodeRgbaPng(createAshleyAtlas().image)),
]);
console.log(`Ashley: ${inspectModel(root).triangles} triangles / ${(bytes.byteLength/1024).toFixed(0)} KB / embedded 256×256 PNG`);
