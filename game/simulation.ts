import type { PilotInput, PilotState, Solid, StageDefinition, Vec3 } from './types.ts';
import { STAGE, stageColliders } from './stage.ts';

export const MOVEMENT=Object.freeze({walkSpeed:3.2,boostSpeed:14.4,acceleration:9,radius:3,cameraDistance:17,
  gravity:18,jumpSpeed:8,boostDelay:.22,airRiseSpeed:7.5,height:3.6,flightCeiling:40});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function createPilot(stage:StageDefinition=STAGE):PilotState {
  return {position:[...stage.spawn],velocity:[0,0,0],yaw:0,pitch:.25,gaitTime:0,boostWeight:0,
    grounded:true,jumpHeldTime:0,jumpWasDown:false};
}

function overlapsFootprint(p:Vec3,box:Solid):boolean {
  return Math.hypot(p[0]-clamp(p[0],box.center[0]-box.size[0]/2,box.center[0]+box.size[0]/2),
    p[2]-clamp(p[2],box.center[2]-box.size[2]/2,box.center[2]+box.size[2]/2))<MOVEMENT.radius;
}

function depenetrate(p:Vec3,box:Solid,radius:number) {
  const minX=box.center[0]-box.size[0]/2,maxX=box.center[0]+box.size[0]/2;
  const minZ=box.center[2]-box.size[2]/2,maxZ=box.center[2]+box.size[2]/2;
  const dx=p[0]-clamp(p[0],minX,maxX),dz=p[2]-clamp(p[2],minZ,maxZ),distance=Math.hypot(dx,dz);
  if(distance>=radius)return;
  if(distance>1e-8) {p[0]+=dx*(radius-distance)/distance;p[2]+=dz*(radius-distance)/distance;return;}
  const exits=[[minX-radius-p[0],0],[maxX+radius-p[0],0],[0,minZ-radius-p[2]],[0,maxZ+radius-p[2]]];
  exits.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));p[0]+=exits[0][0];p[2]+=exits[0][1];
}

/** Pure, bounded-substep kinematics. Rendering, input and React state are not involved. */
export function advancePilot(previous:PilotState,input:PilotInput,delta:number,stage:StageDefinition=STAGE):PilotState {
  const state: PilotState={...previous,position:[...previous.position],velocity:[...previous.velocity],yaw:input.yaw,pitch:clamp(input.pitch,-.2,1.05)};
  const dt=clamp(Number.isFinite(delta)?delta:0,0,.1),steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  const length=Math.max(1,Math.hypot(input.forward,input.strafe)),f=input.forward/length,r=input.strafe/length;
  const moving=Math.abs(f)+Math.abs(r)>.01;
  const colliders=stageColliders(stage);
  if(dt>0&&input.jump&&!previous.jumpWasDown&&state.grounded){state.velocity[1]=MOVEMENT.jumpSpeed;state.grounded=false;}
  for(let i=0;i<steps;i++) {
    state.jumpHeldTime=input.jump?state.jumpHeldTime+h:0;
    const airBoost=input.jump&&state.jumpHeldTime>=MOVEMENT.boostDelay&&!state.grounded;
    const boost=(input.boost&&moving)||airBoost,speed=boost?MOVEMENT.boostSpeed:MOVEMENT.walkSpeed;
    const desiredX=(Math.sin(state.yaw)*f-Math.cos(state.yaw)*r)*speed;
    const desiredZ=(Math.cos(state.yaw)*f+Math.sin(state.yaw)*r)*speed;
    const blend=1-Math.exp(-MOVEMENT.acceleration*h);
    state.velocity[0]+=(desiredX-state.velocity[0])*blend;
    state.velocity[2]+=(desiredZ-state.velocity[2])*blend;
    const start=[...state.position];
    state.position[0]+=state.velocity[0]*h;state.position[2]+=state.velocity[2]*h;
    state.velocity[1]+=airBoost?(MOVEMENT.airRiseSpeed-state.velocity[1])*(1-Math.exp(-6*h)):-MOVEMENT.gravity*h;
    state.position[1]+=state.velocity[1]*h;state.grounded=false;
    // Swept vertical contacts: land on roofs, but do not teleport up their sides.
    let floor=0;
    for(const box of colliders)if(overlapsFootprint(state.position,box)) {
      const top=box.center[1]+box.size[1]/2,bottom=box.center[1]-box.size[1]/2;
      if(start[1]>=top-1e-6)floor=Math.max(floor,top);
      if(state.velocity[1]>0&&start[1]+MOVEMENT.height<=bottom&&state.position[1]+MOVEMENT.height>=bottom) {
        state.position[1]=bottom-MOVEMENT.height;state.velocity[1]=0;
      }
    }
    if(state.velocity[1]<=0&&state.position[1]<=floor){state.position[1]=floor;state.velocity[1]=0;state.grounded=true;}
    if(state.position[1]>MOVEMENT.flightCeiling){state.position[1]=MOVEMENT.flightCeiling;state.velocity[1]=Math.min(0,state.velocity[1]);}
    // Repeated projection resolves corners shared by multiple solids.
    for(let pass=0;pass<3;pass++)for(const box of colliders)
      if(state.position[1]<box.center[1]+box.size[1]/2-1e-6&&state.position[1]+MOVEMENT.height>box.center[1]-box.size[1]/2+1e-6)
        depenetrate(state.position,box,MOVEMENT.radius);
    state.position[0]=clamp(state.position[0],stage.bounds.minX+MOVEMENT.radius,stage.bounds.maxX-MOVEMENT.radius);
    state.position[2]=clamp(state.position[2],stage.bounds.minZ+MOVEMENT.radius,stage.bounds.maxZ-MOVEMENT.radius);
    const distance=Math.hypot(state.position[0]-start[0],state.position[2]-start[2]);
    if(h>0) {state.velocity[0]=(state.position[0]-start[0])/h;state.velocity[2]=(state.position[2]-start[2])/h;}
    state.gaitTime+=distance/(.72/(.62*2.4));
    state.boostWeight+=((boost?1:0)-state.boostWeight)*(1-Math.exp(-7*h));
  }
  if(dt>0)state.jumpWasDown=Boolean(input.jump);
  return state;
}

