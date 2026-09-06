import { Bone, Euler, Object3D, Quaternion, Vector3 } from 'three';
import { strixPose } from '../models/strix-motion.mjs';
import type { PilotState, Vec3 } from './types.ts';

interface RigPose {position:number[];rotations:Record<string,Vec3>;scales:Record<string,Vec3>}

/** An unoriented axis repeats every half turn. Resolve exact quarter-turn ties consistently. */
function axisDelta(angle:number):number {
  const delta=angle-Math.PI*Math.floor((angle+Math.PI/2)/Math.PI);
  return Math.abs(Math.abs(delta)-Math.PI/2)<1e-8?-Math.PI/2:delta;
}

/** Owns only visual interpolation. World movement remains owned by the simulation. */
export class PilotAnimator {
  private root:Object3D;
  private bones:Record<string,Bone>={};
  private movement=0;
  private heading=0;
  private previousGaitTime=0;
  private walkTime=0;
  private airborne=0;
  private a=new Quaternion();
  private b=new Quaternion();
  private e=new Euler();
  private point=new Vector3();
  private idle=strixPose('Idle',0) as RigPose;
  private boost=strixPose('Boost',1.4) as RigPose;

  constructor(root:Object3D) {
    this.root=root;
    root.traverse(node=>{if((node as Bone).isBone)this.bones[node.name]=node as Bone;});
  }

  update(state:PilotState,focus:Vec3,delta:number) {
    // A rewind comes from resetting the pilot. Do not carry the previous visual axis/phase across it.
    if(state.gaitTime<this.previousGaitTime) {
      this.heading=state.yaw;this.movement=0;this.walkTime=0;this.airborne=0;this.previousGaitTime=state.gaitTime;
    }
    const speed=Math.hypot(state.velocity[0],state.velocity[2]),blend=1-Math.exp(-10*Math.max(0,Math.min(delta,.1)));
    this.airborne+=((state.grounded?0:1)-this.airborne)*blend;
    this.movement+=((speed>.04?1:0)-this.movement)*blend;
    if(speed>.04)this.heading+=axisDelta(Math.atan2(state.velocity[0],state.velocity[2])-this.heading)*blend;
    // Integrate signed phase increments; multiplying accumulated time by a sign would pop on reversal.
    const along=state.velocity[0]*Math.sin(this.heading)+state.velocity[2]*Math.cos(this.heading);
    this.walkTime+=(state.gaitTime-this.previousGaitTime)*Math.sign(along);
    this.previousGaitTime=state.gaitTime;
    this.root.position.fromArray(state.position);this.root.rotation.y=this.heading;
    const walk=strixPose('Walk',this.walkTime) as RigPose,flight=Math.max(state.boostWeight,this.airborne),thrust=state.boostWeight;
    for(const [name,bone] of Object.entries(this.bones)) {
      if(name==='Motion') {
        bone.position.set(0,walk.position[1]*this.movement*(1-flight)+this.boost.position[1]*flight,0);
        continue;
      }
      this.a.setFromEuler(this.e.set(...this.idle.rotations[name],'XYZ'));
      this.b.setFromEuler(this.e.set(...walk.rotations[name],'XYZ'));this.a.slerp(this.b,this.movement);
      this.b.setFromEuler(this.e.set(...this.boost.rotations[name],'XYZ'));bone.quaternion.copy(this.a.slerp(this.b,flight));
      if(this.boost.scales[name])bone.scale.set(...this.boost.scales[name].map((v,i)=>this.idle.scales[name][i]+(v-this.idle.scales[name][i])*thrust) as Vec3);
    }
    this.root.updateMatrixWorld(true);
    // Waist is independent of the leg chassis. Children need world-space correction too:
    // the boost pose already counter-rotates its head, cannons and rifle grip.
    for(const name of ['Torso','Head','LeftCannon','RightCannon','RightHand'])this.facePoint(this.bones[name],focus);
  }

  private facePoint(bone:Bone,focus:Vec3) {
    bone.getWorldPosition(this.point);
    this.point.set(focus[0]-this.point.x,focus[1]-this.point.y,focus[2]-this.point.z);
    if(this.point.lengthSq()<1e-10)return;
    const yaw=Math.atan2(this.point.x,this.point.z),pitch=-Math.atan2(this.point.y,Math.hypot(this.point.x,this.point.z));
    this.a.setFromEuler(this.e.set(pitch,yaw,0,'YXZ'));
    if(bone.parent) {
      bone.parent.getWorldQuaternion(this.b);
      this.a.premultiply(this.b.invert());
    }
    bone.quaternion.copy(this.a);bone.updateMatrixWorld(true);
  }
}
