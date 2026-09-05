import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RGBAFormat } from 'three';
import { encodeRgbaPng } from './png.mjs';

// Node I/O adapters are kept outside the browser-safe modeling layer.
class BinaryFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});},error=>this.onerror?.(error));
  }
}

// GLTFExporter exposes its writer to plugins. Isolate this version-sensitive
// adapter here; round-trip/export tests protect it on Three.js upgrades.
function nodePngImages(writer) {
  const cache=new WeakMap();
  writer.processImage=(image,format,flipY)=>{
    if(format!==RGBAFormat)throw new Error('Node GLB export requires RGBA8 DataTexture');
    let versions=cache.get(image);if(!versions){versions=new Map();cache.set(image,versions);}
    if(versions.has(flipY))return versions.get(flipY);
    const png=encodeRgbaPng(image,flipY),definition={mimeType:'image/png'};
    writer.json.images??=[];
    const index=writer.json.images.push(definition)-1;versions.set(flipY,index);
    writer.pending.push(writer.processBufferViewImage(new Blob([png],{type:'image/png'})).then(id=>{definition.bufferView=id;}));
    return index;
  };
  return {};
}
export async function exportGlb(root,animations=[]) {
  const previous=globalThis.FileReader;
  try {
    globalThis.FileReader=BinaryFileReader;
    return await new GLTFExporter().register(nodePngImages).parseAsync(root,{binary:true,animations});
  } finally {
    if(previous===undefined)delete globalThis.FileReader;
    else globalThis.FileReader=previous;
  }
}
