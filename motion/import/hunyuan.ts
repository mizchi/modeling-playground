import { Quaternion, Vector3, InterpolateLinear } from 'three';
import type { AnimationClip, Bone, KeyframeTrack, Object3D } from 'three';
import { isBone } from '../../modeling/scene-objects.ts';
import { BASE45_BONES } from '../../human/models/base45/src/definition.ts';
import { BODY_BONES, restPose, validateProject } from '../contract.ts';
import type { BodyBone, MotionProject, MotionKey } from '../contract.ts';
import { applyPose, capturePose } from '../rig.ts';
import type { MotionRig } from '../rig.ts';

/** Explicit HY-Motion SMPL-H FBX profile, not a generic rig-name guesser. */
export const HUNYUAN_MAP: Record<Exclude<BodyBone,'Root'>,string>={
  Hips:'Pelvis',Spine:'Spine1',Chest:'Spine3',Neck:'Neck',Head:'Head',
  LeftClavicle:'L_Collar',LeftUpperArm:'L_Shoulder',LeftForearm:'L_Elbow',LeftHand:'L_Wrist',
  LeftThigh:'L_Hip',LeftShin:'L_Knee',LeftFoot:'L_Ankle',LeftToe:'L_Foot',
  RightClavicle:'R_Collar',RightUpperArm:'R_Shoulder',RightForearm:'R_Elbow',RightHand:'R_Wrist',
  RightThigh:'R_Hip',RightShin:'R_Knee',RightFoot:'R_Ankle',RightToe:'R_Foot',
};
const mainChild: Partial<Record<BodyBone,BodyBone>>={Spine:'Chest',Chest:'Neck',Neck:'Head',
  LeftClavicle:'LeftUpperArm',LeftUpperArm:'LeftForearm',LeftForearm:'LeftHand',LeftThigh:'LeftShin',LeftShin:'LeftFoot',LeftFoot:'LeftToe',
  RightClavicle:'RightUpperArm',RightUpperArm:'RightForearm',RightForearm:'RightHand',RightThigh:'RightShin',RightShin:'RightFoot',RightFoot:'RightToe'};
