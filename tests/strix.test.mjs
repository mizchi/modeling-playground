import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer, Euler, Quaternion, Vector3 } from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateBytes } from 'gltf-validator';
import { STRIX_LEGS, STRIX_GAIT, STRIX_SPEC } from '../models/strix-definition.mjs';
import { strixPose } from '../models/strix-motion.mjs';
import { createStrix } from '../models/strix.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';
import { bindAsset } from '../runtime/asset.mjs';
import { IKPose } from '../runtime/ik.mjs';

test('diagonal pairs swing together with overlap, fixed lengths and planted world-space feet',()=>{
  const liftedPairs=new Set();let overlap=0;
  for(let i=0;i<640;i++) {
    const time=i*STRIX_GAIT.duration/640,pose=strixPose('Walk',time);
    const {FrontLeft:fl,RearRight:rr,FrontRight:fr,RearLeft:rl}=pose.feet;
    for(const [a,b] of [[fl,rr],[fr,rl]]) {
      assert.equal(a.contact,b.contact,'Diagonal partners must share contact state');
      assert.ok(Math.abs(a.ankle.y-b.ankle.y)<1e-8,'Diagonal partners must lift together');
      assert.ok(Math.abs(a.phase-b.phase)<1e-8);
    }
    const airborne=Object.entries(pose.feet).filter(([,f])=>!f.contact).map(([id])=>id).sort();
    assert.ok(airborne.length===0 || airborne.length===2,'Two or four supports, no flight phase');
    if(airborne.length)liftedPairs.add(airborne.join(','));else overlap++;
    for(const leg of STRIX_LEGS) {
      const foot=pose.feet[leg.id];
      assert.ok(!foot.clamped);
      assert.ok(Math.abs(foot.hip.distanceTo(foot.knee)-STRIX_GAIT.upper)<1e-6);
      assert.ok(Math.abs(foot.knee.distanceTo(foot.ankle)-STRIX_GAIT.lower)<1e-6);
      assert.ok(foot.ankle.y>=STRIX_GAIT.footHeight-1e-8);
      const next=strixPose('Walk',time+.00001).feet[leg.id];
      if(foot.contact && next.contact) {
        const a=foot.ankle.clone(),b=next.ankle.clone();
        a.z+=time*STRIX_GAIT.speed;b.z+=(time+.00001)*STRIX_GAIT.speed;
        assert.ok(a.distanceTo(b)<1e-7,'No stance sliding after adding travel speed');
      }
    }
  }
  assert.deepEqual([...liftedPairs].sort(),['FrontLeft,RearRight','FrontRight,RearLeft']);
  assert.ok(overlap>0 && overlap<320,'A brief four-foot overlap, not a four-foot shuffle');
});

test('default hull is lower with acute knees and unchanged rigid segment lengths',()=>{
  const hull=STRIX_SPEC.rig.bones.find(b=>b.name==='Hull');
  assert.ok(hull.position[1]>=1.45 && hull.position[1]<=1.65,'Lower chassis from the former 2.12 m');
  for(const leg of STRIX_LEGS) {
    const hip=new Vector3(...leg.hip),knee=new Vector3(...leg.knee),ankle=new Vector3(...leg.ankle);
    const angle=hip.clone().sub(knee).angleTo(ankle.clone().sub(knee))*180/Math.PI;
    assert.ok(angle>70 && angle<90,`${leg.id}: knee interior angle ${angle}`);
    assert.ok(Math.abs(hip.distanceTo(knee)-1.62)<1e-8);
    assert.ok(Math.abs(knee.distanceTo(ankle)-1.62)<1e-8);
    const idle=strixPose('Idle',0).feet[leg.id];
    assert.ok(idle.knee.distanceTo(knee)<1e-8,'Default and first Idle pose agree');
  }
});

