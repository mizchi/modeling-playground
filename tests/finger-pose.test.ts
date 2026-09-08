import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group} from 'three';
import {fingerNames,handSides} from '../contracts/fingers.ts';
import {FingerPose} from '../runtime/finger-pose.ts';

test('finger controls independently bend either hand and restore the neutral shape',()=>{
  const root=new Group(),bones=[];
  for(const side of handSides)for(const finger of fingerNames)for(let joint=0;joint<3;joint++){
    const bone=new Bone();bone.userData.fingerRig={version:1,side,finger,joint,restRotation:[0,0,0,1]};root.add(bone);bones.push(bone);
  }
  const pose=FingerPose.fromModel(root);assert.ok(pose);
  pose.set('Left','Index',1);pose.apply();
  for(const bone of bones){
    const m=bone.userData.fingerRig;
    assert.equal(bone.quaternion.z!==0,m.side==='Left'&&m.finger==='Index');
  }
  assert.throws(()=>pose.set('Left','Index',NaN));assert.throws(()=>pose.set('Left','Index',2));
  pose.reset();pose.apply();assert.ok(bones.every(b=>b.quaternion.z===0));
  assert.equal(FingerPose.fromModel(new Group()),null);
});
