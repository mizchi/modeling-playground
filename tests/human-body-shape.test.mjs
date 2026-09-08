import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer, Matrix3, Vector3 } from 'three';
import { presetRecipe, validateRecipe } from '../human/contract.mjs';
import { createHuman, disposeHuman, exportRig } from '../human/model.mjs';
import { createHistory } from '../human/state.mjs';
import { createMotions } from '../human/motion.mjs';
import { createBase45Topology } from '../models/base45.mjs';
import { validateBaseTopology } from '../contracts/base-topology.mjs';

test('body parameters normalize legacy recipes, reject malformed data and participate in history',()=>{
  const current=presetRecipe('base45-female'),zero={chestSize:0,waistWidth:0,muscularity:0,legLength:0,height:0};
  assert.deepEqual(current.bodyShape,zero);
  const old=structuredClone(current);delete old.bodyShape;assert.deepEqual(validateRecipe(old),current);
  for(const bodyShape of [null,{},[],{...zero,chestSize:1.1},{...zero,waistWidth:NaN},{...zero,muscularity:-1},{...zero,muscularity:'1'},{...zero,extra:0}])
    assert.throws(()=>validateRecipe({...current,bodyShape}));
  const history=createHistory(old),next=history.value;next.bodyShape.chestSize=.7;
  history.commit(next);assert.equal(history.undo().bodyShape.chestSize,0);assert.equal(history.redo().bodyShape.chestSize,.7);
  next.bodyShape.chestSize=0;assert.equal(history.value.bodyShape.chestSize,.7);
});

test('chest, waist and muscles have independent local effects on both base models',()=>{
  for(const model of ['base45','base45-female']){
    const r=presetRecipe(model),base=createHuman(r),p=base.getObjectByName('BaseBody').geometry.attributes.position;
    const indices=predicate=>Array.from({length:p.count},(_,i)=>i).filter(i=>predicate(p.getX(i),p.getY(i),p.getZ(i)));
    const chest=indices((x,y,z)=>Math.abs(x)>.04&&Math.abs(x)<.19&&y>1.38&&y<1.48&&z>.10);
    const waist=indices((x,y)=>Math.abs(x)>.08&&Math.abs(y-1.24)<.01);
    for(const value of [-1,1])for(const key of ['chestSize','waistWidth']){
      const root=createHuman({...r,bodyShape:{...r.bodyShape,[key]:value}}),q=root.getObjectByName('BaseBody').geometry.attributes.position;
      if(key==='chestSize')assert.ok(chest.some(i=>(q.getZ(i)-p.getZ(i))*value>.035));
      if(key==='waistWidth')assert.ok(waist.some(i=>(Math.abs(q.getX(i))-Math.abs(p.getX(i)))*value>.025));
      const other=key==='chestSize'?waist:indices((x,y)=>y<.2);
      assert.ok(other.every(i=>new Vector3().fromBufferAttribute(p,i).distanceTo(new Vector3().fromBufferAttribute(q,i))<.004));
      disposeHuman(root);
    }
    const strong=createHuman({...r,bodyShape:{...r.bodyShape,muscularity:1}}),q=strong.getObjectByName('BaseBody').geometry.attributes.position;
    const arm=indices((x,y,z)=>Math.abs(x)>.35&&Math.abs(x)<.57&&z>.02);
    const thigh=indices((x,y,z)=>y>.72&&y<.98&&z>.03);
    assert.ok(arm.some(i=>q.getZ(i)>p.getZ(i)+.01));assert.ok(thigh.some(i=>q.getZ(i)>p.getZ(i)+.01));
    assert.ok(exportRig(strong).bones.find(b=>b.name==='LeftUpperArm').position[0]>exportRig(base).bones.find(b=>b.name==='LeftUpperArm').position[0]+.015);
    for(let i=0;i<p.count;i++)if(p.getY(i)>=1.65)assert.deepEqual(new Vector3().fromBufferAttribute(q,i).toArray(),new Vector3().fromBufferAttribute(p,i).toArray());
    [base,strong].forEach(disposeHuman);
  }
});

test('all body parameter corners preserve topology, binding and motion triangle orientation',()=>{
  const normal=([a,b,c])=>b.clone().sub(a).cross(c.clone().sub(a));
  for(const model of ['base45','base45-female'])for(const chestSize of [-1,1])for(const waistWidth of [-1,1])for(const muscularity of [0,1]){
    const root=createHuman({...presetRecipe(model),bodyShape:{chestSize,waistWidth,muscularity}}),mesh=root.getObjectByName('BaseBody');
    const p=mesh.geometry.attributes.position,d=createBase45Topology();
    d.positions=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i).toArray());validateBaseTopology(d);
    assert.equal(p.count,662);assert.equal(mesh.geometry.index.count/3,1320);
    root.updateMatrixWorld(true);mesh.skeleton.update();
    for(let i=0;i<p.count;i++){const v=new Vector3(...d.positions[i]);assert.ok(mesh.applyBoneTransform(i,v.clone()).distanceTo(v)<1e-6);}
    const mixer=new AnimationMixer(root);
    for(const clip of createMotions(root)){
      mixer.stopAllAction();mixer.clipAction(clip).play();
      for(let t=0;t<clip.duration;t+=.5){
        mixer.setTime(t);root.updateMatrixWorld(true);mesh.skeleton.update();
        const frames=mesh.skeleton.bones.map((b,i)=>new Matrix3().setFromMatrix4(b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i])));
        for(let i=0;i<mesh.geometry.index.count;i+=3){
          const ids=[0,1,2].map(k=>mesh.geometry.index.getX(i+k)),rest=ids.map(i=>new Vector3(...d.positions[i]));
          const rn=normal(rest),pn=normal(rest.map((v,k)=>mesh.applyBoneTransform(ids[k],v.clone()))),expected=new Vector3();
          for(const id of ids)for(let k=0;k<4;k++)expected.addScaledVector(rn.clone().applyMatrix3(frames[mesh.geometry.attributes.skinIndex.getComponent(id,k)]),mesh.geometry.attributes.skinWeight.getComponent(id,k)/3);
          assert.ok(pn.length()/rn.length()>.1&&pn.dot(expected)>0,`${model} ${JSON.stringify({chestSize,waistWidth,muscularity})} ${clip.name} ${t} tri ${i/3}`);
        }
      }
    }
    mixer.stopAllAction();mixer.uncacheRoot(root);disposeHuman(root);
  }
});

test('body edits leave both hair skins unchanged and honor imported final bone anchors',()=>{
  const r={...presetRecipe('base45-female'),hair:'lumi-side-tail',face:'lumi'},base=createHuman(r);
  const rig=exportRig(base);rig.bones.forEach(b=>{b.position[1]*=1.02;});
  const changed=createHuman({...r,bodyShape:{chestSize:1,waistWidth:-1,muscularity:1}});
  for(const name of ['Hair','SideTail'])assert.deepEqual(changed.getObjectByName(name).geometry.attributes.position.array,base.getObjectByName(name).geometry.attributes.position.array);
  const custom=createHuman({...r,bodyShape:{chestSize:.7,waistWidth:.8,muscularity:.8},rig});
  for(const b of rig.bones)assert.ok(custom.getObjectByName(b.name).getWorldPosition(new Vector3()).distanceTo(new Vector3(...b.position))<1e-6);
  custom.updateMatrixWorld(true);custom.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);assert.ok(mesh.applyBoneTransform(i,p.clone()).distanceTo(p)<1e-5);}
  });
  [base,changed,custom].forEach(disposeHuman);
});
