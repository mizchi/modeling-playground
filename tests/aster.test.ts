import { assetUrl } from '../modeling/asset-paths.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Triangle, Vector3 } from 'three';
import validator from 'gltf-validator';
import { createAster } from '../human/models/aster/src/model.ts';
import { ASTER, ASTER_BONES } from '../human/models/aster/src/definition.ts';
import { ASTER_FACE, createAsterHead } from '../human/models/aster/src/head.ts';
import { createAsterHair } from '../human/models/aster/src/hair.ts';
import { ExpressionAtlas } from '../runtime/expression-atlas.ts';
import { exportGlb } from '../modeling/export-glb.ts';

test('long-limbed study restores a short narrow neck without a scarf',()=>{
  const root=createAster();root.updateMatrixWorld(true);
  const size=new Box3().setFromObject(root).getSize(new Vector3());
  assert.equal(root.userData.modelId,'aster');assert.ok(size.y/ASTER.headHeight>3.7&&size.y/ASTER.headHeight<4.4);
  assert.ok(size.z>.4);assert.ok(new Box3().setFromObject(root).min.y>=-.001);
  const neck=new Box3().setFromObject(root.getObjectByName('Neck'));
  assert.ok(!neck.isEmpty());
  assert.equal(root.getObjectByName('Collar'),undefined,'No scarf substituted for the neck');
  const face=new Box3().setFromObject(root.getObjectByName('Face'));
  assert.ok(face.min.y-1.43>.04&&face.min.y-1.43<.08,'A short visible neck above the shoulders');
  assert.ok(neck.max.y>=face.min.y&&neck.min.y<1.43);
  assert.ok(neck.getSize(new Vector3()).x<face.getSize(new Vector3()).x*.27);
  for(const side of ['Left','Right']) {
    const at=name=>root.getObjectByName(side+name).getWorldPosition(new Vector3());
    assert.ok(at('UpperArm').distanceTo(at('Hand'))>.55);
    assert.ok(at('Thigh').distanceTo(at('Foot'))>.75);
    assert.equal(root.getObjectByName(side+'Forearm').parent.name,side+'UpperArm');
    assert.equal(root.getObjectByName(side+'Shin').parent.name,side+'Thigh');
  }
});
test('smaller, narrower face leaves most of the head silhouette to the hair',()=>{
  const root=createAster(),face=new Box3().setFromObject(root.getObjectByName('Face'));
  const hair=new Box3().setFromObject(root.getObjectByName('Hair'));
  const f=face.getSize(new Vector3()),h=hair.getSize(new Vector3());
  assert.ok(f.x<.43&&f.y<.39,'Face shrinks in both width and height');
  assert.ok(f.x/h.x<.61,'Hair frames a distinctly smaller face');
  assert.ok(f.x*f.y/(h.x*h.y)<.40,'Bounding-area proxy; visible coverage also needs screenshots');
});
test('independent hair has crown, side and rear volume around the unchanged head',()=>{
  const root=createAster(),head=root.getObjectByName('HeadSkin'),face=root.getObjectByName('Face'),hair=root.getObjectByName('Hair');
  const skullBounds=new Box3().setFromObject(head),hairBounds=new Box3().setFromObject(hair);
  assert.ok(hairBounds.max.x-skullBounds.max.x>.06,'Side hair is not a painted-on skull shell');
  assert.ok(skullBounds.min.z-hairBounds.min.z>.07,'Rear hair has independent thickness');
  assert.ok(hairBounds.max.y-skullBounds.max.y>.10,'Crown has its own volume');
  const before=face.geometry.attributes.position.array.slice();
  hair.scale.setScalar(1.1);hair.removeFromParent();
  assert.deepEqual(face.geometry.attributes.position.array,before);
  assert.ok(new Box3().setFromObject(head).equals(skullBounds));
});
test('front-designed face keeps the eye beds shallow while nose, cheek and chin define the profile',()=>{
  const rows=ASTER_FACE.rows;
  // The two eye beds are frontal; the nose is a restrained, separate center vertex.
  const eye=rows[3];assert.ok(Math.abs(eye[1][2]-eye[2][2])<.012);
  assert.ok(eye[3][2]-eye[2][2]>.008&&eye[3][2]-eye[2][2]<.03);
  assert.ok(rows[2][3][2]>rows[0][3][2]+.07);
  assert.ok(rows[2][2][2]>rows[2][0][2]+.035);
  const root=createAster(),face=root.getObjectByName('Face'),hair=root.getObjectByName('Hair');
  assert.equal(hair.parent,root,'glTF skin is a root mesh');
  assert.equal(face.parent,hair.skeleton.bones[0].parent);assert.notEqual(face.geometry,hair.geometry);
  const p=face.geometry.attributes.position.array.slice(),controller=new ExpressionAtlas(face);
  for(const name of controller.names){controller.set(name);assert.deepEqual(face.geometry.attributes.position.array,p);}
  assert.equal(controller.names.length,6);
});
test('arm and leg vertices follow elbow and knee bones without moving the torso',()=>{
  const root=createAster(),skin=root.getObjectByName('Body'),g=skin.geometry;
  const sample=bone=>Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>{
    const index=ASTER_BONES.findIndex(b=>b.name===bone);
    return g.attributes.skinIndex.getX(i)===index&&g.attributes.skinWeight.getX(i)>.99;
  });
  const before=i=>skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(g.attributes.position,i));
  const forearm=sample('LeftForearm'),shin=sample('LeftShin'),body=sample('Chest');
  assert.ok([forearm,shin,body].every(Number.isInteger));
  const a=before(forearm),b=before(shin),c=before(body);
  root.getObjectByName('LeftForearm').rotation.x=-.6;root.getObjectByName('LeftShin').rotation.x=.7;
  root.updateMatrixWorld(true);
  assert.ok(a.distanceTo(before(forearm))>.03);assert.ok(b.distanceTo(before(shin))>.03);
  assert.ok(c.distanceTo(before(body))<1e-8);
});
test('new model is compact, finite, nondegenerate and exports reproducibly',async()=>{
  const root=createAster();let triangles=0;
  root.traverse(n=>{if(!n.isMesh)return;const g=n.geometry,p=g.attributes.position,t=new Triangle();
    triangles+=g.index.count/3;
    for(let i=0;i<g.index.count;i+=3){[t.a,t.b,t.c].forEach((v,k)=>v.fromBufferAttribute(p,g.index.getX(i+k)));assert.ok(t.getArea()>1e-9);}
  });
  assert.ok(triangles<=ASTER.triangleBudget);
  const bytes=await readFile(new URL('../human/models/aster/output/aster.glb',import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(root)));assert.ok(bytes.length<ASTER.byteBudget);
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
});
test('head and hair export as independent, matching-origin GLBs',async()=>{
  const head=new Group();head.name='AsterHead';const {face,skull}=createAsterHead();head.add(face,skull);
  for(const [name,part] of [['aster-head',head],['aster-hair',createAsterHair()]]) {
    const bytes=await readFile(assetUrl(`parts/${name}.glb`));
    assert.deepEqual(bytes,Buffer.from(await exportGlb(part)));
    const result=await validator.validateBytes(new Uint8Array(bytes));
    assert.equal(result.issues.numErrors,0);assert.equal(result.issues.numWarnings,0);
  }
});
