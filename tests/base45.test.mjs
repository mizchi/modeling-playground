import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, Triangle } from 'three';
import validator from 'gltf-validator';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBase45, createBase45Topology } from '../models/base45.mjs';
import { BASE45 } from '../models/base45-definition.mjs';
import { validateBaseTopology } from '../contracts/base-topology.mjs';
import { topologyToObj } from '../modeling/quad-topology.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

test('base is a symmetric grounded T-pose with a shortened head and real side depth',()=>{
  const data=createBase45Topology();validateBaseTopology(data);
  const root=createBase45(),size=new Box3().setFromObject(root).getSize(new Vector3());
  assert.ok(Math.abs(size.y-BASE45.height)<1e-5);assert.equal(BASE45.headHeight,.45);
  assert.ok(size.y/BASE45.headHeight>4.8&&size.y/BASE45.headHeight<5);
  assert.ok(Math.abs(new Box3().setFromObject(root).min.y)<1e-6);
  const key=p=>p.map(x=>x.toFixed(5).replace('-0.00000','0.00000')).join(',');
  const points=new Set(data.positions.map(key));
  for(const [x,y,z] of data.positions)assert.ok(points.has(key([-x,y,z])));
  const depth=(lo,hi)=>{const z=data.positions.filter(p=>p[1]>=lo&&p[1]<=hi).map(p=>p[2]);return Math.max(...z)-Math.min(...z);};
  assert.ok(depth(1.8,2.25)>.36,'Cranium has volume, not a flat face card');
  assert.ok(depth(1.15,1.4)>.22,'Chest/back are shaped in profile');
  assert.ok(depth(0,.14)>.28,'Feet project forward and have heels');
});

test('shared-index topology is one closed oriented surface, mostly quads',()=>{
  const data=createBase45Topology();validateBaseTopology(data);
  assert.ok(data.faces.filter(f=>f.length===4).length/data.faces.length>.95);
  assert.ok(data.positions.length<=666,'Keep the base compact, including ears and one neck support row');
  assert.ok(data.faces.length<=664,'Spend loops on silhouette, joints, eyes and ears, not uniform subdivision');
  const broken=structuredClone(data);broken.faces.pop();broken.regions.pop();
  assert.throws(()=>validateBaseTopology(broken),/edge|closed/i);
  const root=createBase45(),g=root.getObjectByName('BaseBody').geometry,t=new Triangle();
  for(let i=0;i<g.index.count;i+=3){[t.a,t.b,t.c].forEach((v,k)=>v.fromBufferAttribute(g.attributes.position,g.index.getX(i+k)));assert.ok(t.getArea()>1e-9);}
});

test('joint support loops deform while the torso stays fixed; separate head socket is specified',()=>{
  const root=createBase45(),skin=root.getObjectByName('BaseBody'),g=skin.geometry;
  const sample=name=>Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>skin.skeleton.bones[g.attributes.skinIndex.getX(i)].name===name&&g.attributes.skinWeight.getX(i)>.99);
  const at=i=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(g.attributes.position,i));
  const elbow=sample('LeftForearm'),knee=sample('LeftShin'),chest=sample('Chest');
  assert.ok([elbow,knee,chest].every(Number.isInteger));
  const before=[elbow,knee,chest].map(at);
  root.getObjectByName('LeftForearm').rotation.y=-.8;root.getObjectByName('LeftShin').rotation.x=.8;root.updateMatrixWorld(true);
  assert.ok(before[0].distanceTo(at(elbow))>.01);assert.ok(before[1].distanceTo(at(knee))>.01);assert.ok(before[2].distanceTo(at(chest))<1e-8);
  assert.equal(root.getObjectByName('HairSocket').parent.name,'Head');
  assert.equal(root.getObjectByName('FaceSocket').parent.name,'Head');
  for(let i=0;i<g.attributes.position.count;i++)assert.ok(Math.abs([0,1,2,3].reduce((s,k)=>s+g.attributes.skinWeight.array[i*4+k],0)-1)<1e-6);
});

test('quad OBJ and valid GLB retain the same reusable base and topology',async()=>{
  const data=createBase45Topology(),obj=topologyToObj(data);
  assert.equal(obj.split('\n').filter(l=>l.startsWith('f ')).length,data.faces.length);
  assert.equal(obj.split('\n').filter(l=>l.startsWith('v ')).length,data.positions.length);
  const bytes=await exportGlb(createBase45());const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  assert.ok(bytes.byteLength<120*1024);
  assert.deepEqual(Buffer.from(bytes),await readFile(new URL('../output/base45.glb',import.meta.url)));
  assert.equal(obj,await readFile(new URL('../output/base45.obj',import.meta.url),'utf8'));
  const delivered=JSON.parse(await readFile(new URL('../output/base45.topology.json',import.meta.url),'utf8'));
  // JSON canonically serializes -0 as 0; compare in the sidecar's numeric format.
  for(const key of ['positions','faces','weights','regions'])assert.deepEqual(delivered[key],JSON.parse(JSON.stringify(data[key])));
  const loaded=(await new GLTFLoader().parseAsync(bytes,'')).scene.getObjectByName('BaseBody');
  assert.equal(loaded.geometry.attributes.position.count,data.positions.length);
  assert.deepEqual(loaded.userData.quadTopology.faces,data.faces);
  data.positions.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(loaded.geometry.attributes.position.array[i*3+k]-v)<1e-6)));
});
