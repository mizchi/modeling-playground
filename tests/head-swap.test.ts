import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clipMesh,neckLoop,bridgeLoops} from '../human/parts/head-swap.ts';
import {readStaticGlb,writeStaticGlb} from '../human/parts/static-glb.ts';
import {readFileSync,existsSync} from 'node:fs';
import validator from 'gltf-validator';
import {GlbEditor} from '../modeling/glb-editor.ts';

const vertex=(x,y,z)=>({position:[x,y,z],normal:[0,0,1],uv:[x,y]});
test('plane cut preserves retained vertices and interpolates only intersected triangles',()=>{
  const source={vertices:[vertex(-1,0,0),vertex(1,0,0),vertex(0,2,0)],indices:[0,1,2]};
  const result=clipMesh(source,1,'below');
  assert.equal(result.mesh.indices.length,6);
  assert.equal(result.segments.length,1);
  assert.deepEqual(result.mesh.vertices[0],source.vertices[0]);
  assert.ok(result.mesh.vertices.every(v=>v.position[1]<=1));
  for(const v of result.mesh.vertices.filter(v=>v.position[1]===1))assert.equal(v.uv[1],1);
  assert.equal(clipMesh(source,3,'below').mesh.indices.length,3);
  assert.equal(clipMesh(source,-1,'below').mesh.indices.length,0);
});
test('neck extraction rejects ambiguous disconnected cuts and bridges unequal loops',()=>{
  const loop=[vertex(-1,0,-1),vertex(1,0,-1),vertex(1,0,1),vertex(-1,0,1)];
  const segments=loop.map((v,i)=>[v,loop[(i+1)%4]]);
  assert.equal(neckLoop(segments).length,4);
  assert.throws(()=>neckLoop(segments.slice(1)),/closed/);
  const upper=Array.from({length:6},(_,i)=>vertex(Math.sin(i*Math.PI/3),1,Math.cos(i*Math.PI/3)));
  const mesh=bridgeLoops(loop,upper);
  assert.equal(mesh.indices.length/3,10);
  assert.ok(mesh.vertices.every(v=>v.position.every(Number.isFinite)));
  mesh.vertices[0].uv=[99,99];
  assert.ok(loop.every(v=>v.uv[0]!==99),'Bridge edits must not mutate retained body UVs');
});

test('static adapter preserves body attributes and encoded texture on roundtrip',async()=>{
  const path='human/models/lumi-tripo/output/lumi-tripo.glb';
  if(!existsSync(path))return;
  const asset=readStaticGlb(readFileSync(path));
  const cut=clipMesh(asset.mesh,.25,'below');
  assert.equal(neckLoop(cut.segments).length,30);
  const bytes=writeStaticGlb([{name:'PreservedBody',mesh:cut.mesh,texture:0}],[asset]);
  const again=readStaticGlb(bytes);
  assert.deepEqual(again.image,asset.image);
  assert.deepEqual(again.material,asset.material);
  assert.deepEqual(again.mesh.indices,cut.mesh.indices);
  for(let i=0;i<again.mesh.vertices.length;i++){
    for(const attribute of ['position','normal','uv']){
      const actual=again.mesh.vertices[i][attribute],expected=cut.mesh.vertices[i][attribute];
      for(let j=0;j<actual.length;j++)assert.ok(Math.abs(actual[j]-expected[j])<1e-6);
    }
  }
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0);assert.equal(report.issues.numWarnings,0);
});

test('delivered derivative retains body texture and has a closed geometric neck interface',async()=>{
  const path='human/models/lumi-tripo-girl/output/lumi-tripo-girl.glb';
  if(!existsSync(path))return;
  const bytes=readFileSync(path),editor=new GlbEditor(bytes);
  const original=readStaticGlb(readFileSync('human/models/lumi-tripo/output/lumi-tripo.glb'));
  const preserved=clipMesh(original.mesh,.25,'below').mesh;
  const primitive=editor.doc.meshes[0].primitives[0];
  const positions=editor.read(primitive.attributes.POSITION),uv=editor.read(primitive.attributes.TEXCOORD_0);
  assert.equal(positions.length,preserved.vertices.length);
  for(let i=0;i<positions.length;i++){
    assert.deepEqual(positions[i],preserved.vertices[i].position.map(Math.fround));
    assert.deepEqual(uv[i],preserved.vertices[i].uv.map(Math.fround));
  }
  assert.deepEqual(editor.doc.materials[0],original.material);
  const imageView=editor.doc.bufferViews[editor.doc.images[0].bufferView];
  assert.deepEqual(editor.binary.subarray(imageView.byteOffset,imageView.byteOffset+imageView.byteLength),original.image);
  const edges=new Map();
  const key=p=>p.map(n=>Math.round(n*1e6)).join(',');
  for(const mesh of editor.doc.meshes)for(const p of mesh.primitives){
    const points=editor.read(p.attributes.POSITION),indices=editor.read(p.indices).flat();
    for(let i=0;i<indices.length;i+=3){
      const tri=indices.slice(i,i+3).map(id=>points[id]);
      for(let j=0;j<3;j++){
        const a=tri[j],b=tri[(j+1)%3];
        if([a[1],b[1]].every(y=>y>=.25-1e-7&&y<=.256+1e-7)){
          const edge=[key(a),key(b)].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
        }
      }
    }
  }
  assert.ok(edges.size>20);
  assert.ok([...edges.values()].every(count=>count===2),'Every neck interface edge must have two incident triangles');
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0);assert.equal(report.issues.numWarnings,0);
});
