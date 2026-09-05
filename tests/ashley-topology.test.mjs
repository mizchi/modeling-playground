import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaceTopology } from '../models/ashley-topology.mjs';
import { FACE_ANATOMY, facialPoint } from '../models/ashley-face.mjs';
import { createAshley } from '../models/ashley.mjs';

test('facial feature loops replace grid cells with a connected, non-overlapping UV surface',()=>{
  const {points,triangles,quads,features}=createFaceTopology();
  assert.deepEqual(features.map(f=>f.name),['leftEye','rightEye','mouth']);
  assert.equal(new Set(triangles.flat()).size,points.length,'No orphan grid vertices');
  const edges=new Map();let area=0;
  for(const ids of triangles) {
    const [a,b,c]=ids.map(i=>points[i]);
    const twiceArea=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    assert.ok(twiceArea>1e-10,'No inverted or zero-area UV triangles');area+=twiceArea/2;
    for(let i=0;i<3;i++) {
      const edge=[ids[i],ids[(i+1)%3]].sort((a,b)=>a-b).join(',');
      edges.set(edge,(edges.get(edge)??0)+1);
    }
  }
  assert.ok(Math.abs(area-2*(FACE_ANATOMY.top-FACE_ANATOMY.bottom))<1e-9,'Exactly one covering of the face UV rectangle');
  for(const [edge,count] of edges) {
    const [a,b]=edge.split(',').map(i=>points[Number(i)]);
    const boundary=(a[0]===b[0]&&Math.abs(a[0])===1)||
      (a[1]===b[1]&&[FACE_ANATOMY.bottom,FACE_ANATOMY.top].includes(a[1]));
    assert.equal(count,boundary?1:2,'No cracks or extra faces on patch seams');
  }
  for(const feature of features) {
    assert.equal(feature.loops.length,2,'A feature has both an outer anatomical loop and an inner contour');
    for(const loop of feature.loops) {
      assert.ok(loop.length>=10);assert.equal(new Set(loop).size,loop.length);
      for(let i=0;i<loop.length;i++) {
        const a=loop[i],b=loop[(i+1)%loop.length];
        assert.equal(edges.get([a,b].sort((a,b)=>a-b).join(',')),2,'Loop is an actual shared mesh edge');
      }
    }
    const [outer,inner]=feature.loops;
    for(let i=0;i<outer.length;i++)assert.ok(quads.some(q=>
      [outer[i],outer[(i+1)%outer.length],inner[i],inner[(i+1)%inner.length]].every(id=>q.includes(id))),
    'Quad strips follow the feature, not overlaid disconnected rings');
  }
});

test('rebuilt head remains an oriented closed manifold after welding UV seams',()=>{
  const geometry=createAshley().getObjectByName('Face').geometry,{position}=geometry.attributes;
  const keys=Array.from({length:position.count},(_,i)=>[position.getX(i),position.getY(i),position.getZ(i)]
    .map(v=>Math.round(v*1e6)).join(','));
  const edges=new Map(),vertices=new Set();
  for(let i=0;i<geometry.index.count;i+=3) {
    const ids=[0,1,2].map(j=>keys[geometry.index.getX(i+j)]);
    assert.equal(new Set(ids).size,3);
    for(let j=0;j<3;j++) {
      const a=ids[j],b=ids[(j+1)%3],key=[a,b].sort().join('|');vertices.add(a);
      const edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
    }
  }
  for(const edge of edges.values()) {assert.equal(edge.count,2);assert.equal(edge.direction,0);}
  assert.equal(vertices.size-edges.size+geometry.index.count/3,2,'Closed genus-zero head');
  const topology=createFaceTopology();
  for(const feature of topology.features)for(const loop of feature.loops)for(let i=0;i<loop.length;i++) {
    const endpoints=[loop[i],loop[(i+1)%loop.length]].map(id=>facialPoint(...topology.points[id])
      .map(v=>Math.round(Math.fround(v)*1e6)).join(','));
    assert.ok(edges.has(endpoints.sort().join('|')),'Authored feature loops must exist in the actual Face mesh');
  }
});