const point=(o:Object3D)=>o.getWorldPosition(new Vector3());
const rotation=(o:Object3D)=>o.getWorldQuaternion(new Quaternion());
const finger=/^[LR]_(Index|Middle|Pinky|Ring|Thumb)[123]$/;
function valueAt(track: KeyframeTrack,time: number): number[]{
  const times=track.times,size=track.getValueSize();let a=0,b=times.length-1;
  if(time<=times[0])return Array.from(track.values.slice(0,size));
  if(time>=times[b])return Array.from(track.values.slice(b*size,(b+1)*size));
  while(a+1<b){const m=(a+b)>>1;if(times[m]<=time)a=m;else b=m;}
  const ratio=(time-times[a])/(times[b]-times[a]),first=Array.from(track.values.slice(a*size,(a+1)*size)),last=Array.from(track.values.slice(b*size,(b+1)*size));
  return size===4?new Quaternion(...first).slerp(new Quaternion(...last),ratio).normalize().toArray():first.map((v,i)=>v+(last[i]-v)*ratio);
}
export interface RetargetResult { project: MotionProject; report: string }
export function retargetHunyuan(source: Object3D,clip: AnimationClip,project: MotionProject,target: MotionRig): RetargetResult {
  const names=new Set([...Object.values(HUNYUAN_MAP),'Spine2']),bones=new Map<string,Bone>();
  source.updateMatrixWorld(true);
  source.traverse(o=>{
    if(!isBone(o)||!names.has(o.name))return;
    if(bones.has(o.name)){
      // FBX skin clusters may produce repeated zero-transform helper children.
      if(o.parent?.name!==o.name||o.position.length()>1e-7||o.quaternion.angleTo(new Quaternion())>1e-7||o.scale.distanceTo(new Vector3(1,1,1))>1e-7)throw new Error(`重複した骨格: ${o.name}`);
    }else bones.set(o.name,o);
  });
  for(const name of names)if(!bones.has(name))throw new Error(`Hunyuanのボーンがありません: ${name}`);
  const parent=bones.get('Pelvis')!.parent;
  if(parent&&(rotation(parent).angleTo(new Quaternion())>1e-6||parent.getWorldScale(new Vector3()).distanceTo(new Vector3(1,1,1))>1e-6))throw new Error('Hunyuanの親変換は回転0・スケール1で書き出してください');
  for(const bone of bones.values())if(bone.scale.distanceTo(new Vector3(1,1,1))>1e-6)throw new Error(`未対応のボーンスケール: ${bone.name}`);
  for(const item of BASE45_BONES){
    if(item.name==='Root'||item.name==='Hips')continue;
    const name=item.name as Exclude<BodyBone,'Root'>,expected=name==='Chest'?'Spine2':HUNYUAN_MAP[item.parent as Exclude<BodyBone,'Root'>];
    let parent=bones.get(HUNYUAN_MAP[name])!.parent;while(parent?.name===HUNYUAN_MAP[name])parent=parent.parent;
    if(parent?.name!==expected)throw new Error(`Hunyuanの階層が一致しません: ${name}`);
  }
  if(bones.get('Spine2')!.parent?.name!=='Spine1')throw new Error('HunyuanのSpine2階層が一致しません');
  if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>600||clip.tracks.length>200)throw new Error('モーションの長さ・トラック数が不正です');
  const frames=Math.round(clip.duration*project.fps);if(frames<1||frames>=6000)throw new Error('読み込みは2〜6000フレームのクリップに対応します');
  const tracks=new Map<string,KeyframeTrack>();let ignored=0;
  for(const inputTrack of clip.tracks){
    const track=inputTrack.clone();
    const match=/^([A-Za-z0-9_]+)\.(quaternion|position)$/.exec(track.name);
    if(!match||tracks.has(track.name))throw new Error(`未対応・重複トラック: ${track.name}`);
    const [,name,kind]=match,size=kind==='quaternion'?4:3;
    if(!(names.has(name)||(kind==='quaternion'&&finger.test(name)))||(kind==='position'&&name!=='Pelvis'))throw new Error(`未対応トラック: ${track.name}`);
    if(track.getValueSize()!==size||!track.times.length||track.times.length>36000||track.values.length!==track.times.length*size||track.getInterpolation()!==InterpolateLinear
      ||!track.times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=clip.duration+1e-5&&(!i||t>=track.times[i-1]))||!track.values.every(Number.isFinite))throw new Error(`不正なキー: ${track.name}`);
    if(size===4)for(let i=0;i<track.values.length;i+=4)if(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)>1e-4)throw new Error(`不正な回転: ${track.name}`);
    // FBX Euler unwrapping can insert equal Float32 times. Never collapse a discontinuity.
    const times:number[]=[],values:number[]=[];
    for(let i=0;i<track.times.length;i++){
      const value=Array.from(track.values.slice(i*size,(i+1)*size));
      if(i&&track.times[i]===track.times[i-1]){
        const previous=values.slice(-size);
        const error=size===4?new Quaternion(...previous).normalize().angleTo(new Quaternion(...value).normalize()):Math.hypot(...value.map((v,j)=>v-previous[j]));
        if(error>1e-5)throw new Error(`異なる値の重複キー: ${track.name}`);
      }else{times.push(track.times[i]);values.push(...value);}
    }
    track.times=new Float32Array(times);track.values=new Float32Array(values);
    tracks.set(track.name,track);if(finger.test(name))ignored++;
  }
  for(const name of names)if(!tracks.has(`${name}.quaternion`))throw new Error(`回転トラックがありません: ${name}`);
  const translation=tracks.get('Pelvis.position');if(!translation)throw new Error('Pelvis.positionがありません');
  const original=new Map([...bones.values()].map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone()}]));
  const targetPose=capturePose(target),sourceRest=new Map([...bones].map(([name,b])=>[name,{position:point(b),rotation:rotation(b)}]));
  try{
    applyPose(target,restPose());
    const sourceLeg=point(bones.get('L_Hip')!).distanceTo(point(bones.get('L_Knee')!))+point(bones.get('L_Knee')!).distanceTo(point(bones.get('L_Ankle')!));
    const targetLeg=point(target.bones.LeftThigh).distanceTo(point(target.bones.LeftShin))+point(target.bones.LeftShin).distanceTo(point(target.bones.LeftFoot));
    if(sourceLeg<1e-5)throw new Error('元の脚の長さが不正です');
    const scale=targetLeg/sourceLeg,align=new Map<BodyBone,Quaternion>();
    for(const name of BODY_BONES){
      const child=mainChild[name];let q=new Quaternion();
      if(child&&name!=='Root'&&child!=='Root'){
        const a=point(target.bones[child]).sub(point(target.bones[name])).normalize();
        const b=sourceRest.get(HUNYUAN_MAP[child])!.position.clone().sub(sourceRest.get(HUNYUAN_MAP[name])!.position).normalize();
        q.setFromUnitVectors(a,b);
      }align.set(name,q);
    }
    const keys: MotionKey[]=[],first=new Vector3(...valueAt(translation,0));let baseline=0;
    const floor=Math.min(point(target.bones.LeftToe).y,point(target.bones.RightToe).y);
    for(let frame=0;frame<=frames;frame++){
      const time=frame/frames*clip.duration;
      for(const [name,bone] of bones)bone.quaternion.fromArray(valueAt(tracks.get(`${name}.quaternion`)!,time));
      source.updateMatrixWorld(true);
      const pose=restPose(),world=new Map<BodyBone,Quaternion>([['Root',new Quaternion()]]);
      for(const item of BASE45_BONES){
        const name=item.name as BodyBone;if(name==='Root')continue;
        const from=HUNYUAN_MAP[name],q=rotation(bones.get(from)!).multiply(sourceRest.get(from)!.rotation.clone().invert()).multiply(align.get(name)!).normalize();
        world.set(name,q);pose.rotations[name]=world.get(item.parent as BodyBone)!.clone().invert().multiply(q).normalize().toArray();
      }
      pose.root=new Vector3(...valueAt(translation,time)).sub(first).multiplyScalar(scale).toArray();
      if(frame===0){applyPose(target,pose);baseline=floor-Math.min(point(target.bones.LeftToe).y,point(target.bones.RightToe).y);}
      pose.hips=[0,baseline,0];keys.push({frame,pose});
    }
    const next=validateProject({...project,name:clip.name.slice(0,200)||'Imported motion',frames,keys,loop:false,reference:null});
    return {project:next,report:`Hunyuan SMPL-H → BASE-45 / ${keys.length} keys。Spine2を胸へ合成。指${ignored}トラックは対象外。開始位置を合わせました。接地・ループは手動調整してください。`};
  }finally{
    for(const [bone,p] of original){bone.position.copy(p.position);bone.quaternion.copy(p.quaternion);}source.updateMatrixWorld(true);applyPose(target,targetPose);
  }
}
