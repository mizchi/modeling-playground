import test from 'node:test';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';
import { createBase45, createBase45Topology } from '../models/base45.mjs';
import { createBase45Inspection, faceCheckUV } from '../models/base45-inspection.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';
import { readFile } from 'node:fs/promises';

test('inspection is an exact crop with unchanged source positions and normals',()=>{
  const data=createBase45Topology(),original=createBase45().getObjectByName('BaseBody').geometry;
  for(const surface of ['clay','eyes','grid']) {
    const root=createBase45Inspection({surface}),mesh=root.getObjectByName('HeadInspection'),g=mesh.geometry;
    const source=mesh.userData.sourceVertices;
    assert.equal(g.attributes.position.count,source.length);
    source.forEach((v,i)=>{
      assert.deepEqual([...g.attributes.position.array.slice(i*3,i*3+3)],[...original.attributes.position.array.slice(v*3,v*3+3)]);
      assert.deepEqual([...g.attributes.normal.array.slice(i*3,i*3+3)],[...original.attributes.normal.array.slice(v*3,v*3+3)]);
    });
    const selected=data.faces.filter((_,i)=>data.regions[i].startsWith('Head')||data.regions[i]==='Neck');
    assert.deepEqual(mesh.userData.quadTopology.faces.map(f=>f.map(v=>source[v])),selected);
  }
});

test('diagnostic UVs have uniform frontal scale and paint only the face, never the rear skull',()=>{
  const mesh=createBase45Inspection({surface:'eyes'}).getObjectByName('HeadInspection'),g=mesh.geometry;
  assert.equal(g.attributes.uv.count,g.attributes.position.count);
  const left=faceCheckUV([-.102,1.932,0]),right=faceCheckUV([.102,1.932,0]);
  assert.ok(Math.abs(left[0]+right[0]-1)<1e-9);assert.equal(left[1],right[1]);
  assert.ok(Math.abs((faceCheckUV([.01,1.932,0])[0]-.5)-(faceCheckUV([0,1.922,0])[1]-left[1]))<1e-9);
  const painted=mesh.userData.quadTopology.faces.filter((_,i)=>mesh.userData.paintedFaces[i]);
  assert.ok(painted.length>=50);
  for(const face of painted)for(const vertex of face) {
    assert.ok(g.attributes.position.getZ(vertex)>.09,'Rear/side scalp must not repeat the eyes');
  }
  for(const surface of ['eyes','grid']) {
    const texture=createBase45Inspection({surface}).getObjectByName('HeadInspection').material.map;
    assert.equal(texture.image.width,256);assert.equal(texture.image.height,256);
    assert.ok(texture.image.data.every((v,i)=>i%4!==3||v===255));
  }
  assert.throws(()=>createBase45Inspection({surface:'unknown'}),/surface/);
});

test('painted face triangles have no folds in the frontal projection and blank islands cannot repeat an eye',()=>{
  const mesh=createBase45Inspection({surface:'eyes'}).getObjectByName('HeadInspection'),g=mesh.geometry;
  for(const [i,face] of mesh.userData.quadTopology.faces.entries()) {
    if(!mesh.userData.paintedFaces[i]) {
      for(const v of face) {
        assert.ok(Math.abs(g.attributes.uv.getX(v)-.01)<1e-6);
        assert.ok(Math.abs(g.attributes.uv.getY(v)-.01)<1e-6);
      }
      continue;
    }
    for(const ids of [[face[0],face[1],face[2]],[face[0],face[2],face[3]]]) {
      const [a,b,c]=ids.map(v=>[g.attributes.position.getX(v),g.attributes.position.getY(v)]);
      assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>1e-8,'No reversed or collapsed painted triangles');
    }
  }
});

test('face check exports reproducibly with an embedded texture and matches the delivered GLB',async()=>{
  const bytes=await exportGlb(createBase45Inspection({surface:'eyes'}));
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const buffer=Buffer.from(bytes),json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
  assert.equal(json.images.length,1);assert.ok(Number.isInteger(json.images[0].bufferView));
  assert.equal(json.images[0].uri,undefined);
  assert.deepEqual(buffer,await readFile(new URL('../output/base45-face-check.glb',import.meta.url)));
});
