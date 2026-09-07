import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3 } from 'three';
import { createBase45 } from '../models/base45.mjs';
import { createLumi } from '../models/lumi.mjs';
import { BASE45_BONES } from '../models/base45-definition.mjs';
import { presetRecipe, validateRecipe, validateRig } from '../human/contract.mjs';
import { createHuman, disposeHuman } from '../human/model.mjs';
import { fitMotion, createMotions } from '../human/motion.mjs';
import { createHistory } from '../human/state.mjs';
import { inspectMotionGlb } from '../human/io.mjs';

test('human recipes are versioned, bounded and limited to the two existing models',()=>{
  assert.equal(presetRecipe('base45').hair,'none');
  assert.equal(presetRecipe('lumi').face,'lumi');
  for(const patch of [{model:'female'},{version:2},{unknown:1},{shape:{noseHeight:NaN}},{shape:{eyeSpacing:2}}])
    assert.throws(()=>validateRecipe({...presetRecipe('lumi'),...patch}));
  assert.throws(()=>validateRig({version:1,bones:BASE45_BONES.slice(1)}));
  assert.throws(()=>validateRig({version:1,bones:BASE45_BONES.map(b=>({...b,parent:b.name}))}));
});

test('default human adapters exactly preserve approved BASE-45 and LUMI geometry and rest rigs',()=>{
  for(const [id,factory] of [['base45',createBase45],['lumi',createLumi]]) {
    const source=factory(),human=createHuman(presetRecipe(id));
    for(const name of ['BaseBody',...(id==='lumi'?['Hair']:[])]) {
      assert.deepEqual(human.getObjectByName(name).geometry.attributes.position.array,source.getObjectByName(name).geometry.attributes.position.array);
    }
    for(const b of BASE45_BONES)assert.deepEqual(human.getObjectByName(b.name).position.toArray(),source.getObjectByName(b.name).position.toArray());
    disposeHuman(source);disposeHuman(human);
  }
});

test('modules switch independently and edits regenerate without mutating the approved assets',()=>{
  const original=createLumi(),before=original.getObjectByName('BaseBody').geometry.attributes.position.array.slice();
  const recipe=presetRecipe('base45');recipe.hair='lumi-short';recipe.face='lumi';recipe.shape.noseHeight=1;
  const human=createHuman(recipe);
  assert.ok(human.getObjectByName('Hair'));assert.ok(human.getObjectByName('BaseBody').material.map);
  const p=human.getObjectByName('BaseBody').geometry.attributes.position,base=original.getObjectByName('BaseBody').geometry.attributes.position;
  const front=(a)=>Array.from({length:a.count},(_,i)=>i).filter(i=>Math.abs(a.getX(i))<.02&&Math.abs(a.getY(i)-1.89)<.01).map(i=>a.getZ(i));
  assert.ok(Math.max(...front(p))>Math.max(...front(base))+.02);
  assert.deepEqual(original.getObjectByName('BaseBody').geometry.attributes.position.array,before);
  disposeHuman(original);disposeHuman(human);
});

test('eye spacing moves geometry together with its UV features; shape extremes remain finite and symmetric',()=>{
  const r=presetRecipe('lumi'),base=createHuman(r);r.shape.eyeSpacing=1;
  const changed=createHuman(r),p=changed.getObjectByName('BaseBody').geometry.attributes.position,b=base.getObjectByName('BaseBody').geometry.attributes.position;
  const indices=Array.from({length:b.count},(_,i)=>i).filter(i=>b.getX(i)>.06&&b.getX(i)<.12&&b.getY(i)>1.92&&b.getY(i)<1.95&&b.getZ(i)>.12);
  assert.ok(indices.length>0);assert.ok(indices.every(i=>p.getX(i)>b.getX(i)));
  assert.deepEqual(changed.getObjectByName('BaseBody').geometry.attributes.uv.array,base.getObjectByName('BaseBody').geometry.attributes.uv.array);
  for(const value of [-1,1]) {
    for(const key of Object.keys(r.shape))r.shape[key]=value;
    const human=createHuman(r);
    human.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
    const mesh=human.getObjectByName('BaseBody');human.updateMatrixWorld(true);
    const v=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,100),rest=v.clone();mesh.applyBoneTransform(100,v);
    assert.ok(v.distanceTo(rest)<1e-6,'Changing proportions must not double-transform the rest mesh');
    disposeHuman(human);
  }
  disposeHuman(base);disposeHuman(changed);
});

