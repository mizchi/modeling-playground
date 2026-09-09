import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedMesh, Mesh, Object3D, Vector3 } from 'three';
import { advanceCombat, targetPoint, WEAPONS, type CombatState, type WeaponMounts } from './combat.ts';
import { boxIntersection } from './simulation.ts';
import { STAGE } from './stage.ts';
import type { Vec3, StageDefinition } from './types.ts';
import type { ActionDocument, GameEvent } from './studio/contracts.ts';
import { DEFAULT_ACTION, sampleAction } from './studio/action.ts';
import { impactSparks } from './studio/effects.ts';
import type { PilotControls } from './controls.ts';
import { enemyTargets, ENEMY, type EnemyState, type EnemyMode } from './enemies.ts';

export interface CombatHud {
  targets:{id:string;x:number;y:number;hp:number;lock:number;distance:number;mode:EnemyMode;warning:boolean}[];
  hp:Record<string,number>;locked:number;cooldown:number;charging:boolean;shots:number;missiles:number;hits:number;kills:number;flying:number;
  playerHp:number;enemyShots:number;enemyHits:number;damageFlash:number;enemies:{id:string;position:Vec3;mode:EnemyMode;warning:number}[];
}
export const emptyCombatHud=(stage:StageDefinition=STAGE):CombatHud=>({targets:[],hp:Object.fromEntries(stage.targets.map(t=>[t.id,WEAPONS.targetHp])),
  locked:0,cooldown:0,charging:false,shots:0,missiles:0,hits:0,kills:0,flying:0,
  playerHp:ENEMY.playerHp,enemyShots:0,enemyHits:0,damageFlash:0,enemies:[]});

