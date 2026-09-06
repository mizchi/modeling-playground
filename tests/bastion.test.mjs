import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { validateBytes } from 'gltf-validator';
import { BASTION_SLOTS, DEFAULT_LOADOUT, validateLoadout } from '../models/bastion-definition.mjs';
import { createBastion, replaceBastionPart, findBastion } from '../models/bastion.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';
import { modelMaterials } from '../modeling/resources.mjs';

test('Bastion loadouts reject unknown slots and incompatible parts without mutation',()=>{
  assert.equal(BASTION_SLOTS.length,11);
  assert.deepEqual(validateLoadout(DEFAULT_LOADOUT),DEFAULT_LOADOUT);
  assert.throws(()=>validateLoadout({...DEFAULT_LOADOUT,head:'gatling'}),/head/);
  assert.throws(()=>validateLoadout({...DEFAULT_LOADOUT,typo:'sensor'}),/typo/);
  assert.throws(()=>validateLoadout({head:'sensor'}),/core/);
});

test('Bastion has solid chest/back depth and two broad ground-contact feet',()=>{
  const root=createBastion();root.updateMatrixWorld(true);
  assert.equal(findBastion(root),root);
  const core=new Box3().setFromObject(root.getObjectByName('Mount_core')).getSize(new Vector3());
  assert.ok(core.z>1.1 && core.z<1.9,`chest depth ${core.z}`);
  for(const id of ['leftLeg','rightLeg']) {
    const box=new Box3().setFromObject(root.getObjectByName('Mount_'+id));
    assert.ok(Math.abs(box.min.y)<.002,'Feet must sit on ground');
    assert.ok(box.getSize(new Vector3()).z>1.3,'Wide fore/aft support, not flat front-only armor');
  }
  const names=new Set();
  root.traverse(node=>{
    assert.ok(!names.has(node.name),`duplicate ${node.name}`);names.add(node.name);
    if(!node.isMesh)return;
    for(const number of node.geometry.attributes.position.array)assert.ok(Number.isFinite(number));
    assert.ok(node.geometry.attributes.normal);
    assert.ok(node.geometry.attributes.uv);
  });
});

test('every compatible replacement preserves hardpoints and all unrelated parts',()=>{
  const root=createBastion();
  for(const slot of BASTION_SLOTS)for(const option of slot.options) {
    const mounts=BASTION_SLOTS.map(s=>root.getObjectByName('Mount_'+s.id));
    const before=mounts.map(m=>({matrix:m.matrix.toArray(),part:m.children[0]}));
    replaceBastionPart(root,slot.id,option.id);
    mounts.forEach((mount,i)=>{
      assert.equal(mount.children.length,1);
      assert.deepEqual(mount.matrix.toArray(),before[i].matrix);
      if(BASTION_SLOTS[i].id!==slot.id)assert.equal(mount.children[0],before[i].part);
    });
    assert.equal(root.userData.loadout[slot.id],option.id);
    const part=root.getObjectByName('Mount_'+slot.id).children[0];
    part.traverse(node=>{
      if(!node.isMesh)return;
      const p=node.geometry.attributes.position,n=node.geometry.attributes.normal;
      for(const value of p.array)assert.ok(Number.isFinite(value));
      for(let i=0;i<n.count;i++)assert.ok(Math.abs(new Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);
    });
    if(slot.id.endsWith('Leg'))assert.ok(Math.abs(new Box3().setFromObject(part).min.y)<.002);
  }
  const previous=JSON.stringify(root.toJSON());
  assert.throws(()=>replaceBastionPart(root,'head','gatling'));
  assert.equal(JSON.stringify(root.toJSON()),previous,'Invalid swap is atomic');
});

test('replaced modules release their resources without disposing unrelated modules',()=>{
  const root=createBastion(),head=root.getObjectByName('Mount_head').children[0];
  let headDisposals=0,unrelatedDisposals=0;
  for(const material of modelMaterials(head))material.addEventListener('dispose',()=>headDisposals++);
  for(const slot of BASTION_SLOTS.filter(s=>s.id!=='head'))for(const material of modelMaterials(root.getObjectByName('Mount_'+slot.id))) {
    material.addEventListener('dispose',()=>unrelatedDisposals++);
  }
  replaceBastionPart(root,'head','command');
  assert.ok(headDisposals>0);assert.equal(unrelatedDisposals,0);
});

test('Bastion exports a standalone valid GLB with editable mount metadata',async()=>{
  const root=createBastion();replaceBastionPart(root,'head','command');
  const bytes=new Uint8Array(await exportGlb(root));
  const result=await validateBytes(bytes,{maxIssues:20});
  assert.equal(result.issues.numErrors,0,JSON.stringify(result.issues.messages));
  const view=new DataView(bytes.buffer);
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+view.getUint32(12,true))));
  assert.equal(json.nodes.find(n=>n.name==='BASTION-06').extras.loadout.head,'command');
  for(const slot of BASTION_SLOTS)assert.equal(json.nodes.filter(n=>n.name==='Mount_'+slot.id).length,1);
  assert.ok(!JSON.stringify(json).includes('http'));
});