export function cameraTarget(state:PilotState):Vec3 {return [state.position[0],state.position[1]+4+state.boostWeight*.5,state.position[2]];}
export function cameraAim(state:PilotState):Vec3 {
  const target=cameraTarget(state);
  // Look past the chassis with a shoulder offset, leaving the center free for aiming.
  return [target[0]+Math.sin(state.yaw)*12-Math.cos(state.yaw)*2.4,target[1],
    target[2]+Math.cos(state.yaw)*12+Math.sin(state.yaw)*2.4];
}
export function cameraPosition(state:PilotState):Vec3 {
  const target=cameraTarget(state),d=MOVEMENT.cameraDistance;
  return [target[0]-Math.sin(state.yaw)*Math.cos(state.pitch)*d-Math.cos(state.yaw)*1.5,
    target[1]+Math.sin(state.pitch)*d+1.5,target[2]-Math.cos(state.yaw)*Math.cos(state.pitch)*d+Math.sin(state.yaw)*1.5];
}

/** Distance along a segment to the first box intersection, or null when it misses. */
export function boxIntersection(origin:Vec3,delta:Vec3,box:Solid,padding=0):number|null {
  let enter=0,exit=1;
  for(let axis=0;axis<3;axis++) {
    const min=box.center[axis]-box.size[axis]/2-padding,max=box.center[axis]+box.size[axis]/2+padding;
    if(Math.abs(delta[axis])<1e-9) {if(origin[axis]<min||origin[axis]>max)return null;continue;}
    const a=(min-origin[axis])/delta[axis],b=(max-origin[axis])/delta[axis];
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit)return null;
  }
  return enter;
}

/** Actual center-screen focus; the short camera composition point is not an aiming target. */
export function viewFocus(eye:Vec3,look:Vec3,solids:readonly Solid[]):Vec3 {
  const direction=look.map((v,i)=>v-eye[i]) as Vec3,length=Math.hypot(...direction);
  const delta:Vec3=length>1e-9?direction.map(v=>v/length*100) as Vec3:[0,0,100];
  let nearest=1;
  for(const box of solids) {
    const hit=boxIntersection(eye,delta,box);
    if(hit!==null)nearest=Math.min(nearest,hit);
  }
  if(delta[1]<-1e-9&&eye[1]>=0)nearest=Math.min(nearest,eye[1]/-delta[1]);
  return eye.map((v,i)=>v+delta[i]*nearest) as Vec3;
}

/** Segment vs expanded AABBs; used after camera smoothing so interpolation cannot cross a wall. */
export function constrainCamera(target:Vec3,desired:Vec3,solids:readonly Solid[]):Vec3 {
  const delta=desired.map((v,i)=>v-target[i]) as Vec3;let nearest=1;
  for(const box of solids) {
    const hit=boxIntersection(target,delta,box,.3);
    if(hit!==null)nearest=Math.min(nearest,Math.max(.01,hit-.025));
  }
  return target.map((v,i)=>v+delta[i]*nearest) as Vec3;
}
