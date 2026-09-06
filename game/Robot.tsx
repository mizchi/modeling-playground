import { useEffect, useMemo, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { SkinnedMesh, Vector3 } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { PilotAnimator } from './animation.ts';
import type { PilotState, Vec3 } from './types.ts';
import type { WeaponMounts } from './combat.ts';

type RobotProps={asset:GLTF}&(
  {pilot:RefObject<PilotState>;focus:RefObject<Vec3>;mounts:RefObject<WeaponMounts>;position?:never;yaw?:never}|
  {pilot?:never;focus?:never;mounts?:never;position?:Vec3;yaw?:number}
);
export function Robot({asset,pilot,focus,mounts,position=[0,0,0],yaw=0}:RobotProps) {
  const rig=useMemo(()=>{
    const object=clone(asset.scene);
    object.traverse(node=>{
      if((node as SkinnedMesh).isMesh){node.castShadow=!node.userData.effect;node.receiveShadow=!node.userData.effect;}
      if((node as SkinnedMesh).isSkinnedMesh)node.frustumCulled=false;
    });
    return {object};
  },[asset]);
  const animator=useMemo(()=>pilot?new PilotAnimator(rig.object):null,[rig,pilot]);
  const weaponBones=useMemo(()=>({rifle:rig.object.getObjectByName('RightHand'),left:rig.object.getObjectByName('LeftCannon'),right:rig.object.getObjectByName('RightCannon'),point:new Vector3()}),[rig]);
  useEffect(()=>()=>{
    const skeletons=new Set<SkinnedMesh['skeleton']>();
    rig.object.traverse(n=>{if((n as SkinnedMesh).isSkinnedMesh)skeletons.add((n as SkinnedMesh).skeleton);});
    skeletons.forEach(s=>s.dispose());
  },[rig]);
  useFrame((_,delta)=>{
    if(pilot&&focus)animator?.update(pilot.current,focus.current,delta);
    if(mounts&&weaponBones.rifle&&weaponBones.left&&weaponBones.right) {
      mounts.current={rifle:weaponBones.rifle.localToWorld(weaponBones.point.set(0,-.08,2.18)).toArray(),missiles:[
        weaponBones.left.localToWorld(weaponBones.point.set(0,.2,1.94)).toArray(),
        weaponBones.right.localToWorld(weaponBones.point.set(0,.2,1.94)).toArray()]};
    }
  },-1);
  return <group position={position} rotation={[0,yaw,0]} dispose={null}><primitive object={rig.object}/></group>;
}
