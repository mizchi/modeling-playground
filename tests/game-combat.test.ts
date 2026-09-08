import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, advanceCombat, WEAPONS } from '../game/combat.ts';
const targets=[{id:'a',position:[0,0,25],yaw:0},{id:'b',position:[9,0,32],yaw:0}];
const world={solids:[],targets};
const frame={eye:[0,4,0],forward:[0,0,1],aim:[0,3.8,25],mounts:{rifle:[0,3.8,1],missiles:[[-1,4,0],[1,4,0]]}};
const input={fire:false,lock:false};
const run=(state,controls,seconds,stage=world,hz=120)=>{
  for(let i=0;i<Math.round(seconds*hz);i++)state=advanceCombat(state,controls,frame,1/hz,stage);
  return state;
};
test('rifle fires from the muzzle, damages targets and does not mutate previous state',()=>{
  const state=createCombat(world),copy=structuredClone(state);
  const next=advanceCombat(state,{...input,fire:true},frame,1/120,world);
  assert.equal(next.shots,1);assert.ok(next.projectiles[0].position[2]>frame.mounts.rifle[2]);
  assert.deepEqual(state,copy);
  const hit=run(next,input,.3);
  assert.equal(hit.hp.a,WEAPONS.targetHp-WEAPONS.rifleDamage);assert.equal(hit.hits,1);
});
test('swept collision hits cover before the target and prevents fast bullets tunnelling',()=>{
  const stage={...world,solids:[{id:'wall',kind:'wall',center:[0,4,10],size:[20,8,.05],color:'#000'}]};
  const state=run(createCombat(stage),{...input,fire:true},1,stage,30);
  assert.equal(state.hp.a,WEAPONS.targetHp);assert.equal(state.hits,0);
  assert.ok(state.effects.length>0);
});
test('multi-lock requires dwell and visibility, releasing E launches two missiles per target',()=>{
  let state=run(createCombat(world),{...input,lock:true},.2);
  assert.ok(Object.values(state.locks).every(p=>p<1));
  state=run(state,{...input,lock:true},1);
  assert.equal(Object.values(state.locks).filter(p=>p===1).length,2);
  state=run(state,input,.6);
  assert.equal(state.missilesFired,4);assert.ok(state.projectiles.every(p=>p.kind==='missile'));
  assert.ok(state.projectiles.some(p=>p.position[1]>8),'Missiles rise in a ballistic loft before homing');
  state=run(state,input,5);
  assert.ok(state.hp.a<WEAPONS.targetHp&&state.hp.b<WEAPONS.targetHp,'Both locked targets take damage');
  const hidden={...world,solids:[{id:'wall',kind:'wall',center:[0,6,12],size:[40,12,1],color:'#000'}]};
  assert.equal(Object.keys(run(createCombat(hidden),{...input,lock:true},2,hidden).locks).length,0);
});
test('rifle cadence is frame-rate independent and destroyed targets stop taking damage',()=>{
  const a=run(createCombat(world),{...input,fire:true},4,world,30);
  const b=run(createCombat(world),{...input,fire:true},4,world,120);
  assert.equal(a.shots,b.shots);assert.equal(a.hp.a,0);assert.equal(b.hp.a,0);
  assert.equal(a.kills,1);assert.equal(b.kills,1);
});
test('pause cancels lock release and queued salvos, and projectiles have bounded lifetimes',()=>{
  let state=run(createCombat(world),{...input,lock:true},1);
  state=advanceCombat(state,{...input,cancel:true},frame,0,world);
  state=run(state,input,1);assert.equal(state.missilesFired,0);
  state=run(state,{...input,lock:true},1);state=run(state,input,.01);
  const fired=state.missilesFired;
  state=advanceCombat(state,{...input,cancel:true},frame,0,world);
  state=run(state,input,12);
  assert.equal(state.missilesFired,fired);assert.equal(state.projectiles.length,0);assert.equal(state.queue.length,0);
});

test('locks exclude targets behind the camera, beyond range, and over the three-target limit',()=>{
  const stage={solids:[],targets:[...targets,{id:'c',position:[-6,0,30],yaw:0},{id:'d',position:[3,0,40],yaw:0},
    {id:'rear',position:[0,0,-20],yaw:0},{id:'far',position:[0,0,150],yaw:0}]};
  const state=run(createCombat(stage),{...input,lock:true},2,stage);
  assert.equal(Object.keys(state.locks).length,3);assert.equal(state.locks.rear,undefined);assert.equal(state.locks.far,undefined);
  const turned=advanceCombat(state,{...input,lock:true},{...frame,forward:[0,0,-1]},1/60,stage);
  assert.equal(turned.locks.a,undefined,'Losing the cone clears previous locks');
});

test('launched missiles track changed target positions and cannot pass through a newly placed wall',()=>{
  const single={solids:[],targets:[targets[0]]};
  let state=run(createCombat(single),{...input,lock:true},1,single);
  state=run(state,input,.6,single);
  const moved={...single,targets:[{...targets[0],position:[12,0,25]}]};
  assert.ok(run(state,input,6,moved).hp.a<WEAPONS.targetHp);
  const blocked={...single,solids:[{id:'wall',kind:'wall',center:[0,25,15],size:[100,50,1],color:'#000'}]};
  assert.equal(run(state,input,6,blocked).hp.a,WEAPONS.targetHp);
});
