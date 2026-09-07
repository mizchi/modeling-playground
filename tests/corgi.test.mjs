import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import validator from 'gltf-validator';
import { createDog } from '../models/dog.mjs';
import { DOG, CORGI } from '../models/dog-definition.mjs';
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

test('compact corgi exports using the shared generator and idle animation',async()=>{
  const bytes=await readFile(new URL('../output/corgi.glb',import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(createDog(CORGI),dogClips())));
  assert.ok(bytes.length<CORGI.byteBudget);
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const meshes=[];loaded.scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
  assert.equal(meshes.length,1);assert.equal(meshes[0].skeleton.bones.length,17);
  assert.ok(meshes[0].geometry.index.count/3<=CORGI.triangleBudget);
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
