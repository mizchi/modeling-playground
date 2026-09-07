import type { PilotState, Solid, StageDefinition, Target, Vec3 } from './types.ts';
import { boxIntersection, MOVEMENT } from './simulation.ts';

export const ENEMY=Object.freeze({radius:2.8,speed:2.4,detectRange:62,attackRange:42,near:17,far:29,
  memory:6,windup:.8,cooldown:2.4,bulletSpeed:28,damage:40,playerHp:1000});
export type EnemyMode='patrol'|'chase'|'search'|'attack'|'destroyed';
export interface EnemyUnit extends Target {
  home:Vec3;velocity:Vec3;mode:EnemyMode;lastSeen:Vec3|null;memory:number;cooldown:number;
  warning:number;aim:Vec3;path:Vec3[];repath:number;patrolSide:number;strafe:number;gait:number;
}
export interface EnemyShell {id:number;owner:string;position:Vec3;velocity:Vec3;age:number}
export interface EnemyState {units:EnemyUnit[];projectiles:EnemyShell[];playerHp:number;shots:number;hits:number;nextId:number;damageFlash:number}
const difference=(a:Vec3,b:Vec3):Vec3=>a.map((v,i)=>v-b[i]) as Vec3;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const ground=(p:Vec3):Vec3=>[p[0],0,p[2]];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const groundSolids=(stage:StageDefinition)=>stage.solids.filter(s=>s.center[1]-s.size[1]/2<6&&s.center[1]+s.size[1]/2>0);
function clearSegment(a:Vec3,b:Vec3,stage:StageDefinition,padding=ENEMY.radius):boolean {
  // Footprint navigation treats all ground-level obstacles as infinitely tall.
  return !groundSolids(stage).some(s=>boxIntersection([a[0],0,a[2]],difference(ground(b),ground(a)),
    {...s,center:[s.center[0],0,s.center[2]],size:[s.size[0],2,s.size[2]]},padding)!==null);
}
function inBounds(p:Vec3,stage:StageDefinition) {
  const b=stage.bounds,r=ENEMY.radius;
  return p[0]>=b.minX+r&&p[0]<=b.maxX-r&&p[2]>=b.minZ+r&&p[2]<=b.maxZ-r;
}

/** Small visibility graph around expanded AABB corners. Recomputed only on a planning tick. */
export function findRoute(start:Vec3,goal:Vec3,stage:StageDefinition):Vec3[] {
  const end=ground(goal),origin=ground(start);
  if(inBounds(end,stage)&&clearSegment(origin,end,stage))return [end];
  const nodes:Vec3[]=[origin];
  for(const s of groundSolids(stage))for(const x of [-1,1])for(const z of [-1,1]) {
    const p:Vec3=[s.center[0]+x*(s.size[0]/2+ENEMY.radius+.15),0,s.center[2]+z*(s.size[2]/2+ENEMY.radius+.15)];
    if(inBounds(p,stage)&&clearSegment(p,p,stage))nodes.push(p);
  }
  if(inBounds(end,stage)&&clearSegment(end,end,stage))nodes.push(end);
  const costs=nodes.map(()=>Infinity),parent=nodes.map(()=>-1),done=new Set<number>();costs[0]=0;
  while(done.size<nodes.length) {
    let current=-1;
    for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(current<0||costs[i]<costs[current]))current=i;
    if(current<0||!Number.isFinite(costs[current]))break;
    done.add(current);
    for(let i=1;i<nodes.length;i++)if(!done.has(i)&&clearSegment(nodes[current],nodes[i],stage)) {
      const cost=costs[current]+distance(nodes[current],nodes[i]);
      if(cost<costs[i]){costs[i]=cost;parent[i]=current;}
    }
  }
  let best=0;
  for(const i of done)if(distance(nodes[i],end)<distance(nodes[best],end))best=i;
  const path:Vec3[]=[];
  while(best>0){path.unshift(nodes[best]);best=parent[best];}
  return path;
}