test('Idle and Walk loop, while Advance covers one stride without teleporting back',()=>{
  for(const name of ['Idle','Walk']) {
    const a=strixPose(name,0),b=strixPose(name,STRIX_GAIT.duration);
    assert.ok(new Vector3(...a.position).distanceTo(new Vector3(...b.position))<1e-8);
    for(const leg of STRIX_LEGS)assert.ok(a.feet[leg.id].ankle.distanceTo(b.feet[leg.id].ankle)<1e-8);
  }
  assert.ok(strixPose('Advance',STRIX_GAIT.duration).position[2]>.8);
});

test('leg roll frames stay continuous as shins pass through a near-vertical orientation',()=>{
  let before=strixPose('Walk',0);
  for(let i=1;i<=Math.round(STRIX_GAIT.duration*120);i++) {
    const after=strixPose('Walk',i/120);
    for(const leg of STRIX_LEGS)for(const segment of ['Upper','Lower','Foot']) {
      const a=new Quaternion().setFromEuler(new Euler(...before.rotations[leg.id+segment]));
      const b=new Quaternion().setFromEuler(new Euler(...after.rotations[leg.id+segment]));
      assert.ok(a.angleTo(b)<.12,`${leg.id+segment}: avoid sudden axial flips`);
    }
    before=after;
  }
});

test('exported four-leg rig moves actual rigid armor and keeps feet level above ground',async()=>{
  const asset=createStrix();bindAsset(asset.root,asset.clips,asset.definition);
  const bytes=new Uint8Array(await exportGlb(asset.root,asset.clips));
  const delivered=await readFile(new URL('../output/strix.glb',import.meta.url));
  assert.deepEqual(new Uint8Array(delivered),bytes,'Delivered GLB must match its generator');
  const validation=await validateBytes(bytes,{maxIssues:20});
  assert.equal(validation.issues.numErrors,0,JSON.stringify(validation.issues.messages));
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer,'');
  bindAsset(loaded.scene,loaded.animations,asset.definition);
  const ik=IKPose.fromModel(loaded.scene);
  assert.ok(ik,'IK metadata survives GLB export and reimport');
  assert.equal(ik.chains.length,4);
  const mixer=new AnimationMixer(loaded.scene);
  for(const clip of loaded.animations) {
    mixer.stopAllAction();const action=mixer.clipAction(clip).play();
    // 120 Hz includes halfway interpolation between 60 Hz baked keys.
    for(let i=0;i<Math.round(clip.duration*120);i++) {
      const t=i/120;action.time=t;mixer.update(0);loaded.scene.updateMatrixWorld(true);
      const expected=strixPose(clip.name,t);
      for(const leg of STRIX_LEGS) {
        const foot=loaded.scene.getObjectByName(leg.id+'Foot');
        const error=foot.getWorldPosition(new Vector3()).distanceTo(expected.feet[leg.id].ankle);
        assert.ok(error<.002,`${clip.name}/${t}/${leg.id}: ankle error ${error}`);
        const footUp=new Vector3(0,1,0).transformDirection(foot.matrixWorld);
        // Flight feet may pitch; all grounded clips keep level soles.
        if(clip.name!=='Boost'||expected.feet[leg.id].contact)assert.ok(footUp.y>.9999);
        else assert.ok(footUp.y>Math.cos(.25));
      }
      loaded.scene.traverse(mesh=>{
        if(!mesh.isSkinnedMesh)return;
        mesh.skeleton.update();
        for(let v=0;v<mesh.geometry.attributes.position.count;v++) {
          const p=mesh.getVertexPosition(v,new Vector3()).applyMatrix4(mesh.matrixWorld);
          assert.ok(p.y>=-.003,`${clip.name}/${t}/${mesh.name}: below floor ${p.y}`);
        }
        const w=mesh.geometry.attributes.skinWeight;
        assert.equal(w.getX(0),1);assert.equal(w.getY(0)+w.getZ(0)+w.getW(0),0);
      });
    }
  }
});
