import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { STRIX_GAIT as G, STRIX_LEGS, STRIX_SPEC } from './strix-definition.mjs';
import { solveTwoBone } from '../runtime/solvers.mjs';
import { bakePoseClips } from '../modeling/bake-motion.mjs';

const modulo=v=>((v%1)+1)%1;
const smooth=t=>t*t*(3-2*t);
// -Y follows the limb. +Z is the upward-facing armor surface, with a stable
// roll frame rather than unconstrained rotation about the limb's long axis.
export function limbFrame(direction,facing=new Vector3(0,1,0)) {
  const y=direction.clone().normalize().negate();
  let z=facing.clone().addScaledVector(y,-facing.dot(y));
  if(z.lengthSq()<1e-8)z=new Vector3(0,0,1).addScaledVector(y,-y.z);
  z.normalize();const x=new Vector3().crossVectors(y,z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}
const euler=q=>new Euler().setFromQuaternion(q).toArray().slice(0,3);
const rest=Object.fromEntries(STRIX_LEGS.map(l=>[l.id,{
  upper:limbFrame(new Vector3(...l.knee).sub(new Vector3(...l.hip))).invert(),
  lower:limbFrame(new Vector3(...l.ankle).sub(new Vector3(...l.knee)),new Vector3(l.side,0,l.fore)).invert(),
}]));

export function strixPose(name,time) {
  if(!STRIX_SPEC.clips.some(c=>c.name===name))throw new Error(`Unknown Strix clip: ${name}`);
  const walking=name!=='Idle',cycle=time/G.duration;
  const travel=name==='Advance'?time*G.speed:0;
  // Diagonal support replaces the former single-leg weight shift. Keep the
  // chassis centered, with only a small vertical response per half cycle.
  const bob=walking?.022*Math.cos(cycle*Math.PI*4):.018*Math.sin(cycle*Math.PI*2);
  const position=[0,bob,travel],origin=new Vector3(...position),feet={};
  const rotations=Object.fromEntries(STRIX_SPEC.rig.bones.filter(b=>b.name!=='Motion').map(b=>[b.name,[0,0,0]]));
  const roll=walking?.014*Math.sin(cycle*Math.PI*2):0;
  rotations.Torso=[walking?.012*Math.sin(cycle*Math.PI*4):0,0,roll];
  rotations.Head=[0,0,-roll];
  for(const leg of STRIX_LEGS) {
    const u=modulo(cycle+leg.phase),contact=!walking || u<G.duty;
    let advance=0,lift=0;
    if(walking && contact)advance=G.stride*(.5-u/G.duty);
    else if(walking) {
      const p=(u-G.duty)/(1-G.duty),tangent=-G.stride*(1-G.duty)/G.duty;
      advance=-G.stride/2+G.stride*smooth(p)+tangent*p*(1-p)*(1-2*p);
      lift=G.lift*Math.sin(Math.PI*p)**2;
    }
    const hip=new Vector3(...leg.hip).add(origin);
    // Targets are defined in world space; body sway must not drag planted feet.
    const target=new Vector3(leg.ankle[0],G.footHeight+lift,leg.ankle[2]+advance+travel);
    const pole=new Vector3(...leg.pole).add(origin);
    const {joint:knee,end:ankle,clamped}=solveTwoBone(hip,target,pole,G.upper,G.lower);
    const upper=limbFrame(knee.clone().sub(hip)).multiply(rest[leg.id].upper);
    const lower=limbFrame(ankle.clone().sub(knee),new Vector3(leg.side,0,leg.fore)).multiply(rest[leg.id].lower);
    rotations[leg.id+'Upper']=euler(upper);
    rotations[leg.id+'Lower']=euler(upper.clone().invert().multiply(lower));
    rotations[leg.id+'Foot']=euler(lower.clone().invert());
    feet[leg.id]={hip,knee,ankle,contact,phase:u,clamped};
  }
  return {position,rotations,scales:{},feet};
}

export function strixClips() {
  return bakePoseClips({clips:STRIX_SPEC.clips,rootBone:'Motion',
    joints:STRIX_SPEC.rig.bones.filter(b=>b.name!=='Motion').map(b=>b.name),scaleJoints:[],sample:strixPose,
    extraTimes:()=>STRIX_LEGS.flatMap(l=>[modulo(-l.phase)*G.duration,modulo(G.duty-l.phase)*G.duration])});
}
