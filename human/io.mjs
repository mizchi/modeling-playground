import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function inspectMotionGlb(buffer) {
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20||buffer.byteLength>32*1024*1024)throw new Error('GLBは32MB以下にしてください');
  const v=new DataView(buffer);
  if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength||v.getUint32(16,true)!==0x4e4f534a)throw new Error('glTF 2.0のGLBを指定してください');
  const length=v.getUint32(12,true);if(length>buffer.byteLength-20)throw new Error('破損したGLBです');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if([...(json.buffers??[]),...(json.images??[])].some(a=>a.uri))throw new Error('外部URIを含まない埋め込みGLBが必要です');
  if(json.extensionsRequired?.length)throw new Error('拡張圧縮を使わないGLBが必要です');
  if(!json.animations?.length)throw new Error('GLBにアニメーションがありません');
  return json;
}

export async function loadMotionGlb(buffer) {
  inspectMotionGlb(buffer);
  return new GLTFLoader().parseAsync(buffer,'');
}

export function downloadFile(data,name,type) {
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
