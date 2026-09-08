import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Matrix4,Vector3,Quaternion} from 'three';
import {fingerDefinitions,fingerInfluences} from '../human/models/lumi-meshy-v2/src/finger-profile.ts';
import {addFingerRig} from '../human/models/lumi-meshy-v2/src/finger-rig.ts';
import {GlbEditor} from '../human/models/lumi-meshy-v2/src/glb-editor.ts';

test('five calibrated finger chains have three joints and normalized independent influences',()=>{
  assert.equal(fingerDefinitions.length,5);
  for(const finger of fingerDefinitions){
    assert.equal(finger.points.length,4);
    const influences=fingerInfluences(finger.points[3]);
    assert.ok(influences.some(w=>w.finger===finger.name&&w.weight>.9));
    assert.ok(Math.abs(influences.reduce((sum,w)=>sum+w.weight,0)-1)<1e-9);
  }
  assert.deepEqual(fingerInfluences([.01,0,0]),[]);
  assert.throws(()=>fingerInfluences([NaN,0,0]));
});

test('GLB editor rejects invalid input and preserves existing binary while appending attributes',()=>{
  assert.throws(()=>new GlbEditor(new Uint8Array(40)));
});

test('delivered finger rig preserves mesh, clips and neutral skinning while adding 30 usable joints',async t=>{
  const root=new URL('../human/models/lumi-meshy-v2/',import.meta.url);
  let raw:Buffer;
  try{raw=await readFile(new URL('src/input/lumi-meshy-v2.glb',root));}catch(e){if(e.code==='ENOENT'){t.skip('Local generated input is optional');return;}throw e;}
  const {relaxHandsGlb}=await import('../human/models/lumi-meshy-v2/src/relax-hands.ts');
  const relaxed=relaxHandsGlb(raw),before=new GlbEditor(relaxed),after=new GlbEditor(addFingerRig(raw,relaxed));
  assert.equal(after.doc.skins[0].joints.length,54);
  assert.deepEqual(after.doc.animations,before.doc.animations);
  assert.deepEqual(after.doc.materials,before.doc.materials);
  const a=before.doc.meshes[0].primitives[0],b=after.doc.meshes[0].primitives[0];
  for(const key of ['POSITION','NORMAL','TEXCOORD_0'])assert.deepEqual(after.read(b.attributes[key]),before.read(a.attributes[key]));
  assert.equal(a.indices,b.indices);
  const joints=after.read(b.attributes.JOINTS_0),weights=after.read(b.attributes.WEIGHTS_0);
  for(const row of weights)assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-5);
  const used=new Set(joints.flatMap((row,i)=>row.filter((_,j)=>weights[i][j]>0)));
  for(let i=24;i<54;i++)assert.ok(used.has(i),`unused finger joint ${i}`);
  const binds=after.read(after.doc.skins[0].inverseBindMatrices);
  for(const nodeId of after.doc.skins[0].joints.slice(24)){
    const slot=after.doc.skins[0].joints.indexOf(nodeId),parent=after.doc.nodes.findIndex(n=>n.children?.includes(nodeId));
    const parentSlot=after.doc.skins[0].joints.indexOf(parent),node=after.doc.nodes[nodeId];
    const local=after.nodeMatrix(nodeId);
    const calculated=new Matrix4().fromArray(binds[parentSlot]).invert().multiply(local).multiply(new Matrix4().fromArray(binds[slot]));
    assert.ok(calculated.elements.every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-4),node.name);
  }
  // Compare actual skinning, including an animated wrist, not only bone counts.
  const matrices=(edit:GlbEditor,bend=false)=>{
    const parents=new Map();edit.doc.nodes.forEach((n,i)=>n.children?.forEach(child=>parents.set(child,i)));
    const world=new Map();
    const visit=i=>{
      if(world.has(i))return world.get(i);
      const local=edit.nodeMatrix(i);
      if(bend&&edit.doc.nodes[i].name==='LeftHand')local.multiply(new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.7)));
      const result=parents.has(i)?visit(parents.get(i)).clone().multiply(local):local;world.set(i,result);return result;
    };
    const binds=edit.read(edit.doc.skins[0].inverseBindMatrices);
    return edit.doc.skins[0].joints.map((id,i)=>visit(id).clone().multiply(new Matrix4().fromArray(binds[i])));
  };
  const points=before.read(a.attributes.POSITION),oldWeights=before.read(a.attributes.WEIGHTS_0),oldJoints=before.read(a.attributes.JOINTS_0);
  for(const animated of [false,true]){
    const old=matrices(before,animated),next=matrices(after,animated);
    const skin=(p,j,w,mat)=>j.reduce((result,slot,k)=>result.addScaledVector(new Vector3().fromArray(p).applyMatrix4(mat[slot]),w[k]),new Vector3());
    for(let i=0;i<points.length;i++)assert.ok(skin(points[i],oldJoints[i],oldWeights[i],old).distanceTo(skin(points[i],joints[i],weights[i],next))<1e-5,`neutral vertex ${i} changed`);
  }
  assert.throws(()=>addFingerRig(raw,after.finish()),/already/);
});
