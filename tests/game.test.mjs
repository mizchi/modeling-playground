import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilot, advancePilot, cameraPosition, cameraAim, cameraTarget, constrainCamera, viewFocus, MOVEMENT } from '../game/simulation.ts';
import { PerspectiveCamera, Vector3 } from 'three';
import { STAGE } from '../game/stage.ts';

const input=(extra={})=>({forward:0,strafe:0,boost:false,jump:false,yaw:0,pitch:.25,...extra});
const empty={...STAGE,solids:[],targets:[]};
const run=(controls,seconds=2,world=empty,hz=120,start=createPilot())=>{
  let state=start;
  for(let i=0;i<seconds*hz;i++)state=advancePilot(state,controls,1/hz,world);
  return state;
};
test('TPS input is camera-relative, diagonal speed is normalized, and simulation is pure',()=>{
  const initial=createPilot(),copy=structuredClone(initial);
  const forward=run(input({forward:1}));
  assert.ok(forward.position[2]>initial.position[2]+2);
  const right=run(input({strafe:1}));
  assert.ok(right.position[0]<initial.position[0]-2,'Screen-right is -X while facing +Z');
  const turned=run(input({forward:1,yaw:Math.PI/2}));
  assert.ok(turned.position[0]>initial.position[0]+2);
  const diagonal=run(input({forward:1,strafe:1}));
  assert.ok(Math.abs(Math.hypot(...diagonal.velocity)-Math.hypot(...forward.velocity))<1e-8);
  advancePilot(initial,input({forward:1}),.1,empty);
  assert.deepEqual(initial,copy);
});
test('motion is frame-rate independent and boost is faster without changing the walk contract',()=>{
  const a=run(input({forward:1}),2,empty,30),b=run(input({forward:1}),2,empty,120);
  assert.ok(Math.abs(a.position[2]-b.position[2])<.02);
  const fast=run(input({forward:1,boost:true}));
  assert.ok(fast.position[2]-createPilot().position[2]>(a.position[2]-createPilot().position[2])*3);
  assert.ok(fast.boostWeight>.95);
  const stopped=run(input(),3,empty,120,fast);
  assert.ok(Math.hypot(...stopped.velocity)<.001);
});
test('player cannot tunnel through obstacles, slides along walls and stays within the yard',()=>{
  const wall={id:'wall',kind:'wall',center:[0,3,-30],size:[14,6,1],color:'#444'};
  const world={...empty,solids:[wall]};
  const blocked=run(input({forward:1,boost:true}),5,world);
  assert.ok(blocked.position[2]<=-30-.5-MOVEMENT.radius+.001);
  const slide=run(input({forward:1,strafe:1,boost:true}),1,world,120,blocked);
  assert.ok(slide.position[0]<blocked.position[0]-1);
  const bound=run(input({forward:1,boost:true}),30);
  assert.ok(bound.position[2]<=STAGE.bounds.maxZ-MOVEMENT.radius+.001);
});
test('camera is behind the robot and retracts before crossing cover',()=>{
  const state=createPilot(),target=[0,2.5,-36];
  const eye=cameraPosition(state);
  assert.ok(eye[2]<state.position[2]);assert.ok(eye[1]>2.5);
  const wall={id:'wall',kind:'wall',center:[0,4,-41],size:[20,8,1],color:'#444'};
  const safe=constrainCamera(target,[0,4,-48],[wall]);
  assert.ok(safe[2]>-40.5);
  assert.deepEqual(constrainCamera(target,eye,[]),eye);
});
test('stage provides both model roles and a collision-free deployment pad',()=>{
  assert.ok(STAGE.targets.length>=2);
  const state=createPilot(),idle=advancePilot(state,input(),.1,STAGE);
  assert.deepEqual(idle.position,state.position);
  assert.ok(STAGE.solids.some(s=>s.kind==='warehouse'));
});

test('walk and boost top speeds are twice the initial prototype speeds',()=>{
  assert.equal(MOVEMENT.walkSpeed,3.2);assert.equal(MOVEMENT.boostSpeed,14.4);
  assert.ok(Math.abs(run(input({forward:1})).velocity[2]-3.2)<.001);
  assert.ok(Math.abs(run(input({forward:1,boost:true})).velocity[2]-14.4)<.001);
});

