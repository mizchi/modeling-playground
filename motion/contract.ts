import { presetRecipe, validateRecipe } from '../human/contract.ts';
import type { HumanRecipe } from '../human/contract.ts';

export const BODY_BONES = ['Root','Hips','Spine','Chest','Neck','Head',
  'LeftClavicle','LeftUpperArm','LeftForearm','LeftHand','LeftThigh','LeftShin','LeftFoot','LeftToe',
  'RightClavicle','RightUpperArm','RightForearm','RightHand','RightThigh','RightShin','RightFoot','RightToe'] as const;
export type BodyBone = typeof BODY_BONES[number];
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
/** Rotations are BASE-45 local quaternions. Translations are meter offsets from rest. */
export interface MotionPose { rotations: Record<BodyBone, Quat>; root: Vec3; hips: Vec3 }
export interface MotionKey { frame: number; pose: MotionPose }
export interface VideoReference { name: string; duration: number; in: number; out: number }
export interface MotionProject {
  version: 1; rig: 'base45-v1'; name: string; fps: 24 | 30 | 60; frames: number; loop: boolean;
  recipe: HumanRecipe; keys: MotionKey[]; reference: VideoReference | null;
}
export function restPose(): MotionPose {
  return {rotations:Object.fromEntries(BODY_BONES.map(name=>[name,[0,0,0,1]])) as Record<BodyBone,Quat>,root:[0,0,0],hips:[0,0,0]};
}
export function createProject(): MotionProject {
  return {version:1,rig:'base45-v1',name:'Untitled motion',fps:30,frames:60,loop:true,
    recipe:presetRecipe('lumi'),keys:[{frame:0,pose:restPose()},{frame:60,pose:restPose()}],reference:null};
}
function object(value: unknown, keys: readonly string[]): Record<string,unknown> {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('JSONオブジェクトが必要です');
  const record=value as Record<string,unknown>;
  if(Object.keys(record).length!==keys.length || keys.some(k=>!Object.hasOwn(record,k)))throw new Error('JSONのフィールドが一致しません');
  return record;
}
function number(value: unknown,min: number,max: number): number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`数値の範囲が不正です (${min}〜${max})`);
  return value;
}
function text(value: unknown): string {
  if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error('名前は1〜200文字にしてください');return value;
}
function vector(value: unknown,size: number): number[] {
  if(!Array.isArray(value)||value.length!==size)throw new Error('ベクトルの要素数が不正です');
  return value.map(v=>number(v,-1000,1000));
}
export function validatePose(input: unknown): MotionPose {
  const p=object(input,['rotations','root','hips']),q=object(p.rotations,BODY_BONES);
  const rotations=Object.fromEntries(BODY_BONES.map(name=>{
    const value=vector(q[name],4) as Quat;
    if(Math.abs(Math.hypot(...value)-1)>1e-4)throw new Error(`回転が正規化されていません: ${name}`);
    return [name,value];
  })) as Record<BodyBone,Quat>;
  return {rotations,root:vector(p.root,3) as Vec3,hips:vector(p.hips,3) as Vec3};
}
export function validateProject(input: unknown): MotionProject {
  const p=object(input,['version','rig','name','fps','frames','loop','recipe','keys','reference']);
  if(p.version!==1||p.rig!=='base45-v1')throw new Error('未対応のモーションversion / rigです');
  if(p.fps!==24&&p.fps!==30&&p.fps!==60)throw new Error('FPSは24 / 30 / 60です');
  const frames=number(p.frames,1,p.fps*600);
  if(!Number.isInteger(frames)||typeof p.loop!=='boolean')throw new Error('フレーム数・ループ設定が不正です');
  if(!Array.isArray(p.keys)||p.keys.length<2||p.keys.length>6000)throw new Error('キー数は2〜6000です');
  let previous=-1;
  const keys=p.keys.map(value=>{
    const k=object(value,['frame','pose']),frame=number(k.frame,0,frames);
    if(!Number.isInteger(frame)||frame<=previous)throw new Error('キーは重複のないフレーム昇順で指定してください');
    previous=frame;return {frame,pose:validatePose(k.pose)};
  });
  if(keys[0].frame!==0||keys.at(-1)!.frame!==frames)throw new Error('開始・終了キーが必要です');
  let reference: VideoReference | null=null;
  if(p.reference!==null){
    const r=object(p.reference,['name','duration','in','out']),duration=number(r.duration,.001,86400);
    const start=number(r.in,0,duration),end=number(r.out,0,duration);
    if(end<=start)throw new Error('動画のOUTはINより後にしてください');
    reference={name:text(r.name),duration,in:start,out:end};
  }
  return {version:1,rig:'base45-v1',name:text(p.name),fps:p.fps,frames,loop:p.loop,
    recipe:validateRecipe(p.recipe),keys,reference};
}
