import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import validator from 'gltf-validator';
import { createSuzu, SUZU, faceZ } from '../models/suzu.mjs';

test('Suzu is a deterministic, named Three.js character with surface-fitted anime eyes', () => {
  const root=createSuzu();
  assert.equal(root.name,'Suzu');
  for(const name of ['Head','Hair','Dress','LeftArm','RightArm','LeftLeg','RightLeg','LeftEye','RightEye'])
    assert.ok(root.getObjectByName(name),name);
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root);
  assert.ok(bounds.min.y>=-.001);
  assert.ok(bounds.max.y>1.5 && bounds.max.y<1.8);
  const headSize=new Box3().setFromObject(root.getObjectByName('Head')).getSize(new Vector3());
  const torsoSize=new Box3().setFromObject(root.getObjectByName('Fitted bodice')).getSize(new Vector3());
  assert.ok(headSize.z/headSize.x>.84,'Skull must have volume in profile');
  assert.ok(torsoSize.z/torsoSize.x>.72,'Torso must not be a flattened front-view silhouette');
  for(const side of ['Left','Right']) {
    const eye=root.getObjectByName(side+'Eye');
    assert.equal(eye.userData.style,'surface-fitted-almond');
    assert.ok(eye.getObjectByName(side+'UpperLash'));
    assert.ok(eye.getObjectByName(side+'Iris'));
    const geometry=eye.getObjectByName(side+'Sclera').geometry;
    const sclera=(geometry.index?geometry.toNonIndexed():geometry).attributes.position;
    for(let i=0;i<sclera.count;i+=3) {
      const center=new Vector3();
      for(let j=0;j<3;j++)center.add(new Vector3().fromBufferAttribute(sclera,i+j));
      center.divideScalar(3);
      assert.ok(center.z>=faceZ(center.x,center.y)+.0005,'Eye triangles must stay above the face between vertices');
    }
    const size=new Box3().setFromObject(eye).getSize(new Vector3());
    assert.ok(size.z<size.x*.55,'Eye must not be a protruding sphere');
  }
  const counts=[];
  for(const model of [root,createSuzu()]) {
    let count=0;
    model.traverse(o=>{if(o.isMesh){count+=o.geometry.attributes.position.count;
      assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
      const n=o.geometry.attributes.normal;
      for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,`Invalid normal: ${o.name}`);
    }});
    counts.push(count);
  }
  assert.equal(counts[0],counts[1]);
  assert.ok(Object.isFrozen(SUZU));
});

test('Suzu GLB is portable, self-contained and contains no studio or rig', async () => {
  const bytes=await readFile(new URL('../output/suzu.glb',import.meta.url));
  const report=await validator.validateBytes(new Uint8Array(bytes),{uri:'suzu.glb',maxIssues:20});
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(gltf.nodes.find(n=>n.name==='Suzu').extras.generator,'Three.js');
  assert.ok(gltf.buffers.every(b=>!b.uri));
  assert.equal((gltf.skins??[]).length,0);
  assert.equal((gltf.cameras??[]).length,0);
  assert.ok(bytes.length<5*1024*1024);
});
