import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D, Vector3, Mesh } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { enemyMuzzle, type EnemyState } from './enemies.ts';
import type { CombatState } from './combat.ts';

/** BASTION has rigid exchangeable modules, not STRIX's four-leg rig. It boost-glides on approach. */
function EnemyRobot({asset,id,enemies,combat}:{asset:GLTF;id:string;enemies:RefObject<EnemyState>;combat:RefObject<CombatState>}) {
  const root=useRef<Group>(null),jet=useRef<Group>(null),warning=useRef<Mesh>(null);
  const object=useMemo(()=>{
    const result=clone(asset.scene);
    result.traverse(n=>{if((n as Mesh).isMesh){n.castShadow=true;n.receiveShadow=true;}});
    return result;
  },[asset]);
  const scratch=useMemo(()=>({a:new Vector3(),b:new Vector3(),up:new Vector3(0,1,0)}),[]);
  useFrame(()=>{
    const unit=enemies.current.units.find(u=>u.id===id);if(!unit||!root.current)return;
    const alive=combat.current.hp[id]>0;root.current.visible=alive;
    root.current.position.fromArray(unit.position);root.current.rotation.y=unit.yaw;
    const speed=Math.hypot(...unit.velocity),hover=Math.min(1,speed/2.4);
    object.position.y=hover*.18;
    if(jet.current){jet.current.visible=alive&&hover>.1;jet.current.scale.setScalar(.7+hover*.5);}
    if(warning.current) {
      warning.current.visible=alive&&unit.warning>0;
      const muzzle=enemyMuzzle(unit),direction=scratch.b.fromArray(unit.aim).sub(scratch.a.fromArray(muzzle));
      warning.current.position.copy(scratch.a).addScaledVector(direction,.5);
      warning.current.scale.set(1,direction.length(),1);
      warning.current.quaternion.setFromUnitVectors(scratch.up,direction.normalize());
    }
  },-1);
  return <>
    <group ref={root} dispose={null}>
      <primitive object={object}/>
      <group ref={jet} position={[0,.55,-.7]} rotation={[Math.PI/2,0,0]}>
        {[-.7,.7].map(x=><mesh key={x} position={[x,0,0]}><coneGeometry args={[.18,1.3,5]}/><meshBasicMaterial color="#8ae8ff" transparent opacity={.8} toneMapped={false}/></mesh>)}
      </group>
    </group>
    <mesh ref={warning} frustumCulled={false}><cylinderGeometry args={[.025,.025,1,4]}/><meshBasicMaterial color="#ff7259" transparent opacity={.65} depthWrite={false} toneMapped={false}/></mesh>
  </>;
}

export function EnemyScene({asset,enemies,combat}:{asset:GLTF;enemies:RefObject<EnemyState>;combat:RefObject<CombatState>}) {
  const bullets=useRef<InstancedMesh>(null),scratch=useMemo(()=>({object:new Object3D(),up:new Vector3(0,1,0),direction:new Vector3()}),[]);
  useFrame(()=>{
    if(!bullets.current)return;let count=0;
    for(const p of enemies.current.projectiles.slice(-64)) {
      scratch.object.position.fromArray(p.position);
      scratch.object.quaternion.setFromUnitVectors(scratch.up,scratch.direction.fromArray(p.velocity).normalize());
      scratch.object.updateMatrix();bullets.current.setMatrixAt(count++,scratch.object.matrix);
    }
    bullets.current.count=count;bullets.current.instanceMatrix.needsUpdate=true;
  },-.4);
  return <>
    {enemies.current.units.map(u=><EnemyRobot key={u.id} id={u.id} asset={asset} enemies={enemies} combat={combat}/>)}
    <instancedMesh ref={bullets} args={[undefined,undefined,64]} frustumCulled={false}>
      <boxGeometry args={[.2,1.4,.2]}/><meshBasicMaterial color="#ff664b" toneMapped={false}/>
    </instancedMesh>
  </>;
}