test('compatible skeleton replacement moves weighted geometry and rebinds both skins',()=>{
  const rig={version:1,bones:BASE45_BONES.map(b=>({...b,position:b.position.map((v,k)=>k===1?v*1.1:v)}))};
  const r=presetRecipe('lumi');r.rig=validateRig(rig);const human=createHuman(r);human.updateMatrixWorld(true);
  assert.ok(Math.abs(human.getObjectByName('Head').getWorldPosition(new Vector3()).y-1.936)<1e-6);
  for(const name of ['BaseBody','Hair']) {
    const mesh=human.getObjectByName(name),p=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,10),rest=p.clone();
    mesh.applyBoneTransform(10,p);assert.ok(p.distanceTo(rest)<1e-6);
  }
  disposeHuman(human);
});

test('motion injection rejects unknown joints and invalid tracks, accepts compatible clips without modifying the source',()=>{
  const root=createHuman(presetRecipe('lumi'));
  const clip=new AnimationClip('turn',1,[new QuaternionKeyframeTrack('Head.quaternion',[0,1],[0,0,0,1,0,.1,0,Math.sqrt(.99)])]);
  assert.equal(fitMotion(root,clip).name,'turn');
  const bad=clip.clone();bad.tracks[0].name='Missing.quaternion';assert.throws(()=>fitMotion(root,bad));
  const invalid=clip.clone();invalid.tracks[0].values[0]=NaN;assert.throws(()=>fitMotion(root,invalid));
  assert.ok(createMotions(root).length>=2);assert.equal(clip.tracks[0].name,'Head.quaternion');disposeHuman(root);
});

test('recipe history copies state, rejects invalid edits transactionally and discards branched redo',()=>{
  const h=createHistory(),next=h.value;next.shape.noseHeight=.5;assert.equal(h.value.shape.noseHeight,0);
  h.commit(next);assert.equal(h.undo().shape.noseHeight,0);assert.equal(h.redo().shape.noseHeight,.5);
  const bad=h.value;bad.shape.noseHeight=2;assert.throws(()=>h.commit(bad));assert.equal(h.value.shape.noseHeight,.5);
  h.undo();h.commit(presetRecipe('base45'));assert.equal(h.canRedo,false);
});

test('motion root offsets are based on immutable rest anchors, even while another clip is playing',()=>{
  const root=createHuman(presetRecipe('base45'));root.getObjectByName('Hips').position.y+=3;
  const clip=new AnimationClip('root',1,[new VectorKeyframeTrack('Hips.position',[0,1],[0,100,0,0,100.1,0])]);
  const fitted=fitMotion(root,clip);
  assert.ok(Math.abs(fitted.tracks[0].values[1]-1.02)<1e-5);
  assert.equal(clip.tracks[0].values[1],100);disposeHuman(root);
});

test('motion GLB inspection rejects network references before invoking the loader',()=>{
  const json=JSON.stringify({asset:{version:'2.0'},animations:[{}],buffers:[{uri:'https://example.invalid/data.bin'}]});
  const encoded=new TextEncoder().encode(json),buffer=new ArrayBuffer(20+encoded.length),v=new DataView(buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,buffer.byteLength,true);v.setUint32(12,encoded.length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(buffer,20).set(encoded);
  assert.throws(()=>inspectMotionGlb(buffer),/外部URI/);
});
