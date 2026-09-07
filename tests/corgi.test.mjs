import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Color, Triangle, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';
import { createDog } from '../models/dog.mjs';
import { DOG, CORGI, DOG_PRESETS, dogPoint } from '../models/dog-definition.mjs';
import { dogClips } from '../models/dog-motion.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

test('corgi reuses the canine skeleton but has a long torso and genuinely short legs',()=>{
  const shiba=createDog(DOG),corgi=createDog(CORGI);
  const dimensions=root=>{
    root.updateMatrixWorld(true);
    const front=root.getObjectByName('FrontLeftUpper').getWorldPosition(new Vector3());
    const hind=root.getObjectByName('HindLeftUpper').getWorldPosition(new Vector3());
    const paw=root.getObjectByName('FrontLeftPaw').getWorldPosition(new Vector3());
    return {length:front.z-hind.z,leg:front.y-paw.y};
  };
  const a=dimensions(shiba),b=dimensions(corgi);
  assert.ok(b.length>a.length*1.5);assert.ok(b.leg<a.leg*.8);
  assert.ok(b.length/b.leg>3,'Long and low, not a uniformly flattened Shiba');
  const skeleton=root=>{let result;root.traverse(n=>{if(n.isSkinnedMesh)result=n.skeleton;});return result;};
  assert.deepEqual(skeleton(shiba).bones.map(b=>b.name),skeleton(corgi).bones.map(b=>b.name));
  assert.equal(corgi.userData.modelId,'corgi');
});

test('chibi corgi changes proportions, not just overall size',()=>{
  const chibi=DOG_PRESETS['corgi-chibi'];
  assert.ok(chibi,'Chibi must be a separate preset');
  const span=(preset,region,a,b,axis)=>Math.abs(dogPoint(preset,region,a)[axis]-dogPoint(preset,region,b)[axis]);
  const body=p=>span(p,'body',[0,.63,-.37],[0,.63,.38],2);
  const head=p=>span(p,'head',[-.285,1.025,.56],[.285,1.025,.56],0);
  const eye=p=>span(p,'eyes',[.22,1.12,.835],[.22,1.08,.835],1);
  assert.ok(body(chibi)<body(CORGI)*.8);
  assert.ok(head(chibi)/body(chibi)>head(CORGI)/body(CORGI)*1.6);
  assert.ok(eye(chibi)>eye(CORGI)*1.6);
  assert.ok(chibi.shape.legHeight<CORGI.shape.legHeight);
  const a=createDog(chibi),b=createDog(CORGI);
  assert.deepEqual(a.getObjectByName(chibi.meshName).skeleton.bones.map(b=>b.name),
    b.getObjectByName(CORGI.meshName).skeleton.bones.map(b=>b.name));
});

test('chibi eyes stay attached to the faceted head surface',()=>{
  const preset=DOG_PRESETS['corgi-chibi'];
  const geometry=createDog(preset).getObjectByName(preset.meshName).geometry;
  const {position,color}=geometry.attributes,index=geometry.index;
  const rgb=hex=>new Color(hex).toArray().map(v=>Math.round(v*255));
  const matches=(i,hex)=>rgb(hex).every((v,k)=>color.array[i*3+k]===v);
  const triangle=new Triangle(),closest=new Vector3(),point=new Vector3();
  const assertAttached=point=>{
    let distance=Infinity;
    for(let j=0;j<index.count;j+=3) {
      const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];
      if(!ids.every(k=>matches(k,preset.palette.coat)))continue;
      [triangle.a,triangle.b,triangle.c].forEach((v,k)=>v.fromBufferAttribute(position,ids[k]));
      triangle.closestPointToPoint(point,closest);distance=Math.min(distance,point.distanceTo(closest));
    }
    assert.ok(distance<.005,`Eye surface is ${distance} away from skin`);
  };
  let eyes=0;
  const isEye=i=>matches(i,preset.palette.nose)&&position.getY(i)>=.87;
  for(let i=0;i<position.count;i++) {
    if(!isEye(i))continue;
    eyes++;assertAttached(point.fromBufferAttribute(position,i));
  }
  // Corners alone cannot catch a decal cutting through a convex face.
  for(let i=0;i<index.count;i+=3) {
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    if(!ids.every(isEye))continue;
    point.set(0,0,0);
    for(const id of ids)point.add(new Vector3().fromBufferAttribute(position,id));
    assertAttached(point.divideScalar(3));
  }
  assert.ok(eyes>=8);
});

for(const id of ['corgi','corgi-chibi'])test(`${id} exports using the shared generator and idle animation`,async()=>{
  const preset=DOG_PRESETS[id];
  const bytes=await readFile(new URL(`../output/${id}.glb`,import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(createDog(preset),dogClips())));
  assert.ok(bytes.length<preset.byteBudget);
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const meshes=[];loaded.scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
  assert.equal(meshes.length,1);assert.equal(meshes[0].skeleton.bones.length,17);
  assert.ok(meshes[0].geometry.index.count/3<=preset.triangleBudget);
  const mesh=meshes[0],mixer=new AnimationMixer(loaded.scene),p=new Vector3();
  mixer.clipAction(loaded.animations[0]).play();let first,last;
  for(let i=0;i<=32;i++) {
    mixer.setTime(loaded.animations[0].duration*i/32);loaded.scene.updateMatrixWorld(true);mesh.skeleton.update();
    const frame=[];
    for(let j=0;j<mesh.geometry.attributes.position.count;j++) {
      mesh.getVertexPosition(j,p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.y>=-.002);frame.push(...p);
    }
    if(i===0)first=frame;if(i===32)last=frame;
  }
  first.forEach((v,i)=>assert.ok(Math.abs(v-last[i])<1e-5));
});
