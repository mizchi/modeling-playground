import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Bone, AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Euler, Quaternion } from 'three';
import { HUNYUAN_MAP, retargetHunyuan } from '../motion/import/hunyuan.ts';
import { createProject } from '../motion/contract.ts';
import { createHuman, disposeHuman } from '../human/model.ts';
import { createMotionRig, applyPose } from '../motion/rig.ts';
import { BASE45_BONES } from '../human/models/base45/src/definition.ts';

function source(){
  const root=new Scene(),bones={};
  for(const item of BASE45_BONES){
    if(item.name==='Root')continue;const name=HUNYUAN_MAP[item.name],bone=new Bone();bone.name=name;
    const parent=bones[HUNYUAN_MAP[item.parent]],origin=BASE45_BONES.find(b=>b.name===item.parent)?.position??[0,0,0];
    bone.position.fromArray(item.position.map((v,i)=>(v-origin[i])*100));(parent??root).add(bone);bones[name]=bone;
  }
  const middle=new Bone();middle.name='Spine2';bones.Spine1.add(middle);middle.add(bones.Spine3);bones.Spine2=middle;
  const tracks=Object.keys(bones).map(name=>new QuaternionKeyframeTrack(`${name}.quaternion`,[0,1],[0,0,0,1,0,0,0,1]));
  tracks.push(new VectorKeyframeTrack('Pelvis.position',[0,1],[0,102,0,0,102,100]));
  return {root,bones,clip:new AnimationClip('synthetic',1,tracks)};
}
test('Hunyuan spine collapse, unit conversion and root rebasing produce editable BASE-45 keys',()=>{
  const s=source(),p=createProject(),target=createHuman(p.recipe);
  const twist=new Quaternion().setFromEuler(new Euler(0,.2,0)).toArray();
  s.clip.tracks.find(t=>t.name==='Spine2.quaternion').values.set([...twist,...twist]);
  try{
    const rig=createMotionRig(target),result=retargetHunyuan(s.root,s.clip,p,rig);
    assert.equal(result.project.frames,30);assert.equal(result.project.keys.length,31);
    assert.ok(Math.abs(result.project.keys.at(-1).pose.root[2]-1)<1e-6);
    assert.ok(result.project.keys.at(-1).pose.rotations.Chest[1]>.09);
    assert.equal(result.project.loop,false);
    for(const key of result.project.keys)applyPose(rig,key.pose);
    assert.ok(Math.abs(rig.bones.Root.position.z-1)<1e-6);
  }finally{disposeHuman(target);}
});
test('unknown tracks, missing joints and non-finite inputs fail instead of silently dropping motion',()=>{
  const p=createProject(),target=createHuman(p.recipe),rig=createMotionRig(target);
  try{
    let s=source();s.clip.tracks.push(new QuaternionKeyframeTrack('Mystery.quaternion',[0,1],[0,0,0,1,0,0,0,1]));
    assert.throws(()=>retargetHunyuan(s.root,s.clip,p,rig),/Mystery/);
    s=source();s.bones.L_Knee.removeFromParent();assert.throws(()=>retargetHunyuan(s.root,s.clip,p,rig));
    s=source();s.clip.tracks[0].values[0]=NaN;assert.throws(()=>retargetHunyuan(s.root,s.clip,p,rig));
    s=source();s.root.scale.setScalar(.01);assert.throws(()=>retargetHunyuan(s.root,s.clip,p,rig),/親変換/);
  }finally{disposeHuman(target);}
});

test('FBX duplicate times collapse only if they encode the same rotation',()=>{
  const p=createProject(),target=createHuman(p.recipe),rig=createMotionRig(target),s=source();
  try{
    s.clip.tracks[0]=new QuaternionKeyframeTrack('Pelvis.quaternion',[0,0,1],[0,0,0,1,0,0,0,-1,0,0,0,1]);
    assert.equal(retargetHunyuan(s.root,s.clip,p,rig).project.keys.length,31);
    s.clip.tracks[0].values.set([0,1,0,0],4);
    assert.throws(()=>retargetHunyuan(s.root,s.clip,p,rig),/重複/);
  }finally{disposeHuman(target);}
});
