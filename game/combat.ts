import type { Solid, Target, Vec3 } from './types.ts';
import { boxIntersection } from './simulation.ts';

export const WEAPONS=Object.freeze({targetHp:180,rifleDamage:12,rifleInterval:.12,missileDamage:55,
  lockTime:.65,lockRange:95,lockCos:.90,maxLocks:3,missileCooldown:3,loftTime:.65});
export interface WeaponMounts {rifle:Vec3;missiles:[Vec3,Vec3]}
export interface CombatInput {fire:boolean;lock:boolean;cancel?:boolean}
export interface CombatFrame {eye:Vec3;forward:Vec3;aim:Vec3;mounts:WeaponMounts}
export interface Projectile {
  id:number;kind:'bullet'|'missile';position:Vec3;velocity:Vec3;age:number;targetId:string|null;trail:Vec3[];
}
export interface Impact {id:number;position:Vec3;age:number;kind:'spark'|'blast'|'kill'}
export interface CombatState {
  hp:Record<string,number>;locks:Record<string,number>;projectiles:Projectile[];effects:Impact[];
  queue:{targetId:string;delay:number;side:0|1}[];wasLocking:boolean;rifleCooldown:number;missileCooldown:number;
  nextId:number;shots:number;missilesFired:number;hits:number;kills:number;
}
export interface CombatWorld {solids:readonly Solid[];targets:readonly Target[]}
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(v:Vec3,s:number):Vec3=>[v[0]*s,v[1]*s,v[2]*s];
const unit=(v:Vec3):Vec3=>scale(v,1/(Math.hypot(...v)||1));
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const targetPoint=(target:Target):Vec3=>add(target.position,[0,3.8,0]);
const targetBox=(t:Target):Solid=>({id:t.id,kind:'barrier',center:add(t.position,[0,3,0]),size:[5.4,6,5.4],color:'#000'});

export function createCombat(world:CombatWorld):CombatState {
  return {hp:Object.fromEntries(world.targets.map(t=>[t.id,WEAPONS.targetHp])),locks:{},projectiles:[],effects:[],queue:[],
    wasLocking:false,rifleCooldown:0,missileCooldown:0,nextId:1,shots:0,missilesFired:0,hits:0,kills:0};
}

/** Visible cone candidates, ordered by distance from the reticle; no targeting through cover. */
export function lockCandidates(state:CombatState,frame:CombatFrame,world:CombatWorld):Target[] {
  return world.targets.filter(t=>{
    const ray=sub(targetPoint(t),frame.eye);
    return state.hp[t.id]>0&&Math.hypot(...ray)<=WEAPONS.lockRange&&dot(unit(ray),unit(frame.forward))>=WEAPONS.lockCos
      &&!world.solids.some(s=>boxIntersection(frame.eye,ray,s)!==null);
  }).sort((a,b)=>dot(unit(sub(targetPoint(b),frame.eye)),unit(frame.forward))-dot(unit(sub(targetPoint(a),frame.eye)),unit(frame.forward)))
    .slice(0,WEAPONS.maxLocks);
}

function impact(state:CombatState,position:Vec3,kind:Impact['kind']) {
  state.effects.push({id:state.nextId++,position:[...position],age:0,kind});
}

