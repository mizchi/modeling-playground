import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RGBAFormat } from 'three';
import type { AnimationClip, Object3D } from 'three';
import type { GLTFWriter, GLTFExporterPlugin } from 'three/addons/exporters/GLTFExporter.js';
import type { RgbaImage } from './types.ts';
import { encodeRgbaPng } from './png.ts';

// Node I/O adapters are kept outside the browser-safe modeling layer.
class BinaryFileReader {
  result: ArrayBuffer | null = null;
  onloadend?: (event: {target: BinaryFileReader}) => void;
  onerror?: (error: unknown) => void;
  readAsArrayBuffer(blob: Blob): void {
    blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});},error=>this.onerror?.(error));
  }
}

// GLTFExporter exposes its writer to plugins. Isolate this version-sensitive
// adapter here; round-trip/export tests protect it on Three.js upgrades.
interface ImageDefinition { mimeType: string; bufferView?: number }
interface ImageWriter {
  processImage: (image: RgbaImage, format: number, flipY: boolean) => number;
  json: {images?: ImageDefinition[]};
  pending: Promise<unknown>[];
  processBufferViewImage: (blob: Blob) => Promise<number>;
}
function nodePngImages(gltfWriter: GLTFWriter): GLTFExporterPlugin {
  // This internal API is not exposed by @types/three; keep its assertion local.
  const writer = gltfWriter as unknown as ImageWriter;
  const cache=new WeakMap<RgbaImage, Map<boolean, number>>();
  writer.processImage=(image,format,flipY)=>{
    if(format!==RGBAFormat)throw new Error('Node GLB export requires RGBA8 DataTexture');
    let versions=cache.get(image);if(!versions){versions=new Map();cache.set(image,versions);}
    if(versions.has(flipY))return versions.get(flipY)!;
    const png=encodeRgbaPng(image,flipY),definition: ImageDefinition={mimeType:'image/png'};
    writer.json.images??=[];
    const index=writer.json.images.push(definition)-1;versions.set(flipY,index);
    writer.pending.push(writer.processBufferViewImage(new Blob([png],{type:'image/png'})).then(id=>{definition.bufferView=id;}));
    return index;
  };
  return {};
}
export async function exportGlb(root: Object3D,animations: AnimationClip[]=[]): Promise<ArrayBuffer> {
  const previous=globalThis.FileReader;
  try {
    globalThis.FileReader=BinaryFileReader as unknown as typeof FileReader;
    const bytes=await new GLTFExporter().register(nodePngImages).parseAsync(root,{binary:true,animations});
    if (!(bytes instanceof ArrayBuffer)) throw new Error('Binary GLB exporter returned JSON');
    return bytes;
  } finally {
    if(previous===undefined)Reflect.deleteProperty(globalThis,'FileReader');
    else globalThis.FileReader=previous;
  }
}
