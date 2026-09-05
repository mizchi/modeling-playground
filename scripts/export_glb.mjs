import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Texture-free GLTF export in Node: adapt only the browser binary Blob reader.
class BinaryFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});},error=>this.onerror?.(error));
  }
}
export async function exportGlb(root,animations=[]) {
  const previous=globalThis.FileReader;
  try {
    globalThis.FileReader=BinaryFileReader;
    return await new GLTFExporter().parseAsync(root,{binary:true,animations});
  } finally {
    if(previous===undefined)delete globalThis.FileReader;
    else globalThis.FileReader=previous;
  }
}
