import {FalQueueClient,object,id,assetUrl} from '../../../generation/fal-queue.ts';

export const TRIPO_MODEL='tripo3d/h3.1/image-to-3d';
export interface TripoInput {
  image_url:string;
  face_limit:6000;
  texture:true;
  pbr:false;
  model_seed:42;
  texture_seed:42;
  texture_quality:'standard';
  geometry_quality:'standard';
  texture_alignment:'original_image';
  orientation:'default';
  quad:false;
}
export function tripoInput(value:unknown):TripoInput {
  if(typeof value!=='string'||value.length>8*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Expected a local PNG data URI, at most 8MB');
  return {image_url:value,face_limit:6000,texture:true,pbr:false,model_seed:42,texture_seed:42,
    texture_quality:'standard',geometry_quality:'standard',texture_alignment:'original_image',orientation:'default',quad:false};
}
export function modelUrl(value:unknown):string {
  const result=object(value),variants=result.model_urls?object(result.model_urls):{};
  return assetUrl(object(variants.glb??result.model_mesh).url);
}
export class TripoClient extends FalQueueClient {
  protected override get endpoint(){return TRIPO_MODEL;}
  override async submit(value:unknown):Promise<string> {
    return id((await this.call(`https://queue.fal.run/${this.endpoint}`,tripoInput(value))).request_id);
  }
}
