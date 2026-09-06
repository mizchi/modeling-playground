import {getRig} from './definition.mjs';

const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const norm=a=>mul(a,1/Math.hypot(...a));
const wrap=p=>((p%1)+1)%1;

/** Analytic two-bone IK. Never stretch bones to hide an unreachable target. */
function joint(start,end,a,b,bend) {
  const delta=sub(end,start),d=Math.hypot(...delta);
  if(d>=a+b||d<=Math.abs(a-b)) throw new Error('unreachable limb target');
  const axis=norm(delta),along=(a*a-b*b+d*d)/(2*d);
  const perpendicular=norm(sub(bend,mul(axis,dot(bend,axis))));
  return add(add(start,mul(axis,along)),mul(perpendicular,Math.sqrt(a*a-along*along)));
}

function foot(phase,rig) {
  const contact=phase<.5;
  if(contact) return {contact,z:rig.stride*(.5-2*phase),lift:0};
  const u=2*phase-1;
  // Hermite endpoints share the stance velocity. Lift has zero endpoint slope.
  return {contact,z:rig.stride*(-.5-u+6*u*u-4*u*u*u),lift:rig.lift*Math.sin(Math.PI*u)**2};
}

/** Pose is pure data: no renderer, clock, image generation, or mutable scene. */
export function sampleWalk(phase,proportion='legacy') {
  if(!Number.isFinite(phase)) throw new Error('phase must be finite');
  const rig=getRig(proportion),s=rig.bodyScale,w=rig.bodyWidth;
  const p=wrap(phase),bounce=-rig.bounce*Math.cos(4*Math.PI*p),sway=rig.sway*Math.sin(2*Math.PI*p);
  const pelvis=[sway,.845*s+bounce,0],chest=[sway*.5,1.205*s+bounce,.018*s];
  const pose={phase:p,pelvis,chest,head:[sway*.3,rig.headCenter+bounce,.038*s]};
  for(const [side,sign,offset] of [['left',-1,0],['right',1,.5]]) {
    const step=foot(wrap(p+offset),rig);
    const hip=add(pelvis,[sign*.105*w,0,0]);
    const ankle=[sign*.105*w,rig.ankleHeight+step.lift,step.z];
    const shoulder=add(chest,[sign*.20*w,.14*s,-step.z*.075]);
    const wrist=[sign*(.20*w+.055*s)+sway*.5,.905*s+bounce,-step.z*.80+.018*s];
    pose[side]={hip,ankle,knee:joint(hip,ankle,rig.upperLeg,rig.lowerLeg,[0,0,1]),
      shoulder,wrist,elbow:joint(shoulder,wrist,rig.upperArm,rig.lowerArm,[0,0,-1]),
      contact:step.contact};
  }
  return pose;
}
