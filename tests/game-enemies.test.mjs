import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemies, advanceEnemies, enemyTargets, enemyMuzzle, ENEMY, findRoute } from '../game/enemies.ts';
import { createBastion } from '../models/bastion.mjs';
import { Vector3 } from 'three';
import { createPilot, boxIntersection } from '../game/simulation.ts';
import { createCombat, advanceCombat } from '../game/combat.ts';

const world={bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},spawn:[0,0,0],solids:[],targets:[{id:'a',position:[0,0,24],yaw:Math.PI}]};
const pilot=createPilot(world),hp={a:180};
function run(state,seconds,{stage=world,player=pilot,health=hp,hz=60,active=true}={}) {
  for(let i=0;i<seconds*hz;i++)state=advanceEnemies(state,player,health,1/hz,stage,active);
  return state;
}
test('enemy AI is immutable, acquires visible players, telegraphs and damages with travelling projectiles',()=>{
  const initial=createEnemies(world),copy=structuredClone(initial);
  const warned=run(initial,3);
  assert.deepEqual(initial,copy);assert.ok(warned.units[0].lastSeen);
  assert.ok(warned.units[0].mode==='attack');
  const result=run(warned,8);
  assert.ok(result.shots>0);assert.ok(result.playerHp<ENEMY.playerHp);assert.ok(result.hits>0);
  assert.notDeepEqual(enemyTargets(result)[0].position,world.targets[0].position);
});
test('cover blocks detection and fire; lost sight searches last known position then returns to patrol',()=>{
  const wall={id:'wall',kind:'wall',center:[0,5,12],size:[100,10,2],color:'#000'};
  const hidden={...world,solids:[wall]};
  let state=run(createEnemies(hidden),2,{stage:hidden});
  assert.equal(state.shots,0);assert.equal(state.units[0].lastSeen,null);
  state=run(createEnemies(world),1);
  const lastSeen=structuredClone(state.units[0].lastSeen);
  state=run(state,.2,{stage:hidden,player:{...pilot,position:[40,0,0]}});
  assert.equal(state.units[0].mode,'search');assert.deepEqual(state.units[0].lastSeen,lastSeen);
  state=run(state,ENEMY.memory+1,{stage:hidden});
  assert.equal(state.units[0].mode,'patrol');assert.equal(state.units[0].lastSeen,null);assert.equal(state.shots,0);
});
test('navigation routes around expanded cover and every route segment has chassis clearance',()=>{
  const wall={id:'cover',kind:'barrier',center:[0,3,12],size:[12,6,3],color:'#000'};
  const stage={...world,solids:[wall]},start=[0,0,24],goal=[0,0,0];
  const path=findRoute(start,goal,stage);
  assert.ok(path.length>=3);let previous=start;
  for(const next of path) {
    const delta=next.map((v,i)=>v-previous[i]);
    assert.equal(boxIntersection([previous[0],3,previous[2]],delta,wall,ENEMY.radius),null);
    previous=next;
  }
  assert.deepEqual(path.at(-1),goal);
});
test('moving enemies remain outside cover, each other and player; corpses stop targeting',()=>{
  const stage={...world,targets:[...world.targets,{id:'b',position:[6.5,0,24],yaw:Math.PI}],
    solids:[{id:'cover',kind:'barrier',center:[0,3,12],size:[12,6,3],color:'#000'}]};
  let state=createEnemies(stage);
  for(let i=0;i<900;i++) {
    state=advanceEnemies(state,pilot,{a:180,b:180},1/60,stage,true);
    for(const unit of state.units) {
      assert.equal(boxIntersection([unit.position[0],3,unit.position[2]],[0,0,0],stage.solids[0],ENEMY.radius-.01),null);
      assert.ok(Math.hypot(unit.position[0],unit.position[2])>=ENEMY.radius+3-.01);
    }
    assert.ok(Math.hypot(state.units[0].position[0]-state.units[1].position[0],state.units[0].position[2]-state.units[1].position[2])>=ENEMY.radius*2-.01);
  }
  const dead=run(state,2,{stage,health:{a:0,b:0}});
  assert.equal(enemyTargets(dead).length,0);assert.equal(dead.shots,state.shots);
  assert.ok(dead.units.every(u=>u.mode==='destroyed'));
});
test('pause freezes AI, windup, bullets and AP; reset restores all state; defeat is terminal',()=>{
  let state=run(createEnemies(world),5);
  assert.deepEqual(run(state,10,{active:false}),state);
  state.playerHp=1;
  state=run(state,10);assert.equal(state.playerHp,0);
  assert.deepEqual(run(state,2),state);
  const reset=createEnemies(world);assert.equal(reset.playerHp,ENEMY.playerHp);assert.equal(reset.shots,0);assert.equal(reset.projectiles.length,0);
});
test('enemy shells hit cover before pilot, can be dodged, and expire; frame rates agree',()=>{
  const shell={id:1,owner:'a',position:[0,1.8,8],velocity:[0,0,-28],age:0};
  const initial={...createEnemies(world),projectiles:[shell]};
  const wall={id:'thin',kind:'barrier',center:[0,2,4],size:[20,4,.01],color:'#000'};
  const blocked=run(initial,1,{stage:{...world,solids:[wall]},health:{a:0},hz:30});
  assert.equal(blocked.playerHp,ENEMY.playerHp);assert.equal(blocked.projectiles.length,0);
  const dodge=run(initial,5,{player:{...pilot,position:[12,0,0]},health:{a:0}});
  assert.equal(dodge.playerHp,ENEMY.playerHp);assert.equal(dodge.projectiles.length,0);
  const a=run(createEnemies(world),10,{hz:30}),b=run(createEnemies(world),10,{hz:120});
  assert.equal(a.shots,b.shots);assert.equal(a.hits,b.hits);
  assert.ok(Math.hypot(...a.units[0].position.map((v,i)=>v-b.units[0].position[i]))<.3);
});

