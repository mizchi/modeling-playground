import {MeshyClient,assetUrl,id} from './queue-client.ts';
export const IMAGE_MODEL='meshy/v7/image-to-3d',RIG_MODEL='fal-ai/meshy/rigging';
export interface ImageInput {image_url:string;model_type:'standard';topology:'triangle';target_polycount:number;should_remesh:true;should_texture:true;enable_pbr:false;pose_mode:'t-pose';enable_rigging:false;enable_safety_checker:true}
export interface RigInput {model_url:string;height_meters:number;enable_animation:false;enable_safety_checker:true}
export function imageInput(value:unknown):ImageInput{
  if(typeof value!=='string'||value.length>8*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Expected a local PNG data URI, at most 8MB');
  return {image_url:value,model_type:'standard',topology:'triangle',target_polycount:6000,should_remesh:true,should_texture:true,enable_pbr:false,pose_mode:'t-pose',enable_rigging:false,enable_safety_checker:true};
}
export function rigInput(value:unknown):RigInput{return {model_url:assetUrl(value),height_meters:1.6,enable_animation:false,enable_safety_checker:true};}
export class ImageClient extends MeshyClient {
  protected override get endpoint(){return IMAGE_MODEL;}
  override async submit(value:unknown){return id((await this.call(`https://queue.fal.run/${this.endpoint}`,imageInput(value))).request_id);}
}
export class RigClient extends MeshyClient {
  protected override get endpoint(){return RIG_MODEL;}
  override async submit(value:unknown){return id((await this.call(`https://queue.fal.run/${this.endpoint}`,rigInput(value))).request_id);}
}
