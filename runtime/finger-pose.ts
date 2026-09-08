import {Quaternion,Vector3} from 'three';
import type {Object3D} from 'three';
import {fingerNames,handSides} from '../contracts/fingers.ts';
import type {FingerName,HandSide,FingerBoneMetadata} from '../contracts/fingers.ts';

interface Binding {bone:Object3D;metadata:FingerBoneMetadata;rest:Quaternion}
function metadata(value:unknown):FingerBoneMetadata|null{
  if(!value||typeof value!=='object')return null;
  const m=value as Partial<FingerBoneMetadata>;
  if(m.version!==1||!handSides.includes(m.side!)||!fingerNames.includes(m.finger!)||![0,1,2].includes(m.joint!)||!Array.isArray(m.restRotation)||m.restRotation.length!==4||!m.restRotation.every(Number.isFinite))return null;
  if(Math.abs(Math.hypot(...m.restRotation)-1)>.001)return null;
  return m as FingerBoneMetadata;
}

/** Bounded curl offsets around the authored relaxed pose. Does not touch wrist/body animation. */
export class FingerPose {
  private readonly bindings:Binding[];
  private readonly values=new Map<string,number>();
  private constructor(bindings:Binding[]){this.bindings=bindings;}
  static fromModel(root:Object3D):FingerPose|null{
    const bindings:Binding[]=[],keys=new Set<string>();
    root.traverse(bone=>{
      const m=metadata(bone.userData.fingerRig);if(!m)return;
      keys.add(`${m.side}:${m.finger}:${m.joint}`);
      bindings.push({bone,metadata:m,rest:new Quaternion().fromArray(m.restRotation)});
    });
    return bindings.length===30&&keys.size===30?new FingerPose(bindings):null;
  }
  set(side:HandSide,finger:FingerName,value:number):void{
    if(!handSides.includes(side)||!fingerNames.includes(finger)||!Number.isFinite(value)||value< -1||value>1)throw Error('Invalid finger curl');
    this.values.set(`${side}:${finger}`,value);
  }
  reset():void{this.values.clear();}
  apply():void{
    for(const {bone,metadata:m,rest} of this.bindings){
      const value=this.values.get(`${m.side}:${m.finger}`)??0;
      const range=(value<0?[.25,.35,.25]:[.18,.22,.16])[m.joint]*(m.finger==='Thumb'?.6:1);
      bone.quaternion.copy(rest).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-value*range));
    }
  }
}
