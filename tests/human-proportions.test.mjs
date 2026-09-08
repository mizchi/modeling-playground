import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationMixer, Matrix3, Vector3 } from 'three';
import { presetRecipe, validateRecipe } from '../human/contract.mjs';
import { createHuman, disposeHuman, exportRig } from '../human/model.mjs';
import { createMotions } from '../human/motion.mjs';
import { humanFraming } from '../human/framing.mjs';

const v=(p,i)=>new Vector3().fromBufferAttribute(p,i);
test('height and leg length default to zero and migrate the previous three-field body shape',()=>{
  const r=presetRecipe('lumi');assert.equal(r.bodyShape.height,0);assert.equal(r.bodyShape.legLength,0);
  const old={...r,bodyShape:{chestSize:.5,waistWidth:-.5,muscularity:.2}};
  assert.deepEqual(validateRecipe(old).bodyShape,{...old.bodyShape,legLength:0,height:0});
  for(const patch of [{height:1.1},{legLength:-1.1},{height:NaN},{legLength:'1'}])assert.throws(()=>validateRecipe({...r,bodyShape:{...r.bodyShape,...patch}}));
  const partial=structuredClone(r);delete partial.bodyShape.height;assert.throws(()=>validateRecipe(partial));
});

test('leg length keeps soles grounded, preserves the torso and translates both hair skins rigidly',()=>{
  for(const model of ['base45','base45-female']){
    const r={...presetRecipe(model),hair:'lumi-side-tail',face:'lumi'},base=createHuman(r);
    const p=base.getObjectByName('BaseBody').geometry.attributes.position;
    for(const legLength of [-1,1]){
      const root=createHuman({...r,bodyShape:{...r.bodyShape,legLength}}),q=root.getObjectByName('BaseBody').geometry.attributes.position;
      const delta=.865*.30*legLength;
      for(let i=0;i<p.count;i++){
        const point=v(p,i),change=v(q,i).sub(point);
        assert.ok(Math.abs(change.x)<1e-6&&Math.abs(change.z)<1e-6);
        if(point.y<=.16)assert.ok(change.length()<1e-6);
        if(point.y>=1.025)assert.ok(Math.abs(change.y-delta)<1e-6);
      }
      for(const name of ['Hair','SideTail']){
        const a=base.getObjectByName(name).geometry.attributes.position,b=root.getObjectByName(name).geometry.attributes.position;
        for(let i=0;i<a.count;i++)assert.ok(v(b,i).sub(v(a,i)).distanceTo(new Vector3(0,delta,0))<1e-6);
      }
      for(const name of ['LeftShin','RightShin']){
        const a=base.getObjectByName(name).getWorldPosition(new Vector3()),b=root.getObjectByName(name).getWorldPosition(new Vector3());
        assert.ok(Math.abs((b.y-.16)/(a.y-.16)-(1+.3*legLength))<1e-6);
      }
      disposeHuman(root);
    }
    disposeHuman(base);
  }
});

test('height scales every skin and bone uniformly after body and face edits',()=>{
  for(const model of ['base45','base45-female']){
    const r={...presetRecipe(model),hair:'lumi-side-tail',face:'lumi'};
    r.bodyShape.chestSize=.7;r.bodyShape.muscularity=.8;r.bodyShape.legLength=.6;r.shape.noseHeight=.7;r.shape.faceLength=.5;
    const base=createHuman(r);
    for(const height of [-1,1]){
      const root=createHuman({...r,bodyShape:{...r.bodyShape,height}}),scale=1+.25*height;
      for(const name of ['BaseBody','Hair','SideTail']){
        const a=base.getObjectByName(name).geometry,b=root.getObjectByName(name).geometry;
        assert.deepEqual(a.index.array,b.index.array);assert.deepEqual(a.attributes.uv.array,b.attributes.uv.array);
        for(let i=0;i<a.attributes.position.count;i++)assert.ok(v(b.attributes.position,i).distanceTo(v(a.attributes.position,i).multiplyScalar(scale))<1e-6);
      }
      base.traverse(b=>{if(b.isBone)assert.ok(root.getObjectByName(b.name).getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()).multiplyScalar(scale))<1e-6);});
      disposeHuman(root);
    }
    disposeHuman(base);
  }
});

