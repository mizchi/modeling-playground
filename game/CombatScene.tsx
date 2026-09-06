import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedMesh, Mesh, Object3D, Vector3 } from 'three';
import { advanceCombat, targetPoint, WEAPONS, type CombatState, type WeaponMounts } from './combat.ts';
import { boxIntersection } from './simulation.ts';
import { STAGE } from './stage.ts';
import type { Vec3 } from './types.ts';
import type { PilotControls } from './controls.ts';

export interface CombatHud {
  targets:{id:string;x:number;y:number;hp:number;lock:number;distance:number}[];
  hp:Record<string,number>;locked:number;cooldown:number;charging:boolean;shots:number;missiles:number;hits:number;kills:number;flying:number;
}
export const emptyCombatHud=():CombatHud=>({targets:[],hp:Object.fromEntries(STAGE.targets.map(t=>[t.id,WEAPONS.targetHp])),
  locked:0,cooldown:0,charging:false,shots:0,missiles:0,hits:0,kills:0,flying:0});

export function CombatScene({combat,controls,focus,mounts,onHud}:{combat:RefObject<CombatState>;controls:PilotControls;
  focus:RefObject<Vec3>;mounts:RefObject<WeaponMounts>;onHud:(hud:CombatHud)=>void}) {
  const bullets=useRef<InstancedMesh>(null),missiles=useRef<InstancedMesh>(null),trails=useRef<InstancedMesh>(null),impacts=useRef<InstancedMesh>(null),flash=useRef<Mesh>(null);
  const timer=useRef(0),scratch=useMemo(()=>({object:new Object3D(),direction:new Vector3(),up:new Vector3(0,1,0),point:new Vector3(),color:new Color()}),[]);
  useFrame(({camera},delta)=>{
    const frame={eye:camera.position.toArray(),forward:camera.getWorldDirection(scratch.direction).toArray(),aim:focus.current,mounts:mounts.current};
    if(controls.active)combat.current=advanceCombat(combat.current,controls.weapons(),frame,delta,STAGE);
    else if(combat.current.wasLocking||combat.current.queue.length)combat.current=advanceCombat(combat.current,{fire:false,lock:false,cancel:true},frame,0,STAGE);
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
    for(const [mesh,count] of [[bullets.current,b],[missiles.current,m],[trails.current,t],[impacts.current,e]] as const)if(mesh) {
      mesh.count=Math.min(count,mesh===trails.current?512:64);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    if(flash.current){flash.current.position.fromArray(mounts.current.rifle);flash.current.visible=state.rifleCooldown>WEAPONS.rifleInterval-.035;}
    timer.current+=delta;
    if(timer.current<.08)return;timer.current=0;
    camera.updateMatrixWorld();
    const targets=STAGE.targets.flatMap(target=>{
      if(state.hp[target.id]<=0)return [];
      const point=targetPoint(target),ray=point.map((v,i)=>v-frame.eye[i]) as Vec3;
      if(STAGE.solids.some(s=>boxIntersection(frame.eye,ray,s)!==null))return [];
      const projected=scratch.point.fromArray(point).project(camera);
      if(projected.z<0||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return [];
      return [{id:target.id,x:(projected.x+1)*50,y:(1-projected.y)*50,hp:state.hp[target.id],lock:state.locks[target.id]??0,distance:Math.hypot(...ray)}];
    });
    onHud({targets,hp:{...state.hp},locked:Object.values(state.locks).filter(p=>p>=1).length,cooldown:state.missileCooldown,
      charging:controls.weapons().lock,shots:state.shots,missiles:state.missilesFired,hits:state.hits,kills:state.kills,flying:state.projectiles.length});
  },-.5);
  return <>
    <instancedMesh ref={bullets} args={[undefined,undefined,64]} frustumCulled={false}><boxGeometry args={[.09,1.6,.09]}/><meshBasicMaterial color="#ffecad" toneMapped={false}/></instancedMesh>
    <instancedMesh ref={missiles} args={[undefined,undefined,64]} frustumCulled={false}><coneGeometry args={[.16,.8,6]}/><meshBasicMaterial color="#ffcc75" toneMapped={false}/></instancedMesh>
    <instancedMesh ref={trails} args={[undefined,undefined,512]} frustumCulled={false}><cylinderGeometry args={[.09,.06,1,5]}/><meshBasicMaterial color="#e0cfb4" transparent opacity={.65} depthWrite={false}/></instancedMesh>
    <instancedMesh ref={impacts} args={[undefined,undefined,64]} frustumCulled={false}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial transparent opacity={.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></instancedMesh>
    <mesh ref={flash}><icosahedronGeometry args={[.3,0]}/><meshBasicMaterial color="#fff2bf" toneMapped={false}/></mesh>
  </>;
}

export function CombatOverlay({hud}:{hud:CombatHud}) {
  return <>
    <div className="target-overlay" aria-hidden="true">{hud.targets.map(t=><div key={t.id} data-target={t.id} className={`target-marker ${t.lock>=1?'locked':''}`} style={{left:`${t.x}%`,top:`${t.y}%`}}>
      <span>{t.id} · {Math.round(t.distance)}m</span><div className="target-brackets"/>
      <div className="target-health"><i style={{width:`${t.hp/WEAPONS.targetHp*100}%`}}/></div>
      <small>{t.lock>=1?'LOCKED':t.lock>0?`ACQUIRING ${Math.floor(t.lock*100)}%`:`AP ${t.hp}`}</small>
    </div>)}</div>
    <div className="weapon-readout" aria-live="off"><span>RIFLE / AUTO　∞</span><strong>{hud.cooldown>.01?`MISSILE RELOAD ${hud.cooldown.toFixed(1)}s`:`MULTI LOCK ${hud.locked} / 3`}</strong>
      <small>{hud.charging?'Eを離して斉射':'左クリック：射撃　E長押し→離す：ミサイル'}</small><span>HIT {hud.hits}　DESTROYED {hud.kills} / 3</span></div>
    <output id="combat-telemetry" className="sr-only" data-shots={hud.shots} data-missiles={hud.missiles} data-hits={hud.hits} data-kills={hud.kills} data-locked={hud.locked} data-flying={hud.flying} data-hp={JSON.stringify(hud.hp)}>
      撃破 {hud.kills} / 3
    </output>
  </>;
}
