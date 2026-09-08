import { LoadingManager, Texture, TextureLoader } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/** Only motion is used. Never fetch textures or URLs embedded in an imported FBX. */
class IgnoreTextures extends TextureLoader {
  override load(url: string): Texture<HTMLImageElement> {if(url.startsWith('blob:'))URL.revokeObjectURL(url);return new Texture<HTMLImageElement>();}
}
export function parseMotionFbx(bytes: ArrayBuffer){
  if(bytes.byteLength<32||bytes.byteLength>32*1024*1024)throw new Error('FBXは32MB以下にしてください');
  const manager=new LoadingManager();manager.addHandler(/.*/,new IgnoreTextures(manager));
  manager.setURLModifier(()=>{throw new Error('FBX内の外部リソースは読み込みません');});
  return new FBXLoader(manager).parse(bytes,'');
}
