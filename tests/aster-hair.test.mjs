import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Quaternion, Raycaster, Vector3 } from 'three';
import { createAster } from '../models/aster.mjs';
import { HairRig } from '../runtime/hair-rig.mjs';
import { validateHairDynamics } from '../contracts/hair.mjs';
import { ASTER_HAIR_DYNAMICS } from '../models/aster-hair.mjs';
import { readFile } from 'node:fs/promises';

test('sculpted clumps continue across the crown and the forelock has uneven tips',()=>{
  const hair=createAster().getObjectByName('Hair'),p=hair.geometry.attributes.position;
  const near=(x,y,z)=>Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i))
    .some(v=>v.distanceTo(new Vector3(x,y,z))<.001);
  assert.ok(near(-.175,.21,.25),'A tapered off-center forelock tip');
  const rear=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-.34)<.001&&p.getZ(i)<-.2)rear.push(p.getZ(i));
  assert.ok(Math.max(...rear)-Math.min(...rear)>.035,'Ridges are geometry on the crown, not only painted on the lengths');
});

test('rear hair is a continuous curved curtain, not two detached flat plates',()=>{
  const root=createAster(),hair=root.getObjectByName('Hair');root.updateMatrixWorld(true);
  for(const y of [1.34,1.22,1.08]) {
    const ray=new Raycaster(new Vector3(0,y,-2),new Vector3(0,0,1));
    assert.ok(ray.intersectObject(hair,false).length>0,`Rear center is covered at ${y}`);
  }
  const p=hair.geometry.attributes.position,ring=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)+.14)<.001)ring.push(p.getZ(i));
  assert.ok(Math.max(...ring)-Math.min(...ring)>.2,'The back wraps around in cross-section');
});

test('crown narrows progressively above the widest section instead of a bucket wall and flat lid',()=>{
  const hair=createAster().getObjectByName('Hair'),g=hair.geometry,p=g.attributes.position;
  const crown=[];
  for(let i=0;i<p.count;i++)if(g.attributes.skinIndex.getX(i)===0&&p.getY(i)>.30)
    crown.push(new Vector3().fromBufferAttribute(p,i));
  const at=y=>Math.max(...crown.filter(v=>Math.abs(v.y-y)<.005).map(v=>Math.abs(v.x)));
  assert.ok(at(.45)>.20&&at(.45)<.27,'Curving shoulder of the hemisphere');
  assert.ok(at(.53)>.10&&at(.53)<.17,'An intermediate ring rounds the upper crown');
  assert.ok(at(.56)<.04,'Very small pole, not a flat cap');
});

test('blonde long hair has weighted lengths and a separate anchored ahoge chain',()=>{
  const model=createAster(),hair=model.getObjectByName('Hair');
  assert.ok(hair.isSkinnedMesh);
  const box=new Box3().setFromObject(hair),face=new Box3().setFromObject(model.getObjectByName('Face'));
  assert.ok(box.min.y<1.1,'Long hair reaches toward the waist');
  assert.ok(box.max.y>face.max.y+.25,'Ahoge rises above the crown');
  const rig=new HairRig(hair);assert.equal(rig.chains.length,5);
  assert.ok(rig.chains.some(c=>c.id==='ahoge'));
  const p=hair.geometry.attributes.position,w=hair.geometry.attributes.skinWeight;
  for(let i=0;i<p.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
});
test('hair dynamics contract survives export and rejects malformed solver settings',async()=>{
  const bytes=await readFile(new URL('../output/aster.glb',import.meta.url));
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.deepEqual(json.nodes.find(n=>n.name==='Hair').extras.hairDynamics,ASTER_HAIR_DYNAMICS);
  for(const mutate of [s=>s.chains[0].maxAngle=NaN,s=>s.chains[0].pinned=0,
    s=>s.chains[0].joints[1]=s.anchor,s=>s.colliderHints[0].radius=-1]) {
    const bad=structuredClone(ASTER_HAIR_DYNAMICS);mutate(bad);assert.throws(()=>validateHairDynamics(bad),/Invalid/);
  }
});
test('head rotation carries the hair cap and fixed chain roots without double transforms',()=>{
  const root=createAster(),hair=root.getObjectByName('Hair'),head=root.getObjectByName('Head');
  const g=hair.geometry,i=Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>g.attributes.skinIndex.getX(i)===0);
  const local=new Vector3().fromBufferAttribute(g.attributes.position,i);
  head.rotation.set(.2,-.3,.1);root.updateMatrixWorld(true);
  const actual=hair.localToWorld(hair.applyBoneTransform(i,local.clone()));
  assert.ok(actual.distanceTo(head.localToWorld(local.clone()))<1e-7);
});
test('joint control bends actual tips but pins the cap and leaves the face unchanged',()=>{
  const model=createAster(),hair=model.getObjectByName('Hair'),rig=new HairRig(hair);
  const g=hair.geometry,point=i=>hair.localToWorld(hair.applyBoneTransform(i,new Vector3().fromBufferAttribute(g.attributes.position,i)));
  const index=name=>hair.skeleton.bones.findIndex(b=>b.name===name);
  const find=bone=>Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>g.attributes.skinIndex.getX(i)===index(bone)&&g.attributes.skinWeight.getX(i)>.99);
  const cap=find('HairAnchor'),tip=find('HairBackLeftTip');assert.ok([cap,tip].every(Number.isInteger));
  const before=point(tip),capBefore=point(cap),face=model.getObjectByName('Face').geometry.attributes.position.array.slice();
  rig.setJoint('back-left',1,new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.35));
  model.updateMatrixWorld(true);
  assert.ok(point(tip).distanceTo(before)>.03);assert.ok(point(cap).distanceTo(capBefore)<1e-7);
  assert.deepEqual(model.getObjectByName('Face').geometry.attributes.position.array,face);
  rig.reset();model.updateMatrixWorld(true);assert.ok(point(tip).distanceTo(before)<1e-7);
  assert.throws(()=>rig.setJoint('back-left',0,new Quaternion()),/pinned/);
  assert.throws(()=>rig.setJoint('missing',1,new Quaternion()),/Unknown/);
  assert.throws(()=>rig.setJoint('back-left',1,new Quaternion(NaN,0,0,1)),/quaternion/);
});