test('default TPS framing leaves the center clear and can pull back even at the deployment pad',()=>{
  const state=createPilot(),pivot=cameraTarget(state),eye=constrainCamera(pivot,cameraPosition(state),STAGE.solids);
  assert.ok(new Vector3(...eye).distanceTo(new Vector3(...pivot))>=16,'Actual collision-resolved boom, not just desired distance');
  assert.ok(eye[2]>STAGE.bounds.minZ+.3,'Deployment camera stays inside the perimeter, not behind the wall cap');
  const camera=new PerspectiveCamera(58,1280/900,.15,260);
  camera.position.fromArray(eye);camera.lookAt(...cameraAim(state));camera.updateMatrixWorld(true);
  const head=new Vector3(state.position[0],3.46,state.position[2]).project(camera);
  const foot=new Vector3(state.position[0],0,state.position[2]).project(camera);
  assert.ok(head.y<-.12,'Head is below the center reticle');
  assert.ok(foot.y>-.9,'Feet remain visible');
  const feet=[state.position[0],0,state.position[2]];
  assert.ok(new Vector3(...viewFocus(eye,feet,STAGE.solids)).distanceTo(new Vector3(...feet))<1e-6,
    'A wall behind the player must not occlude the feet from the pulled-back camera');
});

test('focus follows the center ray to the nearest obstacle or ground, with a distant fallback',()=>{
  const near={id:'near',kind:'wall',center:[0,3,20],size:[4,6,2],color:'#444'};
  const far={...near,id:'far',center:[0,3,40]};
  assert.deepEqual(viewFocus([0,3,0],[0,3,5],[far,near]),[0,3,19]);
  assert.deepEqual(viewFocus([0,3,0],[0,3,5],[]),[0,3,100]);
  assert.deepEqual(viewFocus([0,3,0],[0,0,3],[]),[0,0,3]);
  assert.deepEqual(viewFocus([0,3,0],[0,3,0],[]),[0,3,100]);
});

test('Space taps jump once and land; holding transitions to sustained air boost',()=>{
  let state=advancePilot(createPilot(),input({jump:true}),1/60,empty);
  assert.ok(state.position[1]>0&&state.velocity[1]>0);assert.equal(state.grounded,false);
  const tap=run(input(),2,empty,120,state);
  assert.equal(tap.position[1],0);assert.equal(tap.grounded,true);
  const held=run(input({jump:true,forward:1}),1.2);
  assert.ok(held.position[1]>5&&held.velocity[1]>5);assert.ok(held.boostWeight>.95);
  assert.ok(held.velocity[2]>14,'Holding Space also boosts horizontal travel');
  const falling=run(input(),1,empty,120,held);assert.ok(falling.velocity[1]<0);
  const landed=run(input(),3,empty,120,falling);assert.equal(landed.position[1],0);
  const again=advancePilot(landed,input({jump:true}),1/60,empty);assert.ok(again.velocity[1]>0);
});

test('airborne motion lands on roofs, steps off them, and camera height follows the pilot',()=>{
  const roof={id:'platform',kind:'container',center:[0,1,-36],size:[12,2,12],color:'#000'};
  const world={...empty,solids:[roof]},initial={...createPilot(),position:[0,8,-36],grounded:false};
  const landed=run(input(),2,world,120,initial);
  assert.equal(landed.position[1],2);assert.equal(landed.grounded,true);
  const off=run(input({forward:1,boost:true}),2,world,120,landed);
  assert.equal(off.position[1],0);assert.equal(off.grounded,true);
  const ground=createPilot(),air={...ground,position:[0,10,-36]};
  assert.equal(cameraPosition(air)[1]-cameraPosition(ground)[1],10);
  assert.equal(cameraAim(air)[1]-cameraAim(ground)[1],10);
  const a=run(input({jump:true}),1,empty,30),b=run(input({jump:true}),1,empty,120);
  assert.ok(Math.abs(a.position[1]-b.position[1])<.02);
});

test('air input does not double-jump, boost height is bounded, and low ceilings stop ascent',()=>{
  const air={...createPilot(),position:[0,10,-36],velocity:[0,-2,0],grounded:false};
  const next=advancePilot(air,input({jump:true}),1/60,empty);
  assert.ok(next.velocity[1]<air.velocity[1],'No jump impulse without contact');
  const hover=run(input({jump:true}),12);assert.equal(hover.position[1],MOVEMENT.flightCeiling);
  const ceiling={id:'ceiling',kind:'warehouse',center:[0,7,-36],size:[20,2,20],color:'#000'};
  const under=run(input({jump:true}),2,{...empty,solids:[ceiling]});
  assert.ok(under.position[1]+MOVEMENT.height<=6+1e-6);
});
