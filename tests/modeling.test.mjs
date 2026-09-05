import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { skinRigidParts } from '../modeling/rig.mjs';
import { bakePoseClips } from '../modeling/bake-motion.mjs';
import { solveHorizontalSweep, solveTwoBone } from '../runtime/solvers.mjs';

test('shared rigid skinning supports transformed roots without moving or stretching the part',()=>{
  const root=new Group();root.position.set(2,3,4);root.rotation.y=.4;root.scale.setScalar(2);
  const bone=new Bone();bone.name='Joint';bone.position.set(0,1,0);root.add(bone);
  const part=new Mesh(new BoxGeometry(.4,.5,.6),new MeshBasicMaterial());part.name='Plate';part.position.set(.3,-.4,0);bone.add(part);
  root.updateMatrixWorld(true);
  const before=new Vector3().fromBufferAttribute(part.geometry.attributes.position,0).applyMatrix4(part.matrixWorld);
  skinRigidParts(root,{Joint:bone});root.updateMatrixWorld(true);
  const skin=root.getObjectByName('Plate');skin.skeleton.update();
  const point=()=>skin.getVertexPosition(0,new Vector3()).applyMatrix4(skin.matrixWorld);
  assert.ok(point().distanceTo(before)<1e-6);
  bone.position.x+=.5;root.updateMatrixWorld(true);skin.skeleton.update();
  assert.ok(Math.abs(point().distanceTo(before)-1)<1e-6);
});

test('motion baking accepts different joint names and includes authored keys and exact end time',()=>{
  const clips=bakePoseClips({clips:[{name:'Test',duration:.93,fps:30}],rootBone:'Origin',joints:['Joint'],scaleJoints:[],
    extraTimes:()=>[.123],sample:(_,t)=>({position:[t,0,0],rotations:{Joint:[t,0,0]},scales:{}})});
  assert.equal(clips[0].duration,.93);
  assert.deepEqual(clips[0].tracks.map(t=>t.name),['Origin.position','Joint.quaternion']);
  const times=Array.from(clips[0].tracks[0].times);
  assert.ok(times.some(t=>Math.abs(t-.123)<1e-6));
  assert.ok(Math.abs(times.at(-1)-.93)<1e-6);
});

test('solvers operate without model names, DOM or mutating their input orientations',()=>{
  const chest=new Quaternion().setFromEuler(new Euler(.3,-.5,.2)),saved=chest.clone();
  const shoulder=new Quaternion().setFromEuler(new Euler(0,0,.7));
  const result=solveHorizontalSweep({chest,shoulder,sweep:.8,weight:1,elbowDrop:.5,
    restUpper:new Quaternion(),restForearm:new Quaternion()});
  const world=chest.clone().multiply(shoulder).multiply(result.upper).multiply(result.forearm);
  assert.ok(Math.abs(new Vector3(0,-1,0).applyQuaternion(world).y)<1e-6);
  assert.ok(Math.abs(new Vector3(0,0,1).applyQuaternion(world).y)>.999);
  assert.ok(chest.equals(saved));
  const ik=solveTwoBone(new Vector3(),new Vector3(1,0,0),new Vector3(0,1,0),1,1);
  assert.ok(ik.end.distanceTo(new Vector3(1,0,0))<1e-6);
});
