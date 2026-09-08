import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Triangle, Vector3 } from 'three';
import validator from 'gltf-validator';
import { createFes256 } from '../human/models/fes256/src/model.ts';
import { FES256, EXPRESSION_NAMES } from '../human/models/fes256/src/definition.ts';
import { createFes256Atlas, FES256_ATLAS } from '../human/models/fes256/src/texture.ts';
import { ExpressionAtlas } from '../runtime/expression-atlas.ts';
import { encodeRgbaPng } from '../modeling/png.ts';
import { exportGlb } from '../modeling/export-glb.ts';

const meshes=root=>{const result=[];root.traverse(n=>{if(n.isMesh)result.push(n);});return result;};
function skinDepth(head,x,y) {
  const g=head.geometry,p=g.attributes.position;
  let depth=-Infinity;
  for(let i=0;i<g.index.count;i+=3) {
    const [a,b,c]=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,g.index.getX(i+k)));
    const determinant=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(determinant)<1e-10)continue;
    const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/determinant;
    const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/determinant,w=1-u-v;
    if(Math.min(u,v,w)>=-1e-6)depth=Math.max(depth,u*a.z+v*b.z+w*c.z);
  }
  return depth;
}
test('face has connected brow, nose, cheek and chin depth rather than one flat front',()=>{
  const head=createFes256().getObjectByName('HeadSkin');
  const nose=skinDepth(head,0,1.32-1.05),eye=skinDepth(head,.115,1.32-1.05);
  const cheek=skinDepth(head,.25,1.25-1.05),chin=skinDepth(head,0,1.11-1.05);
  assert.ok(nose-eye>.012&&nose-eye<.04,'A small anime nose, not a flat face or a prominent bridge');
  assert.ok(eye-cheek>.05,'Cheek turns back toward the temple');
  assert.ok(nose-chin>.10,'Muzzle and chin do not share one vertical plane');
});
test('head skin, replaceable hair and facial marks are independent meshes on one head anchor',()=>{
  const root=createFes256(),head=root.getObjectByName('HeadSkin'),hair=root.getObjectByName('Hair'),face=root.getObjectByName('Face');
  assert.ok(head?.isMesh&&hair?.isMesh);
  assert.notEqual(head.geometry,hair.geometry);
  assert.equal(head.parent,root.getObjectByName('Head'));
  assert.equal(hair.parent,head.parent);assert.equal(face.parent,head.parent);
  const original=head.geometry.attributes.position.array.slice();
  hair.visible=false;hair.scale.setScalar(.8);
  assert.deepEqual(head.geometry.attributes.position.array,original);
  root.updateMatrixWorld(true);
  const before=face.localToWorld(new Vector3().fromBufferAttribute(face.geometry.attributes.position,0));
  head.parent.rotation.y=.3;root.updateMatrixWorld(true);
  assert.equal(face.parent,head.parent);
  assert.ok(new Box3().setFromObject(head).getSize(new Vector3()).z>.4);
  const after=face.localToWorld(new Vector3().fromBufferAttribute(face.geometry.attributes.position,0));
  assert.ok(before.distanceTo(after)>.02,'Facial vertices follow the actual head rotation');
});
test('FES-inspired character stays compact with the relaxed visual-quality budget',()=>{
  const root=createFes256(),parts=meshes(root);
  assert.ok(parts.length>=2);
  const triangles=parts.reduce((n,m)=>n+m.geometry.index.count/3,0);
  assert.ok(triangles<=FES256.triangleBudget,`${triangles} triangles includes face and internal caps`);
  assert.ok(triangles>180,'Budget is spent on a volumetric character');
  for(const mesh of parts) {
    if(mesh.name==='Face')assert.ok(mesh.material.map);
    else assert.equal(mesh.material.map,null);
    const g=mesh.geometry,p=g.attributes.position,t=new Triangle();
    for(let i=0;i<g.index.count;i+=3) {
      [t.a,t.b,t.c].forEach((v,k)=>v.fromBufferAttribute(p,g.index.getX(i+k)));
      assert.ok(t.getArea()>1e-9,'No degenerate base triangles');
    }
  }
  root.updateMatrixWorld(true);
  const size=new Box3().setFromObject(root).getSize(new Vector3());
  assert.ok(size.y/FES256.headHeight>=2.7&&size.y/FES256.headHeight<=3.3);
  assert.ok(size.z>.45,'Head and coat have real side-view depth');
  assert.ok(new Box3().setFromObject(root).min.y>=-.002);
});

function verifyExpressions(root) {
  const face=root.getObjectByName('Face');
  assert.equal(face.geometry.morphAttributes.position,undefined,'Expression changes do not deform the face');
  const controller=new ExpressionAtlas(face),g=face.geometry,p=new Vector3();
  assert.deepEqual(controller.names,['Neutral',...EXPRESSION_NAMES]);
  const base=g.attributes.position.array.slice(),initialUV=g.attributes.uv.array.slice(),states=[];
  for(const name of ['Neutral',...EXPRESSION_NAMES]) {
    controller.set(name);assert.deepEqual(g.attributes.position.array,base);
    states.push(Array.from(g.attributes.uv.array).join(','));
    for(let i=0;i<g.attributes.position.count;i++) {
      p.fromBufferAttribute(g.attributes.position,i);
      const depth=skinDepth(root.getObjectByName('HeadSkin'),p.x,p.y);
      assert.ok(p.z-depth>.001&&p.z-depth<.015,`${name} follows the actual facial surface`);
    }
  }
  assert.equal(new Set(states).size,6);controller.set('Neutral');
  g.attributes.uv.array.forEach((v,i)=>assert.ok(Math.abs(v-initialUV[i])<1e-6));
  assert.throws(()=>controller.set('unknown'),/Unknown expression/);
  controller.set('Wink');const rebound=new ExpressionAtlas(face);assert.equal(rebound.name,'Wink');
  rebound.set('Neutral');g.attributes.uv.array.forEach((v,i)=>assert.ok(Math.abs(v-initialUV[i])<1e-6));
}
test('texture expressions change UVs but keep the face shape and attachment intact',()=>verifyExpressions(createFes256()));
test('six atlas tiles have unique pixels and export deterministically',async()=>{
  const a=createFes256Atlas(),b=createFes256Atlas();
  assert.deepEqual(a.image.data,b.image.data);assert.equal(a.image.width,256);
  const frames=FES256_ATLAS.tiles.map(({rect:[x,y,w,h]})=>{
    const bytes=[];for(let j=y;j<y+h;j++)bytes.push(...a.image.data.slice((j*256+x)*4,(j*256+x+w)*4));
    assert.ok(bytes.some((v,i)=>i%4===3&&v===255));return bytes.join(',');
  });
  assert.equal(new Set(frames).size,6);
  assert.deepEqual(await readFile(new URL('../human/models/fes256/output/fes256-expressions.png',import.meta.url)),encodeRgbaPng(a.image));
});

test('FES GLB embeds the atlas and expression contract deterministically without external images',async()=>{
  const bytes=await readFile(new URL('../human/models/fes256/output/fes256.glb',import.meta.url));
  assert.deepEqual(bytes,Buffer.from(await exportGlb(createFes256())));
  assert.ok(bytes.length<FES256.byteBudget);
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.images.length,1);assert.equal(json.images[0].mimeType,'image/png');assert.ok(!json.images[0].uri);
  assert.deepEqual(json.nodes.find(n=>n.name==='Face').extras.expressionAtlas,FES256_ATLAS);
  assert.ok(!json.animations,'Texture selection is an explicit runtime contract, not a fake morph animation');
});
