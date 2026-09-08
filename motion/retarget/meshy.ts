import {AnimationClip,Quaternion,QuaternionKeyframeTrack,VectorKeyframeTrack,Vector3} from 'three';
import type {Bone,KeyframeTrack,Object3D,SkinnedMesh} from 'three';

/** Parent-first, explicit profile for Meshy's 24-joint humanoid rig. */
export const MESHY_HY_MAP={Hips:'Pelvis',Spine02:'Spine1',Spine01:'Spine2',Spine:'Spine3',neck:'Neck',Head:'Head',
  LeftShoulder:'L_Collar',LeftArm:'L_Shoulder',LeftForeArm:'L_Elbow',LeftHand:'L_Wrist',
  RightShoulder:'R_Collar',RightArm:'R_Shoulder',RightForeArm:'R_Elbow',RightHand:'R_Wrist',
  LeftUpLeg:'L_Hip',LeftLeg:'L_Knee',LeftFoot:'L_Ankle',LeftToeBase:'L_Foot',
  RightUpLeg:'R_Hip',RightLeg:'R_Knee',RightFoot:'R_Ankle',RightToeBase:'R_Foot'} as const;
type TargetName=keyof typeof MESHY_HY_MAP;
const children:Partial<Record<TargetName,TargetName>>={Spine02:'Spine01',Spine01:'Spine',Spine:'neck',neck:'Head',
  LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',
  LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
const point=(object:Object3D)=>object.getWorldPosition(new Vector3());
const rotation=(object:Object3D)=>object.getWorldQuaternion(new Quaternion()).normalize();

export function retargetWorldRotation(animated:Quaternion,sourceRest:Quaternion,targetRest:Quaternion,align=new Quaternion()):Quaternion {
  return animated.clone().multiply(sourceRest.clone().invert()).multiply(align).multiply(targetRest).normalize();
}
export function groundOffset(sourceClearance:number,targetSoleY:number):number {
  if(!Number.isFinite(sourceClearance)||!Number.isFinite(targetSoleY))throw Error('Invalid contact sample');
  return Math.max(0,sourceClearance)-targetSoleY;
}
function sample(track:KeyframeTrack,time:number):number[] {
  const n=track.getValueSize(),times=track.times;let low=0,high=times.length-1;
  if(time<=times[0])return Array.from(track.values.slice(0,n));
  if(time>=times[high])return Array.from(track.values.slice(high*n,(high+1)*n));
  while(low+1<high){const mid=(low+high)>>1;if(times[mid]<=time)low=mid;else high=mid;}
  const t=(time-times[low])/(times[high]-times[low]);
  const a=Array.from(track.values.slice(low*n,(low+1)*n)),b=Array.from(track.values.slice(high*n,(high+1)*n));
  return n===4?new Quaternion(...a).slerp(new Quaternion(...b),t).normalize().toArray():a.map((v,i)=>v+(b[i]-v)*t);
}
function bonesByName(root:Object3D):Map<string,Bone> {
  const bones=new Map<string,Bone>();
  root.traverse(object=>{
    if(!('isBone'in object)||!object.isBone)return;
    const bone=object as Bone;
    if(bones.has(bone.name)){
      if(bone.parent?.name!==bone.name||bone.position.length()>1e-7||bone.quaternion.angleTo(new Quaternion())>1e-7||bone.scale.distanceTo(new Vector3(1,1,1))>1e-7)throw Error(`Ambiguous duplicate bone: ${bone.name}`);
    }else bones.set(bone.name,bone);
  });return bones;
}
export interface RetargetDiagnostics {
  sourceDuration:number;frames:number;scale:number;groundCorrection:boolean;ignoredFingerTracks:number;
  rawSoleMin:number;rawSoleMax:number;correctedSoleMin:number;peakClearance:number;maxVerticalCorrection:number;
  samples:{time:number;sourceClearance:number;rawSoleY:number;soleY:number;correctionY:number;hips:number[];leftFoot:number[];rightFoot:number[]}[];
}
export function retargetHyToMeshy(source:Object3D,sourceClip:AnimationClip,target:Object3D,correctGround=true):{clip:AnimationClip;report:RetargetDiagnostics} {
  if(!Number.isFinite(sourceClip.duration)||sourceClip.duration<=0||sourceClip.duration>12.1)throw Error('Expected short HY clip');
  const sourceBones=bonesByName(source),targetBones=bonesByName(target),tracks=new Map<string,KeyframeTrack>();
  for(const track of sourceClip.tracks){
    if(tracks.has(track.name)||!track.times.length||!track.times.every((t,i)=>Number.isFinite(t)&&(!i||t>=track.times[i-1]))||!track.values.every(Number.isFinite))throw Error('Invalid animation track');
    tracks.set(track.name,track);
  }
  for(const [to,from] of Object.entries(MESHY_HY_MAP)){
    if(!sourceBones.has(from)||!targetBones.has(to)||!tracks.has(`${from}.quaternion`))throw Error(`Missing mapped bone/track ${from} → ${to}`);
  }
  const translation=tracks.get('Pelvis.position');if(!translation)throw Error('Missing root translation');
  source.updateMatrixWorld(true);target.updateMatrixWorld(true);
  const original=new Map([...sourceBones.values(),...targetBones.values()].map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone()}]));
  const sourceRest=new Map([...sourceBones].map(([name,b])=>[name,{p:point(b),q:rotation(b)}]));
  const targetRest=new Map([...targetBones].map(([name,b])=>[name,{p:point(b),q:rotation(b)}]));
  const srcLeg=point(sourceBones.get('L_Hip')!).distanceTo(point(sourceBones.get('L_Knee')!))+point(sourceBones.get('L_Knee')!).distanceTo(point(sourceBones.get('L_Ankle')!));
  const dstLeg=point(targetBones.get('LeftUpLeg')!).distanceTo(point(targetBones.get('LeftLeg')!))+point(targetBones.get('LeftLeg')!).distanceTo(point(targetBones.get('LeftFoot')!));
  const scale=dstLeg/srcLeg;if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid leg scale');
  const align=new Map<TargetName,Quaternion>();
  for(const to of Object.keys(MESHY_HY_MAP) as TargetName[]){
    const child=children[to];let q=new Quaternion();
    if(child){
      const a=targetRest.get(child)!.p.clone().sub(targetRest.get(to)!.p).normalize();
      const b=sourceRest.get(MESHY_HY_MAP[child])!.p.clone().sub(sourceRest.get(MESHY_HY_MAP[to])!.p).normalize();
      q.setFromUnitVectors(a,b);
    }else if(to.endsWith('Hand'))q.copy(align.get(to.startsWith('Left')?'LeftForeArm':'RightForeArm')!);
    align.set(to,q);
  }
  const meshes:SkinnedMesh[]=[];target.traverse(o=>{if('isSkinnedMesh'in o&&o.isSkinnedMesh)meshes.push(o as SkinnedMesh);});
  if(!meshes.length)throw Error('Target is not skinned');
  const soleSamples:{mesh:SkinnedMesh;index:number}[]=[];
  const restMin=Math.min(...meshes.flatMap(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).y)));
  for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++)if(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).y<restMin+dstLeg*.22)soleSamples.push({mesh,index:i});
  const soleY=()=>{for(const mesh of meshes)mesh.skeleton.update();return Math.min(...soleSamples.map(({mesh,index})=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y));};
  const frames=Math.round(sourceClip.duration*30),times=Array.from({length:frames+1},(_,i)=>i*sourceClip.duration/frames);
  const sourceFeet:number[]=[];
  const applySource=(time:number)=>{
    for(const from of Object.values(MESHY_HY_MAP))sourceBones.get(from)!.quaternion.fromArray(sample(tracks.get(`${from}.quaternion`)!,time));
    sourceBones.get('Pelvis')!.position.fromArray(sample(translation,time));source.updateMatrixWorld(true);
  };
  const rotations=new Map<string,number[]>(Object.keys(MESHY_HY_MAP).map(n=>[n,[]])),positions:number[]=[],samples:RetargetDiagnostics['samples']=[];
  try{
    for(const time of times){applySource(time);sourceFeet.push(Math.min(point(sourceBones.get('L_Foot')!).y,point(sourceBones.get('R_Foot')!).y));}
    // This jump profile starts standing on the floor. The clip-wide minimum
    // includes toe rotation during crouching and incorrectly lifts idle poses.
    const sourceFloor=sourceFeet[0],first=new Vector3(...sample(translation,0)),hips=targetBones.get('Hips')!,parent=hips.parent;
    if(!parent)throw Error('Missing target armature');
    for(let i=0;i<times.length;i++){
      const time=times[i];applySource(time);
      const worldPosition=targetRest.get('Hips')!.p.clone().add(new Vector3(...sample(translation,time)).sub(first).multiplyScalar(scale));
      hips.position.copy(parent.worldToLocal(worldPosition));target.updateMatrixWorld(true);
      for(const to of Object.keys(MESHY_HY_MAP) as TargetName[]){
        const bone=targetBones.get(to)!,from=MESHY_HY_MAP[to];
        const desired=retargetWorldRotation(rotation(sourceBones.get(from)!),sourceRest.get(from)!.q,targetRest.get(to)!.q,align.get(to));
        bone.quaternion.copy(rotation(bone.parent!).invert().multiply(desired).normalize());bone.updateMatrixWorld(true);
        rotations.get(to)!.push(...bone.quaternion.toArray());
      }
      target.updateMatrixWorld(true);
      const rawSoleY=soleY(),sourceClearance=Math.max(0,(sourceFeet[i]-sourceFloor)*scale-.015);
      const correctionY=correctGround?groundOffset(sourceClearance,rawSoleY):0;
      const correctedWorld=point(hips);correctedWorld.y+=correctionY;hips.position.copy(parent.worldToLocal(correctedWorld));target.updateMatrixWorld(true);
      positions.push(...hips.position.toArray());
      samples.push({time,sourceClearance,rawSoleY,soleY:soleY(),correctionY,hips:point(hips).toArray(),leftFoot:point(targetBones.get('LeftFoot')!).toArray(),rightFoot:point(targetBones.get('RightFoot')!).toArray()});
    }
  }finally{
    for(const [bone,rest] of original){bone.position.copy(rest.p);bone.quaternion.copy(rest.q);}source.updateMatrixWorld(true);target.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();
  }
  const clip=new AnimationClip(correctGround?'HY Jump · contact corrected':'HY Jump · raw retarget',sourceClip.duration,
    [...rotations].map(([name,values])=>new QuaternionKeyframeTrack(`${name}.quaternion`,times,values)));
  clip.tracks.push(new VectorKeyframeTrack('Hips.position',times,positions));
  return {clip,report:{sourceDuration:sourceClip.duration,frames,scale,groundCorrection:correctGround,
    ignoredFingerTracks:sourceClip.tracks.filter(t=>/^[LR]_(Index|Middle|Pinky|Ring|Thumb)/.test(t.name)).length,
    rawSoleMin:Math.min(...samples.map(s=>s.rawSoleY)),rawSoleMax:Math.max(...samples.map(s=>s.rawSoleY)),correctedSoleMin:Math.min(...samples.map(s=>s.soleY)),
    peakClearance:Math.max(...samples.map(s=>s.soleY)),maxVerticalCorrection:Math.max(...samples.map(s=>Math.abs(s.correctionY))),samples}};
}
