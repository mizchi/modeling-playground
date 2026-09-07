import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import validator from 'gltf-validator';
import { createWyvern, WYVERN } from '../models/wyvern.mjs';
import { createWyvernRig } from '../models/wyvern-rig.mjs';
import { wyvernClips } from '../models/wyvern-motion.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

test('wyvern has two legs, wing forelimbs, a slender volumetric torso and a dominant wingspan',()=>{
  const model=createWyvern();model.updateMatrixWorld(true);
  assert.equal(model.name,'CINDERWING');assert.equal(model.userData.limbs,4);
  for(const name of ['Body','Neck','Head','LeftWing','RightWing','LeftLeg','RightLeg','Tail'])assert.ok(model.getObjectByName(name),name);
  const size=part=>new Box3().setFromObject(part).getSize(new Vector3());
  const bounds=new Box3().setFromObject(model),body=size(model.getObjectByName('Body')),head=size(model.getObjectByName('Head'));
  assert.ok(bounds.min.y>=-.001&&bounds.min.y<.02,'Claws ground the creature');
  assert.ok(size(model).x/body.x>8,'Wings, not a thick barrel body, dominate');
  assert.ok(body.z/body.x>.65,'Slender must not mean a front-facing cardboard torso');
  assert.ok(head.z/head.x>.9,'Head has a snout and a back, not just a front silhouette');
  assert.ok(size(model.getObjectByName('Tail')).z>4,'Long tapering tail counterbalances the head');
  assert.ok(Object.isFrozen(WYVERN));
});

test('wing membranes have visible area and depth, mirrored anchors and attached fingers',()=>{
  const model=createWyvern();
  const left=model.getObjectByName('LeftWing'),right=model.getObjectByName('RightWing');
  assert.ok(left.userData.membraneArea>8);assert.equal(left.userData.membraneArea,right.userData.membraneArea);
  assert.equal(left.userData.fingers.length,5);
  for(let i=0;i<5;i++) {
    const a=left.userData.fingers[i],b=right.userData.fingers[i];
    assert.deepEqual(b,[-a[0],a[1],a[2]]);
  }
  const box=new Box3().setFromObject(left),size=box.getSize(new Vector3());
  assert.ok(size.z>3&&size.y>2,'Swept membranes read in side and rear views');
});

test('low-poly geometry is finite, nondegenerate, unit-normal and reproducible',()=>{
  const a=createWyvern(),b=createWyvern();let triangles=0,meshes=0;
  const attributes=[];
  a.traverse(n=>{if(!n.isMesh)return;meshes++;
    const p=n.geometry.attributes.position,normal=n.geometry.attributes.normal,c=n.geometry.attributes.color;
    assert.ok(c&&c.count===p.count);assert.ok(!n.geometry.index);
    assert.ok(Array.from(p.array).every(Number.isFinite));attributes.push(Array.from(p.array));
    for(let i=0;i<p.count;i+=3) {
      const x=new Vector3().fromBufferAttribute(p,i),y=new Vector3().fromBufferAttribute(p,i+1),z=new Vector3().fromBufferAttribute(p,i+2);
      assert.ok(y.sub(x).cross(z.sub(x)).length()>1e-9,`${n.name}: zero-area face`);triangles++;
    }
    for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-4);
  });
  const other=[];b.traverse(n=>{if(n.isMesh)other.push(Array.from(n.geometry.attributes.position.array));});
  assert.deepEqual(attributes,other);assert.ok(triangles<4500,`${triangles} triangles`);assert.ok(meshes<45,`${meshes} meshes`);
});

test('delivered wyvern GLB matches source, is self-contained and validates cleanly',async()=>{
  const bytes=await readFile(new URL('../output/wyvern.glb',import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(createWyvernRig(),wyvernClips())));
  const report=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:20});
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.ok(json.buffers.every(b=>!b.uri));assert.equal((json.cameras??[]).length,0);
  assert.ok(json.skins.length>0);assert.ok(bytes.length<1_000_000);
});