test('proportion extremes rebind at rest and remain nondegenerate during all built-in motions',()=>{
  for(const model of ['base45','base45-female'])for(const height of [-1,1])for(const legLength of [-1,1]){
    const r={...presetRecipe(model),hair:'lumi-side-tail',face:'lumi'};
    r.bodyShape={...r.bodyShape,chestSize:1,waistWidth:-1,muscularity:1,height,legLength};
    const root=createHuman(r),skins=[];root.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
    root.updateMatrixWorld(true);skins.forEach(s=>s.skeleton.update());
    for(const mesh of skins)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      const p=v(mesh.geometry.attributes.position,i);assert.ok(mesh.applyBoneTransform(i,p.clone()).distanceTo(p)<1e-6);
    }
    const mixer=new AnimationMixer(root);
    for(const clip of createMotions(root)){
      mixer.stopAllAction();mixer.clipAction(clip).play();
      for(let t=0;t<clip.duration;t+=.5){
        mixer.setTime(t);root.updateMatrixWorld(true);
        for(const mesh of skins){
          mesh.skeleton.update();const g=mesh.geometry;
          const frames=mesh.skeleton.bones.map((b,i)=>new Matrix3().setFromMatrix4(b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i])));
          const points=Array.from({length:g.attributes.position.count},(_,i)=>mesh.applyBoneTransform(i,v(g.attributes.position,i)));
          assert.ok(points.every(p=>p.toArray().every(Number.isFinite)));
          for(let i=0;i<g.index.count;i+=3){
            const ids=[0,1,2].map(k=>g.index.getX(i+k)),[a,b,c]=ids.map(id=>points[id]);
            const [ra,rb,rc]=ids.map(id=>v(g.attributes.position,id));
            const rn=rb.sub(ra).cross(rc.sub(ra)),pn=b.clone().sub(a).cross(c.clone().sub(a)),expected=new Vector3();
            for(const id of ids)for(let k=0;k<4;k++)expected.addScaledVector(rn.clone().applyMatrix3(frames[g.attributes.skinIndex.getComponent(id,k)]),g.attributes.skinWeight.getComponent(id,k)/3);
            assert.ok(pn.length()/rn.length()>.1&&pn.dot(expected)>0,`${model} height ${height} leg ${legLength} ${clip.name} ${t} ${mesh.name} tri ${i/3}`);
          }
        }
      }
    }
    mixer.stopAllAction();disposeHuman(root);
  }
});

test('imported final rig anchors take precedence over proportion sliders',()=>{
  const r=presetRecipe('base45-female'),base=createHuman(r),rig=exportRig(base);
  const root=createHuman({...r,bodyShape:{...r.bodyShape,height:1,legLength:1},rig});
  const result=exportRig(root);for(let i=0;i<rig.bones.length;i++)assert.ok(new Vector3(...result.bones[i].position).distanceTo(new Vector3(...rig.bones[i].position))<1e-6);
  [base,root].forEach(disposeHuman);
});

test('rest framing follows height and leg length without shrinking the face focus',()=>{
  const r=presetRecipe('base45'),base=createHuman(r),a=humanFraming(base);
  const tall=createHuman({...r,bodyShape:{...r.bodyShape,height:1,legLength:1}}),b=humanFraming(tall);
  assert.ok(b.body.distance>a.body.distance*1.35);
  assert.ok(Math.abs(b.face.distance/a.face.distance-1.25)<1e-6);
  assert.ok(Math.abs(b.face.target[1]-(a.face.target[1]+.2595)*1.25)<1e-6);
  const before=humanFraming(tall);tall.getObjectByName('LeftThigh').rotation.x=.4;tall.updateMatrixWorld(true);
  assert.deepEqual(humanFraming(tall),before);
  [base,tall].forEach(disposeHuman);
});
