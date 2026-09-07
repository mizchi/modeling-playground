import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, AnimationMixer } from 'three';
import { createHuman, disposeHuman } from '../human/model.mjs';
import { presetRecipe, validateRecipe } from '../human/contract.mjs';
import { createMotions } from '../human/motion.mjs';

const recipe=model=>({...presetRecipe(model),hair:'lumi-side-tail',face:'lumi'});

test('side tail is an independent selectable hair asset with a small, opaque closed mesh',()=>{
  assert.equal(validateRecipe(recipe('base45-female')).hair,'lumi-side-tail');
  const root=createHuman(recipe('base45-female')),tail=root.getObjectByName('SideTail');
  assert.ok(tail?.isSkinnedMesh);assert.equal(tail.skeleton.bones.length,5);
  assert.equal(tail.skeleton.bones[0].parent.name,'HairSocket');
  const g=tail.geometry,p=g.attributes.position;
  assert.ok(g.index.count/3<=320);assert.equal(tail.material.transparent,false);
  assert.ok(g.attributes.uv);g.computeBoundingBox();
  assert.ok(g.boundingBox.min.x>.13);assert.ok(g.boundingBox.min.y<.7);
  assert.ok(g.boundingBox.max.y>2.2);assert.ok(g.boundingBox.max.x<.85);
  // UV seams can duplicate vertices; validate geometric edges, not buffer indices.
  const id=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');
  const edges=new Map();
  for(let i=0;i<g.index.count;i+=3){
    const ids=[0,1,2].map(k=>id(g.index.getX(i+k)));
    for(let k=0;k<3;k++){
      const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort().join('|');
      const e=edges.get(key)??[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);
    }
  }
  for(const [count,winding] of edges.values()){assert.equal(count,2);assert.equal(winding,0);}
  disposeHuman(root);
});

test('tail rest binding survives female proportions, face edits and every built-in motion',()=>{
  for(const model of ['base45','base45-female']){
    const r=recipe(model);r.shape.faceLength=.8;r.shape.faceWidth=-.5;
    const root=createHuman(r),tail=root.getObjectByName('SideTail'),p=tail.geometry.attributes.position;
    root.updateMatrixWorld(true);tail.skeleton.update();
    for(let i=0;i<p.count;i++){
      const rest=new Vector3().fromBufferAttribute(p,i);
      assert.ok(tail.applyBoneTransform(i,rest.clone()).distanceTo(rest)<1e-5);
    }
    const mixer=new AnimationMixer(root);
    for(const clip of createMotions(root)){
      mixer.stopAllAction();mixer.clipAction(clip).play();
      for(let t=0;t<=clip.duration;t+=.25){
        mixer.setTime(t);root.updateMatrixWorld(true);tail.skeleton.update();
        const posed=Array.from({length:p.count},(_,i)=>tail.applyBoneTransform(i,new Vector3().fromBufferAttribute(p,i)));
        for(const v of posed)assert.ok(v.toArray().every(Number.isFinite));
        for(let i=0;i<tail.geometry.index.count;i+=3){
          const [a,b,c]=[0,1,2].map(k=>posed[tail.geometry.index.getX(i+k)]);
          assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-8);
        }
      }
    }
    mixer.stopAllAction();disposeHuman(root);
  }
});

test('side-tail option preserves the approved fringe and can switch back without leftover bones',()=>{
  const short=createHuman(presetRecipe('lumi')),long=createHuman(recipe('lumi'));
  assert.deepEqual(long.getObjectByName('Hair').geometry.attributes.position.array,short.getObjectByName('Hair').geometry.attributes.position.array);
  const bare=createHuman({...recipe('base45-female'),hair:'none'});
  assert.equal(bare.getObjectByName('SideTail'),undefined);assert.equal(short.getObjectByName('SideTail'),undefined);
  [short,long,bare].forEach(disposeHuman);
});