function stepProjectiles(state:CombatState,dt:number,world:CombatWorld) {
  const survivors:Projectile[]=[];
  for(const p of state.projectiles) {
    p.age+=dt;
    if(p.age>(p.kind==='bullet'?1.6:8))continue;
    if(p.kind==='missile') {
      const target=world.targets.find(t=>t.id===p.targetId&&state.hp[t.id]>0);
      if(p.age<WEAPONS.loftTime)p.velocity[1]-=18*dt;
      else if(target) {
        const desired=scale(unit(sub(targetPoint(target),p.position)),27),blend=1-Math.exp(-5*dt);
        p.velocity=add(p.velocity,scale(sub(desired,p.velocity),blend));
      }
    }
    const delta=scale(p.velocity,dt);let fraction=1,hitId:string|null=null,collided=false;
    for(const box of [...world.solids,...world.targets.filter(t=>state.hp[t.id]>0).map(targetBox)]) {
      const t=boxIntersection(p.position,delta,box,p.kind==='missile'?.12:0);
      if(t!==null&&t<=fraction){fraction=t;collided=true;hitId=state.hp[box.id]>0?box.id:null;}
    }
    if(delta[1]<0&&p.position[1]+delta[1]<=0) {
      const t=-p.position[1]/delta[1];
      if(t<=fraction){fraction=t;collided=true;hitId=null;}
    }
    p.position=add(p.position,scale(delta,fraction));
    if(collided) {
      if(hitId) {
        state.hp[hitId]=Math.max(0,state.hp[hitId]-(p.kind==='bullet'?WEAPONS.rifleDamage:WEAPONS.missileDamage));state.hits++;
        if(state.hp[hitId]===0){state.kills++;delete state.locks[hitId];impact(state,p.position,'kill');}
      }
      impact(state,p.position,p.kind==='bullet'?'spark':'blast');
    } else survivors.push(p);
  }
  state.projectiles=survivors;
}

/** Pure bounded-substep combat. Renderer supplies current world-space muzzle and camera transforms. */
export function advanceCombat(previous:CombatState,input:CombatInput,frame:CombatFrame,delta:number,world:CombatWorld):CombatState {
  const state:CombatState=structuredClone(previous);
  if(input.cancel){state.locks={};state.queue=[];state.wasLocking=false;return state;}
  const dt=Math.max(0,Math.min(.1,Number.isFinite(delta)?delta:0));
  if(dt===0)return state;
  const candidates=lockCandidates(state,frame,world),visible=new Set(candidates.map(t=>t.id));
  for(const id of Object.keys(state.locks))if(!visible.has(id))delete state.locks[id];
  if(!input.lock&&state.wasLocking&&state.missileCooldown<=0) {
    const locked=Object.keys(state.locks).filter(id=>state.locks[id]>=1);
    state.queue=locked.flatMap((targetId,i)=>[0,1].map(side=>({targetId,side:side as 0|1,delay:(i*2+side)*.12})));
    if(locked.length)state.missileCooldown=WEAPONS.missileCooldown;
    state.locks={};
  }
  if(!input.lock)state.locks={};
  state.wasLocking=input.lock;
  const steps=Math.ceil(dt*120),h=dt/steps;
  for(let i=0;i<steps;i++) {
    state.effects=state.effects.filter(e=>(e.age+=h)<(e.kind==='kill'?1.2:.45));
    state.rifleCooldown=Math.max(0,state.rifleCooldown-h);state.missileCooldown=Math.max(0,state.missileCooldown-h);
    if(input.lock&&state.missileCooldown<=0)for(const target of candidates)
      if(state.hp[target.id]>0)state.locks[target.id]=Math.min(1,(state.locks[target.id]??0)+h/WEAPONS.lockTime);
    if(input.fire&&state.rifleCooldown<=1e-9) {
      state.projectiles.push({id:state.nextId++,kind:'bullet',position:[...frame.mounts.rifle],
        velocity:scale(unit(sub(frame.aim,frame.mounts.rifle)),130),age:0,targetId:null,trail:[]});
      state.shots++;state.rifleCooldown=WEAPONS.rifleInterval;
    }
    for(const shot of state.queue) {
      shot.delay-=h;
      if(shot.delay>0)continue;
      const target=world.targets.find(t=>t.id===shot.targetId&&state.hp[t.id]>0);
      if(!target)continue;
      const position=frame.mounts.missiles[shot.side],toward=unit(sub(targetPoint(target),position));
      state.projectiles.push({id:state.nextId++,kind:'missile',position:[...position],
        velocity:[toward[0]*7+(shot.side===0?-2:2),17,toward[2]*7],age:0,targetId:target.id,trail:[]});
      state.missilesFired++;
    }
    state.queue=state.queue.filter(s=>s.delay>0);
    stepProjectiles(state,h,world);
  }
  for(const p of state.projectiles)if(p.kind==='missile'){p.trail.push([...p.position]);if(p.trail.length>22)p.trail.shift();}
  return state;
}
