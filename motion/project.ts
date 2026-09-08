import { Quaternion } from 'three';
import { BODY_BONES, validatePose, validateProject } from './contract.ts';
import type { MotionPose, MotionProject } from './contract.ts';

export function samplePose(project: MotionProject, frame: number): MotionPose {
  if(!Number.isFinite(frame))throw new Error('再生位置が不正です');
  const keys=project.keys,t=Math.max(0,Math.min(frame,project.frames));
  // Binary search also handles dense imported clips without scanning every key.
  let low=0,high=keys.length-1;
  while(low+1<high){const mid=(low+high)>>1;if(keys[mid].frame<=t)low=mid;else high=mid;}
  const a=keys[low],b=keys[high],ratio=(t-a.frame)/(b.frame-a.frame),pose=structuredClone(a.pose);
  for(const bone of BODY_BONES)pose.rotations[bone]=new Quaternion(...a.pose.rotations[bone]).slerp(new Quaternion(...b.pose.rotations[bone]),ratio).normalize().toArray();
  for(const field of ['root','hips'] as const)for(let i=0;i<3;i++)pose[field][i]=a.pose[field][i]+(b.pose[field][i]-a.pose[field][i])*ratio;
  return pose;
}
export function putKey(project: MotionProject,frame: number,pose: MotionPose): MotionProject {
  const next=structuredClone(project);next.keys=next.keys.filter(k=>k.frame!==frame);
  next.keys.push({frame,pose:validatePose(pose)});next.keys.sort((a,b)=>a.frame-b.frame);return validateProject(next);
}
export function deleteKey(project: MotionProject,frame: number): MotionProject {
  if(frame===0||frame===project.frames)throw new Error('開始・終了キーは削除できません');
  return validateProject({...project,keys:project.keys.filter(k=>k.frame!==frame)});
}
export function moveKey(project: MotionProject,from: number,to: number): MotionProject {
  if(from===to)return validateProject(project);
  if(from===0||from===project.frames)throw new Error('開始・終了キーは移動できません');
  const key=project.keys.find(k=>k.frame===from);
  if(!key||project.keys.some(k=>k.frame===to))throw new Error('移動元がないか、移動先にキーがあります');
  return putKey(deleteKey(project,from),to,key.pose);
}
export function resizeClip(project: MotionProject,frames: number): MotionProject {
  const end=samplePose(project,frames),keys=project.keys.filter(k=>k.frame<frames);
  return validateProject({...project,frames,keys:[...keys,{frame:frames,pose:end}]});
}
export function referenceTime(project: MotionProject,frame: number): number {
  const r=project.reference;return r?Math.min(r.out,r.in+Math.max(0,frame)/project.fps):0;
}
export function createMotionHistory(initial: MotionProject) {
  let current=validateProject(initial);const past: MotionProject[]=[],future: MotionProject[]=[];
  return {
    get value(){return structuredClone(current);},get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    commit(next: MotionProject){
      const valid=validateProject(next);if(JSON.stringify(valid)===JSON.stringify(current))return;
      past.push(current);if(past.length>30)past.shift();current=valid;future.length=0;
    },
    undo(){if(past.length){future.push(current);current=past.pop()!;}return this.value;},
    redo(){if(future.length){past.push(current);current=future.pop()!;}return this.value;},
  };
}
