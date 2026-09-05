import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createSuzu } from '../models/suzu.mjs';

// GLTFExporter uses the browser FileReader API for binary Blobs. No canvas or DOM
// is required for this texture-free asset; adapt just that API for Node.js.
class BinaryFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});},error=>this.onerror?.(error));
  }
}
const previous=globalThis.FileReader;
try {
  globalThis.FileReader=BinaryFileReader;
  const bytes=await new GLTFExporter().parseAsync(createSuzu(),{binary:true});
  const output=new URL('../output/',import.meta.url);
  await mkdir(output,{recursive:true});
  await writeFile(new URL('suzu.glb',output),new Uint8Array(bytes));
  console.log(`Suzu: ${(bytes.byteLength/1024).toFixed(0)} KB — generated entirely with Three.js`);
} finally {
  if(previous===undefined)delete globalThis.FileReader;
  else globalThis.FileReader=previous;
}