export function CombatScene({combat,enemies,controls,focus,mounts,onHud,stage=STAGE,action=DEFAULT_ACTION,attackAge,onEvents,onAdvance}:{combat:RefObject<CombatState>;enemies:RefObject<EnemyState>;controls:PilotControls;
  focus:RefObject<Vec3>;mounts:RefObject<WeaponMounts>;onHud:(hud:CombatHud)=>void;stage?:StageDefinition;action?:ActionDocument;attackAge?:RefObject<number>;
  onEvents?:(events:GameEvent[])=>void;onAdvance?:(dt:number)=>void}) {
  const bullets=useRef<InstancedMesh>(null),missiles=useRef<InstancedMesh>(null),trails=useRef<InstancedMesh>(null),impacts=useRef<InstancedMesh>(null),flash=useRef<Mesh>(null);
  const sparks=useRef<InstancedMesh>(null);
  const timer=useRef(0),scratch=useMemo(()=>({object:new Object3D(),direction:new Vector3(),up:new Vector3(0,1,0),point:new Vector3(),color:new Color()}),[]);
  useFrame(({camera},delta)=>{
    const frame={eye:camera.position.toArray(),forward:camera.getWorldDirection(scratch.direction).toArray(),aim:focus.current,mounts:mounts.current};
    const world={...stage,targets:enemyTargets(enemies.current)};
    if(controls.active&&enemies.current.playerHp>0) {
      combat.current=advanceCombat(combat.current,controls.weapons(),frame,delta,world,action);
      if(attackAge&&combat.current.events.some(e=>e.kind==='shot'&&e.weapon==='rifle'))attackAge.current=0;
      onEvents?.(combat.current.events);
    }
    else if(combat.current.wasLocking||combat.current.queue.length)combat.current=advanceCombat(combat.current,{fire:false,lock:false,cancel:true},frame,0,world);
    const state=combat.current,{object,direction,up}=scratch;let b=0,m=0,t=0,e=0;
    for(const p of state.projectiles) {
      const mesh=p.kind==='bullet'?bullets.current:missiles.current,index=p.kind==='bullet'?b++:m++;
      if(!mesh||index>=64)continue;
      object.position.fromArray(p.position);object.quaternion.setFromUnitVectors(up,direction.fromArray(p.velocity).normalize());
      object.scale.setScalar(1);object.updateMatrix();mesh.setMatrixAt(index,object.matrix);
      if(p.kind==='missile'&&trails.current)for(let i=1;i<p.trail.length&&t<512;i++) {
        const a=p.trail[i-1],end=p.trail[i];direction.fromArray(end).sub(scratch.point.fromArray(a));
        const length=direction.length();object.position.fromArray(a).addScaledVector(direction,.5);
        object.quaternion.setFromUnitVectors(up,direction.normalize());object.scale.set(i/p.trail.length,length,i/p.trail.length);
        object.updateMatrix();trails.current.setMatrixAt(t++,object.matrix);
      }
    }
    if(impacts.current)for(const hit of state.effects.slice(-64)) {
      object.position.fromArray(hit.position);object.quaternion.identity();
      object.scale.setScalar(hit.kind==='spark'?.15+hit.age*1.5:hit.kind==='kill'?1+hit.age*5:.5+hit.age*4);
      object.updateMatrix();impacts.current.setMatrixAt(e,object.matrix);
      impacts.current.setColorAt(e++,scratch.color.set(hit.kind==='kill'?'#ff7840':'#ffd58a').multiplyScalar(Math.max(.05,1-hit.age/(hit.kind==='kill'?1.2:.45))));
    }
    if(sparks.current) {
      let count=0;
      for(const hit of state.effects.slice(-32))for(const spark of impactSparks(hit)) {
        object.position.fromArray(spark.position);object.quaternion.identity();object.scale.setScalar(spark.scale);object.updateMatrix();sparks.current.setMatrixAt(count++,object.matrix);
      }
      sparks.current.count=count;sparks.current.instanceMatrix.needsUpdate=true;
    }
    for(const [mesh,count] of [[bullets.current,b],[missiles.current,m],[trails.current,t],[impacts.current,e]] as const)if(mesh) {
      mesh.count=Math.min(count,mesh===trails.current?512:64);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    if(flash.current){flash.current.position.fromArray(mounts.current.rifle);flash.current.visible=sampleAction(action,attackAge?.current??(action.cooldown-state.rifleCooldown)).flash;}
    onAdvance?.(delta);
    timer.current+=delta;
    if(timer.current<.08)return;timer.current=0;
    camera.updateMatrixWorld();
    const targets=world.targets.flatMap(target=>{
      if(state.hp[target.id]<=0)return [];
      const point=targetPoint(target),ray=point.map((v,i)=>v-frame.eye[i]) as Vec3;
      if(stage.solids.some(s=>boxIntersection(frame.eye,ray,s)!==null))return [];
      const projected=scratch.point.fromArray(point).project(camera);
      if(projected.z<0||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return [];
      const enemy=enemies.current.units.find(u=>u.id===target.id)!;
      return [{id:target.id,x:(projected.x+1)*50,y:(1-projected.y)*50,hp:state.hp[target.id],lock:state.locks[target.id]??0,distance:Math.hypot(...ray),mode:enemy.mode,warning:enemy.warning>0}];
    });
    onHud({targets,hp:{...state.hp},locked:Object.values(state.locks).filter(p=>p>=1).length,cooldown:state.missileCooldown,
      charging:controls.weapons().lock,shots:state.shots,missiles:state.missilesFired,hits:state.hits,kills:state.kills,flying:state.projectiles.length,
      playerHp:enemies.current.playerHp,enemyShots:enemies.current.shots,enemyHits:enemies.current.hits,damageFlash:enemies.current.damageFlash,
      enemies:enemies.current.units.map(u=>({id:u.id,position:[...u.position],mode:state.hp[u.id]>0?u.mode:'destroyed',warning:u.warning}))});
  },-.5);
  return <>
    <instancedMesh ref={bullets} args={[undefined,undefined,64]} frustumCulled={false}><boxGeometry args={[.09,1.6,.09]}/><meshBasicMaterial color="#ffecad" toneMapped={false}/></instancedMesh>
    <instancedMesh ref={missiles} args={[undefined,undefined,64]} frustumCulled={false}><coneGeometry args={[.16,.8,6]}/><meshBasicMaterial color="#ffcc75" toneMapped={false}/></instancedMesh>
    <instancedMesh ref={trails} args={[undefined,undefined,512]} frustumCulled={false}><cylinderGeometry args={[.09,.06,1,5]}/><meshBasicMaterial color="#e0cfb4" transparent opacity={.65} depthWrite={false}/></instancedMesh>
    <instancedMesh ref={impacts} args={[undefined,undefined,64]} frustumCulled={false}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial transparent opacity={.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={sparks} args={[undefined,undefined,384]} frustumCulled={false}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color="#ffe1a0" toneMapped={false}/></instancedMesh>
    <mesh ref={flash}><icosahedronGeometry args={[.3,0]}/><meshBasicMaterial color={action.flashColor} toneMapped={false}/></mesh>
  </>;
}

export function CombatOverlay({hud}:{hud:CombatHud}) {
  const total=Object.keys(hud.hp).length;
  return <>
    <div className="target-overlay" aria-hidden="true">{hud.targets.map(t=><div key={t.id} data-target={t.id} className={`target-marker ${t.lock>=1?'locked':''}`} style={{left:`${t.x}%`,top:`${t.y}%`}}>
      <span>{t.id} · {Math.round(t.distance)}m</span><div className={`target-brackets ${t.warning?'hostile-warning':''}`}/>
      <div className="target-health"><i style={{width:`${t.hp/WEAPONS.targetHp*100}%`}}/></div>
      <small>{t.warning?'⚠ INCOMING':t.lock>=1?'LOCKED':t.lock>0?`ACQUIRING ${Math.floor(t.lock*100)}%`:`AP ${t.hp}`}</small>
    </div>)}</div>
    <div className="weapon-readout" aria-live="off"><span>RIFLE / AUTO　∞</span><strong>{hud.cooldown>.01?`MISSILE RELOAD ${hud.cooldown.toFixed(1)}s`:`MULTI LOCK ${hud.locked} / 3`}</strong>
      <small>{hud.charging?'Eを離して斉射':'左クリック：射撃　E長押し→離す：ミサイル'}</small><span>HIT {hud.hits}　DESTROYED {hud.kills} / {total}</span></div>
    <output id="combat-telemetry" className="sr-only" data-shots={hud.shots} data-missiles={hud.missiles} data-hits={hud.hits} data-kills={hud.kills} data-locked={hud.locked} data-flying={hud.flying} data-hp={JSON.stringify(hud.hp)}>
      撃破 {hud.kills} / {total}
    </output>
    <div className="armor-readout" aria-label="自機AP">AP <strong>{hud.playerHp.toString().padStart(4,'0')}</strong> / {ENEMY.playerHp}
      <div><i style={{width:`${hud.playerHp/ENEMY.playerHp*100}%`}}/></div>
    </div>
    {hud.damageFlash>0&&<div className="damage-flash" aria-hidden="true"/>}
    <output id="enemy-telemetry" className="sr-only" data-player-hp={hud.playerHp} data-shots={hud.enemyShots} data-hits={hud.enemyHits} data-units={JSON.stringify(hud.enemies)}>敵の射撃 {hud.enemyShots} / 被弾 {hud.enemyHits}</output>
  </>;
}
