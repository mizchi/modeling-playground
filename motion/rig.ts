import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3 } from 'three';
import type { Bone, Object3D } from 'three';
import { isBone } from '../modeling/scene-objects.ts';
import { IKPose } from '../runtime/ik.ts';
import type { IKChainSpec } from '../runtime/ik.ts';
import { BASE45_BONES } from '../human/models/base45/src/definition.ts';
import { BODY_BONES, restPose } from './contract.ts';
import type { BodyBone, MotionPose, MotionProject, Vec3 } from './contract.ts';

export interface MotionRig { root: Object3D; bones: Record<BodyBone,Bone>; rest: Record<BodyBone,Vec3>; ik: IKPose }
export function createMotionRig(root: Object3D): MotionRig {
  const bones=Object.fromEntries(BODY_BONES.map(name=>{
    const bone=root.getObjectByName(name);if(!isBone(bone))throw new Error(`ボーンがありません: ${name}`);
    const parent=BASE45_BONES.find(b=>b.name===name)!.parent;
    if(parent&&bone.parent?.name!==parent)throw new Error(`階層が一致しません: ${name}`);
    return [name,bone];
  })) as Record<BodyBone,Bone>;
  const rest=Object.fromEntries(BODY_BONES.map(name=>[name,bones[name].position.toArray()])) as Record<BodyBone,Vec3>;
  root.updateMatrixWorld(true);
  const chains: IKChainSpec[]=[];
  for(const [side,id,label] of [['Left','left','左'],['Right','right','右']] as const)for(const limb of ['Hand','Foot'] as const){
    const arm=limb==='Hand',lower=`${side}${arm?'Forearm':'Shin'}` as BodyBone;
    const pole=bones[lower].getWorldPosition(new Vector3());pole.z+=arm?-.5:.5;
    chains.push({id:id+limb,label:label+(arm?'手':'足'),upper:side+(arm?'UpperArm':'Thigh'),lower,end:side+limb,pole:pole.toArray()});
  }
  return {root,bones,rest,ik:new IKPose(root,root,{version:1,coordinateSystem:'gltf-y-up',hips:'Hips',chains})};
}
export function capturePose(rig: MotionRig): MotionPose {
  const p=restPose();for(const name of BODY_BONES)p.rotations[name]=rig.bones[name].quaternion.clone().normalize().toArray();
  for(const [name,field] of [['Root','root'],['Hips','hips']] as const)p[field]=rig.bones[name].position.toArray().map((v,i)=>v-rig.rest[name][i]) as Vec3;
  return p;
}
export function applyPose(rig: MotionRig,pose: MotionPose): void {
  for(const name of BODY_BONES){rig.bones[name].position.fromArray(rig.rest[name]);rig.bones[name].quaternion.fromArray(pose.rotations[name]);}
  rig.bones.Root.position.add(new Vector3(...pose.root));rig.bones.Hips.position.add(new Vector3(...pose.hips));rig.root.updateMatrixWorld(true);
}
export function compileClip(project: MotionProject,rig: MotionRig): AnimationClip {
  const times=project.keys.map(k=>k.frame/project.fps);
  const rotations=BODY_BONES.map(name=>new QuaternionKeyframeTrack(`${name}.quaternion`,times,project.keys.flatMap(k=>k.pose.rotations[name])));
  const positions=([['Root','root'],['Hips','hips']] as const).map(([name,field])=>
    new VectorKeyframeTrack(`${name}.position`,times,project.keys.flatMap(k=>k.pose[field].map((v,i)=>v+rig.rest[name][i]))));
  return new AnimationClip(project.name,project.frames/project.fps,[...rotations,...positions]);
}