test('a player salvo homes into live AI positions, not their initial placement',()=>{
  let enemies=createEnemies(world),combat=createCombat(world);
  const frame={eye:[0,4,0],forward:[0,0,1],aim:[0,3.8,24],mounts:{rifle:[0,3,1],missiles:[[-1,4,0],[1,4,0]]}};
  for(let i=0;i<420;i++) {
    enemies=advanceEnemies(enemies,pilot,combat.hp,1/60,world,true);
    combat=advanceCombat(combat,{fire:false,lock:i<60},frame,1/60,{...world,targets:enemyTargets(enemies)});
  }
  assert.equal(combat.missilesFired,2);assert.ok(combat.hp.a<180);
  assert.ok(Math.abs(enemies.units[0].position[0])>1);
});

test('charged shots expose a dodge window and are cancelled immediately on death',()=>{
  const initial=createEnemies(world);initial.units[0].cooldown=0;
  let state=run(initial,.25);
  assert.ok(state.units[0].warning>0);assert.equal(state.shots,0);
  const aimed=structuredClone(state.units[0].aim);
  state=run(state,.1,{player:{...pilot,position:[1,0,0]}});
  assert.deepEqual(state.units[0].aim,aimed,'The telegraphed point is not a perfect tracking aimbot');
  state=run(state,1,{health:{a:0}});
  assert.equal(state.units[0].warning,0);assert.equal(state.shots,0);
});

test('hostile shots originate at the actual tilted BASTION rifle muzzle',()=>{
  const unit=createEnemies(world).units[0],model=createBastion();
  unit.yaw=.7;model.position.fromArray(unit.position);model.rotation.y=unit.yaw;model.updateMatrixWorld(true);
  const endpoint=model.getObjectByName('rightWeapon_rifle_gun').localToWorld(new Vector3(0,-.25,2.27));
  assert.ok(endpoint.distanceTo(new Vector3(...enemyMuzzle(unit)))<1e-6);
});
