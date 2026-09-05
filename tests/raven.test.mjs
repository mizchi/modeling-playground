import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';
import { createRaven } from '../models/raven.mjs';
import { ravenPose, RAVEN_MOTION } from '../models/raven-motion.mjs';
import { inspectModel } from '../viewer/model.mjs';

function assertHorizontalSlash(root,clips) {
  root.updateMatrixWorld(true);
  const parts=[];
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh || mesh.userData.effect)return;
    mesh.geometry.computeBoundingBox();
    const index=mesh.skeleton.bones.findIndex(b=>b.name===mesh.userData.joint);
    parts.push({mesh,index,rest:new OBB().fromBox3(mesh.geometry.boundingBox)});
  });
  const weapon=parts.filter(p=>p.mesh.userData.joint==='RightForearm');
  const body=parts.filter(p=>!['RightForearm','RightHand','RightUpperArm'].includes(p.mesh.userData.joint));
  assert.ok(weapon.length>5 && body.length>50,'Check the rendered rigid armor, not only joint origins');
  const mixer=new AnimationMixer(root),clip=clips.find(c=>c.name==='BladeSlash');
  const action=mixer.clipAction(clip).play(),directions=[];
  // 120 Hz also checks interpolation halfway between the baked 60 Hz keys.
  for(let frame=0;frame<=Math.ceil(clip.duration*120);frame++) {
    const t=Math.min(frame/120,clip.duration-1e-5);
    action.time=t;mixer.update(0);root.updateMatrixWorld(true);
    const boxes=new Map(parts.map(part=>{
      const {mesh,index,rest}=part;
      const skin=new Matrix4().multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse)
        .multiply(mesh.skeleton.bones[index].matrixWorld).multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix);
      const obb=rest.clone().applyMatrix4(skin);
      // OBB.applyMatrix4 rotates its axes but only translates its center.
      obb.center.copy(rest.center).applyMatrix4(skin);
      return [part,obb];
    }));
    for(const arm of weapon)for(const other of body) {
      assert.ok(!boxes.get(arm).intersectsOBB(boxes.get(other)),
        `${t.toFixed(3)}s: ${arm.mesh.name} intersects ${other.mesh.name}`);
    }
    if(t>=.48 && t<=1.18) {
      const forearm=root.getObjectByName('RightForearm');
      const direction=new Vector3(0,-1,0).transformDirection(forearm.matrixWorld);
      assert.ok(Math.abs(direction.y)<.025,`${t.toFixed(3)}s: blade must sweep horizontally, not thrust down`);
      const normal=new Vector3(0,0,1).transformDirection(forearm.matrixWorld);
      assert.ok(Math.abs(normal.y)>.99,'Present the cutting edge along the horizontal swing');
      directions.push(direction);
    }
  }
  assert.ok(directions[0].angleTo(directions.at(-1))>2,'A broad sideways arc, not a straight thrust');
}

test('BladeSlash keeps the horizontal blade and forearm clear of the body throughout the cut',()=>{
  const {root,clips}=createRaven();
  assertHorizontalSlash(root,clips);
});

test('The exported BladeSlash preserves the horizontal arc and armor clearance',async()=>{
  const bytes=await readFile(new URL('../output/raven.glb',import.meta.url));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assertHorizontalSlash(asset.scene,asset.animations);
});

test('BladeSlash lunges, uncoils the hips, splits the legs and fires a strong burst',()=>{
  const windup=ravenPose('BladeSlash',.48),strike=ravenPose('BladeSlash',.78);
  const end=ravenPose('BladeSlash',RAVEN_MOTION.durations.BladeSlash);
  assert.ok(end.position[2]>2.5,'Finish forward of the starting position, not back at the origin');
  assert.ok(strike.position[2]-windup.position[2]>1.5,'The cut needs a forward lunge');
  assert.ok(windup.rotations.Hips[1]-strike.rotations.Hips[1]>1.1,'Hips must turn in the direction of the sideways cut');
  assert.ok(Math.abs(strike.rotations.LeftThigh[0]-strike.rotations.RightThigh[0])>.6,'Avoid parallel dangling legs');
  assert.ok(strike.jetScales.LeftBackJet[1]>2.8,'Booster burst should emphasize the strike');
  assert.ok(strike.position[1]>RAVEN_MOTION.hoverHeight+.3,'Rise into the flying cut');
});