export function createEnemies(stage:StageDefinition):EnemyState {
  return {units:stage.targets.map((t,i)=>({...t,position:[...t.position],home:[...t.position],velocity:[0,0,0],mode:'patrol',
    lastSeen:null,memory:0,cooldown:3+i*.65,warning:0,aim:[0,0,0],path:[],repath:0,patrolSide:1,strafe:i%2?1:-1,gait:0})),
    projectiles:[],playerHp:ENEMY.playerHp,shots:0,hits:0,nextId:1,damageFlash:0};
}
export const enemyTargets=(state:EnemyState):Target[]=>state.units.filter(u=>u.mode!=='destroyed').map(u=>({id:u.id,position:[...u.position],yaw:u.yaw}));

/** Same local rifle endpoint as the exported BASTION rightWeapon assembly. */
export function enemyMuzzle(unit:EnemyUnit):Vec3 {
  const x=-1.63,z=.30-.25*Math.sin(.13)+2.27*Math.cos(.13),y=2.68-.25*Math.cos(.13)-2.27*Math.sin(.13);
  return [unit.position[0]+x*Math.cos(unit.yaw)+z*Math.sin(unit.yaw),unit.position[1]+y,
    unit.position[2]-x*Math.sin(unit.yaw)+z*Math.cos(unit.yaw)];
}
function visible(from:Vec3,to:Vec3,solids:readonly Solid[]) {
  return !solids.some(s=>boxIntersection(from,difference(to,from),s)!==null);
}
function move(unit:EnemyUnit,goal:Vec3,dt:number,state:EnemyState,pilot:PilotState,stage:StageDefinition) {
  const length=distance(unit.position,goal);if(length<.05)return;
  const step=Math.min(length,ENEMY.speed*dt),p:Vec3=[unit.position[0]+(goal[0]-unit.position[0])/length*step,0,
    unit.position[2]+(goal[2]-unit.position[2])/length*step];
  if(!inBounds(p,stage)||!clearSegment(unit.position,p,stage))return;
  if(pilot.position[1]<6&&distance(p,pilot.position)<ENEMY.radius+MOVEMENT.radius)return;
  if(state.units.some(other=>other!==unit&&other.mode!=='destroyed'&&distance(p,other.position)<ENEMY.radius*2))return;
  unit.velocity=difference(p,unit.position).map(v=>v/dt) as Vec3;unit.position=p;unit.gait+=step;
}
function updateUnit(unit:EnemyUnit,dt:number,state:EnemyState,pilot:PilotState,stage:StageDefinition) {
  const playerPoint:Vec3=[pilot.position[0],pilot.position[1]+1.8,pilot.position[2]];
  const eye:Vec3=[unit.position[0],unit.position[1]+4.3,unit.position[2]];
  const range=distance(unit.position,pilot.position),seen=Math.hypot(...difference(eye,playerPoint))<ENEMY.detectRange&&visible(eye,playerPoint,stage.solids);
  if(seen){unit.lastSeen=[...pilot.position];unit.memory=ENEMY.memory;}
  else {unit.memory=Math.max(0,unit.memory-dt);if(unit.memory===0)unit.lastSeen=null;}
  unit.cooldown=Math.max(0,unit.cooldown-dt);unit.repath-=dt;unit.velocity=[0,0,0];
  const previousMode=unit.mode;
  unit.mode=seen?(range<=ENEMY.attackRange?'attack':'chase'):unit.lastSeen?'search':'patrol';
  if(previousMode!==unit.mode){unit.path=[];unit.repath=0;}
  let goal:Vec3;
  if(unit.mode==='attack') {
    const dx=(pilot.position[0]-unit.position[0])/(range||1),dz=(pilot.position[2]-unit.position[2])/(range||1);
    const toward=range>ENEMY.far?1:range<ENEMY.near?-1:0;
    goal=[unit.position[0]+dx*toward*8+dz*unit.strafe*3,0,unit.position[2]+dz*toward*8-dx*unit.strafe*3];
    if(!clearSegment(unit.position,goal,stage)||!inBounds(goal,stage)) {
      unit.strafe*=-1;
      goal=[unit.position[0]+dx*toward*8+dz*unit.strafe*3,0,unit.position[2]+dz*toward*8-dx*unit.strafe*3];
      if(!clearSegment(unit.position,goal,stage)||!inBounds(goal,stage))goal=[unit.position[0]+dx*toward*8,0,unit.position[2]+dz*toward*8];
    }
  } else if(unit.lastSeen)goal=ground(unit.lastSeen);
  else {
    goal=[unit.home[0]+unit.patrolSide*5,0,unit.home[2]];
    if(distance(unit.position,goal)<.5||!inBounds(goal,stage)||!clearSegment(goal,goal,stage)) {
      unit.patrolSide*=-1;goal=[unit.home[0]+unit.patrolSide*5,0,unit.home[2]];
    }
  }
  if(unit.repath<=0) {unit.path=findRoute(unit.position,goal,stage);unit.repath=.8;}
  if(unit.path.length&&distance(unit.position,unit.path[0])<.2)unit.path.shift();
  // A charged shot plants the chassis and gives the player a readable dodge window.
  if(unit.warning===0&&unit.path.length)move(unit,unit.path[0],dt,state,pilot,stage);
  const look=seen?playerPoint:unit.lastSeen??unit.path[0]??goal,ray=difference(look,unit.position);
  const yaw=Math.atan2(ray[0],ray[2]),turn=Math.atan2(Math.sin(yaw-unit.yaw),Math.cos(yaw-unit.yaw));
  unit.yaw+=clamp(turn,-1.8*dt,1.8*dt);
  const muzzle=enemyMuzzle(unit),canShoot=unit.mode==='attack'&&Math.abs(turn)<.2&&visible(muzzle,playerPoint,stage.solids);
  if(!canShoot){unit.warning=0;return;}
  if(unit.warning>0) {
    unit.warning=Math.max(0,unit.warning-dt);
    if(unit.warning===0) {
      const direction=difference(unit.aim,muzzle),length=Math.hypot(...direction)||1;
      state.projectiles.push({id:state.nextId++,owner:unit.id,position:muzzle,velocity:direction.map(v=>v/length*ENEMY.bulletSpeed) as Vec3,age:0});
      state.shots++;unit.cooldown=ENEMY.cooldown;
    }
  } else if(unit.cooldown===0) {unit.warning=ENEMY.windup;unit.aim=playerPoint;}
}
function updateShells(state:EnemyState,pilot:PilotState,dt:number,stage:StageDefinition) {
  const player:Solid={id:'player',kind:'barrier',center:[pilot.position[0],pilot.position[1]+1.8,pilot.position[2]],size:[4.8,3.6,4.8],color:'#000'};
  const surviving:EnemyShell[]=[];
  for(const p of state.projectiles) {
    p.age+=dt;if(p.age>4)continue;
    const delta=p.velocity.map(v=>v*dt) as Vec3;let nearest=Infinity;
    const obstacles=[...stage.solids,...state.units.filter(u=>u.id!==p.owner&&u.mode!=='destroyed').map(u=>({
      id:u.id,kind:'barrier' as const,center:[u.position[0],3,u.position[2]] as Vec3,size:[5.4,6,5.4] as Vec3,color:'#000'}))];
    for(const box of obstacles){const t=boxIntersection(p.position,delta,box);if(t!==null)nearest=Math.min(nearest,t);}
    const hit=boxIntersection(p.position,delta,player);
    if(hit!==null&&hit<nearest) {
      state.playerHp=Math.max(0,state.playerHp-ENEMY.damage);state.hits++;state.damageFlash=.25;continue;
    }
    if(nearest<=1||p.position[1]+delta[1]<=0)continue;
    p.position=p.position.map((v,i)=>v+delta[i]) as Vec3;surviving.push(p);
  }
  state.projectiles=surviving;
}

/** Enemy decisions and hostile projectiles share the game's bounded 120 Hz simulation clock. */
export function advanceEnemies(previous:EnemyState,pilot:PilotState,hp:Record<string,number>,delta:number,stage:StageDefinition,active:boolean):EnemyState {
  const dt=clamp(Number.isFinite(delta)?delta:0,0,.1);
  if(!active||previous.playerHp<=0||dt===0)return previous;
  const state:EnemyState=structuredClone(previous),steps=Math.ceil(dt*120),h=dt/steps;
  for(const unit of state.units)if(!(hp[unit.id]>0)){unit.mode='destroyed';unit.warning=0;unit.velocity=[0,0,0];unit.path=[];}
  for(let i=0;i<steps&&state.playerHp>0;i++) {
    state.damageFlash=Math.max(0,state.damageFlash-h);
    for(const unit of state.units)if(unit.mode!=='destroyed')updateUnit(unit,h,state,pilot,stage);
    updateShells(state,pilot,h,stage);
  }
  return state;
}