test('Raven has a rigid weighted skeleton, boosters, a blade and an explicit floor',()=>{
  const {root,bones,clips}=createRaven();
  assert.ok(Object.keys(bones).length>=22);
  assert.deepEqual(clips.map(c=>c.name),['Hover','Boost','BladeSlash']);
  for(const name of ['RightForearm','BladeTip','LeftBackJet','RightBackJet'])assert.ok(bones[name]);
  assert.equal(inspectModel(root).groundY,0);
  let count=0;
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    assert.ok(mesh.isSkinnedMesh);count++;
    const weights=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<weights.count;i++)assert.equal(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i),1);
  });
  assert.ok(count>50);
});

test('Raven GLB is valid, floats, accelerates forward, and sweeps its skinned blade',async()=>{
  const bytes=await readFile(new URL('../output/raven.glb',import.meta.url));
  const report=await validator.validateBytes(new Uint8Array(bytes),{uri:'raven.glb',maxIssues:20});
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const mixer=new AnimationMixer(asset.scene),bone=name=>asset.scene.getObjectByName(name);
  let blade;
  asset.scene.traverse(mesh=>{if(mesh.isSkinnedMesh && mesh.name.includes('Blade_cutting'))blade=mesh;});
  assert.ok(blade,'The actual blade skin must be exported');
  const sample=(name,time)=>{
    mixer.stopAllAction();const action=mixer.clipAction(asset.animations.find(c=>c.name===name)).reset().play();
    action.time=time;mixer.update(0);asset.scene.updateMatrixWorld(true);
  };
  sample('Hover',0);const hoverStart=bone('Motion').position.clone();
  const startMatrices=new Map();asset.scene.traverse(o=>{if(o.isBone)startMatrices.set(o.name,o.matrixWorld.toArray());});
  sample('Hover',1.99999);assert.ok(bone('Motion').position.distanceTo(hoverStart)<.001);
  asset.scene.traverse(o=>{if(o.isBone)assert.ok(o.matrixWorld.toArray().every((value,i)=>Math.abs(value-startMatrices.get(o.name)[i])<.001),'Hover loop seam');});
  const z=[];for(const t of [0,.2,.4,.6,1,2.39999]){sample('Boost',t);z.push(bone('Motion').position.z);}
  assert.ok(z[2]-z[1]>z[1]-z[0],'Early travel must accelerate');
  assert.ok(z.at(-1)-z[0]>4,'Boost must move through world space');
  const tips=[],bladeVertices=[];let lowest=Infinity,bladeLength;
  for(const name of ['Hover','Boost','BladeSlash']) {
    const clip=asset.animations.find(c=>c.name===name);
    const frames=Math.ceil(clip.duration*60);
    for(let frame=0;frame<=frames;frame++) {
      sample(name,Math.min(clip.duration-1e-5,clip.duration*frame/frames));
      if(name==='BladeSlash')tips.push(bone('BladeTip').getWorldPosition(new Vector3()));
      blade.skeleton.update();
      const a=blade.getVertexPosition(0,new Vector3()).applyMatrix4(blade.matrixWorld);
      const b=blade.getVertexPosition(6,new Vector3()).applyMatrix4(blade.matrixWorld);
      bladeLength??=a.distanceTo(b);
      assert.ok(Math.abs(a.distanceTo(b)-bladeLength)<.00001,'Metal blade must remain rigid');
      if(name==='BladeSlash')bladeVertices.push(a);
      asset.scene.traverse(mesh=>{
        if(!mesh.isSkinnedMesh)return;
        mesh.skeleton.update();
        for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
          assert.ok([...p].every(Number.isFinite));
          if(!mesh.userData.effect)lowest=Math.min(lowest,p.y);
        }
      });
    }
  }
  assert.ok(lowest>.12,`Hover clearance must stay positive: ${lowest}`);
  assert.ok(tips.some(p=>p.distanceTo(tips[0])>1.5),'Blade must sweep, not just flicker');
  assert.ok(bladeVertices.some(p=>p.distanceTo(bladeVertices[0])>1),'The rendered blade vertices must move too');
});
