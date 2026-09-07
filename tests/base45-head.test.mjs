import test from 'node:test';
import assert from 'node:assert/strict';
import { createBase45Topology } from '../models/base45.mjs';
import { base45FaceDepth } from '../models/base45-eyes.mjs';
import { contourTurn } from '../models/base45-contour.mjs';
import { Vector3 } from 'three';

test('cheek turn continues the facial slope instead of restarting with a flat lip',()=>{
  const previous=[.10,1.90,.174],a=[.18,1.92,.153],b=[.21,1.94,0];
  assert.deepEqual(contourTurn(previous,a,b,0),a);
  assert.deepEqual(contourTurn(previous,a,b,1),b);
  const start=contourTurn(previous,a,b,1e-5);
  assert.ok(Math.abs((start[2]-a[2])/(start[0]-a[0])-(a[2]-previous[2])/(a[0]-previous[0]))<.001);
  let last=a;
  for(let i=1;i<=100;i++) {
    const p=contourTurn(previous,a,b,i/100);
    assert.ok(p[0]>=last[0]&&p[0]<=b[0]&&p[2]<=last[2]&&p[2]>=b[2]);last=p;
  }
});

const headPoints=()=>{
  const data=createBase45Topology();
  const indices=new Set(data.faces.flatMap((f,i)=>data.regions[i].startsWith('Head')?f:[]));
  return [...indices].map(i=>data.positions[i]);
};
test('egg-shaped skull has a broad upper mass and compact tapered lower face',()=>{
  const p=headPoints(),width=(lo,hi)=>2*Math.max(...p.filter(v=>v[1]>=lo&&v[1]<=hi).map(v=>Math.abs(v[0])));
  assert.ok(width(1.97,2.07)>=.43&&width(1.97,2.07)<=.445,'An egg contour, not a head widened into a ball');
  assert.ok(width(1.75,1.84)<width(1.97,2.07)*.7,'Short lower face tapers into the chin');
  assert.ok(width(2.18,2.20)<width(1.97,2.07)*.60,'Crown rounds inward');
  assert.ok(Math.abs(Math.max(...p.map(v=>v[1]))-2.20)<1e-6,'Shorten the head, not widen it again');
});
test('crown closes as a shallow dome and continues the contour columns',()=>{
  const data=createBase45Topology(),p=data.positions;
  const apex=p.findIndex(v=>Math.abs(v[1]-2.20)<1e-6);
  const capFaces=data.faces.filter(f=>f.includes(apex));
  const rim=[...new Set(capFaces.flat())].filter(i=>i!==apex).map(i=>p[i]);
  assert.equal(rim.length,16);
  assert.ok(rim.every(v=>2.20-v[1]<=.02),'Upper rim sits close enough to the apex to remove the peak');
  assert.ok(Math.max(...rim.map(v=>Math.abs(v[0])))<.09,'Do not flatten a broad disk across the top');
  assert.equal(capFaces.length,8,'Only the four contour columns extend across the crown');
});
test('eye loops remain a shallow continuous texture bed, not a socket or eyeball',()=>{
  const d=createBase45Topology();
  const points=region=>[...new Set(d.faces.flatMap((f,i)=>d.regions[i]===region?f:[]))].map(i=>d.positions[i]);
  for(const side of ['Left','Right']) {
    for(const region of ['Orbit','Lid'])assert.equal(d.regions.filter(r=>r===`Head.${side}${region}`).length,10);
    const surface=points(`Head.${side}Eye`);
    assert.equal(surface.length,11);assert.equal(d.regions.filter(r=>r===`Head.${side}Eye`).length,5);
    const center=surface.find(p=>Math.abs(Math.abs(p[0])-.102)<1e-6&&Math.abs(p[1]-1.932)<1e-6);
    assert.ok(center,'Eye looks forward from a defined center');
    const edge=surface.filter(p=>p!==center);
    const average=edge.reduce((s,p)=>s+p[2],0)/edge.length;
    assert.ok(Math.abs(center[2]-average)<.005,'No independent eyeball mound or deep center');
    const lidTop=edge.find(p=>Math.abs(Math.abs(p[0])-.102)<1e-6&&p[1]>center[1]);
    const orbit=points(`Head.${side}Orbit`),brow=orbit.find(p=>Math.abs(Math.abs(p[0])-.102)<1e-6&&Math.abs(p[1]-1.982)<1e-6);
    assert.ok(Math.abs(brow[2]-lidTop[2])<.004,'The upper eye border does not form a trench');
  }
  assert.equal(d.regions.filter(r=>/Head\.(Left|Right)(Orbit|Lid|Eye)$/.test(r)).length,50,'Eye detail stays local');
});
test('continuous contour strips support both cheek-to-temple turns down through the jaw',()=>{
  const d=createBase45Topology();
  for(const side of ['Left','Right']) {
    const f=d.faces.filter((_,i)=>d.regions[i]===`Head.${side}Contour`);
    assert.equal(f.length,29,'Three strips across nine rows and two neck transition quads');
    const points=[...new Set(f.flat())].map(i=>d.positions[i]);
    assert.ok(Math.min(...points.map(v=>v[1]))<1.79,'Contour continues into the chin/neck junction');
    assert.ok(Math.max(...points.map(v=>v[1]))>2.18,'Contour continues over the temple into the crown');
    const cheek=points.filter(v=>v[1]>1.94&&v[1]<1.98&&v[2]>=-.001);
    assert.ok(cheek.length>=4,'Side turn is not a single flat polygon');
  }
  assert.ok(d.positions.length<=628);assert.ok(d.faces.length<=626);
});
test('lower cheek does not form a sharp shelf and the underside has a curved transition row',()=>{
  const d=createBase45Topology();
  const normal=f=>{
    const p=f.map(i=>new Vector3(...d.positions[i]));
    return p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
  };
  const edges=new Map();
  d.faces.forEach((f,i)=>f.forEach((a,j)=>{
    const b=f[(j+1)%f.length],key=[a,b].sort((a,b)=>a-b).join(':');
    const e=edges.get(key)??{a,b,faces:[]};e.faces.push(i);edges.set(key,e);
  }));
  const seams=[...edges.values()].filter(e=>e.faces.some(i=>d.regions[i]==='Head.LeftOrbit')&&e.faces.some(i=>d.regions[i]==='Head')
    &&[e.a,e.b].every(i=>d.positions[i][1]<1.86&&d.positions[i][0]>.07));
  assert.equal(seams.length,1);
  for(const e of seams)assert.ok(normal(d.faces[e.faces[0]]).angleTo(normal(d.faces[e.faces[1]]))<Math.PI/6,'Under-eye cheek seam should not turn by 57 degrees');
  const underside=new Set(d.faces.flatMap((f,i)=>d.regions[i]==='Head.UnderJaw'?f:[]));
  assert.ok([...underside].some(i=>{const [x,y,z]=d.positions[i];return Math.abs(x)<1e-8&&y>1.75&&y<1.78&&z>.05&&z<.12;}),'A support row rounds the long chin-to-throat span');
});
test('forehead and lower cheek have shape-supporting rows instead of long straight spans',()=>{
  const p=headPoints();
  const frontCenter=p.filter(v=>Math.abs(v[0])<1e-8&&v[2]>.1);
  assert.ok(frontCenter.some(v=>v[1]>2.025&&v[1]<2.07),'Support the arc halfway above the brow');
  assert.ok(frontCenter.some(v=>v[1]>1.80&&v[1]<1.82),'Support the cheek-to-chin turn below the mouth row');
});
test('profile separates brow, shallow eye bed, nose, mouth and chin from a recessed neck',()=>{
  const p=headPoints(),nearest=(x,y)=>p.reduce((best,v)=>Math.hypot(v[0]-x,v[1]-y)<Math.hypot(best[0]-x,best[1]-y)?v:best);
  // Texture eyes need a shallow transition, not a modeled eyelid trench.
  const eye=nearest(.102,1.972),brow=nearest(.102,1.982),nose=nearest(0,1.89),chin=nearest(0,1.785);
  assert.ok(Math.abs(brow[2]-eye[2])<.004,'Shallow brow-to-eye transition');
  assert.ok(nose[2]-eye[2]>.025&&nose[2]-eye[2]<.05,'Restrained nose relief against a texture-friendly face');
  assert.ok(nose[2]-chin[2]>.025&&nose[2]-chin[2]<.08,'Restrained facial projection, not a muzzle');
  const d=createBase45Topology(),neck=new Set(d.faces.flatMap((f,i)=>d.regions[i]==='Neck'?f:[]));
  const upper=[...neck].map(i=>d.positions[i]).filter(v=>v[1]>1.74&&v[2]<.03);
  assert.ok(upper.length>=12,'Inspect the actual upper attachment, not an empty slice');
  assert.ok(chin[2]-Math.max(...upper.map(v=>v[2]))>.09,'Neck attaches behind the chin');
});
test('mandibular corners support a curved underside and the throat attaches above and behind the chin',()=>{
  const d=createBase45Topology(),points=region=>[...new Set(d.faces.flatMap((f,i)=>d.regions[i]===region?f:[]))].map(i=>d.positions[i]);
  const underside=points('Head.UnderJaw');
  assert.ok(underside.length>=20,'The chin-to-neck underside is a separate authoring region');
  const chin=underside.find(v=>Math.abs(v[0])<1e-8&&v[2]>.13);
  const throat=underside.find(v=>Math.abs(v[0])<1e-8&&v[2]>0&&v[2]<.03);
  assert.ok(chin&&throat);assert.ok(throat[1]-chin[1]>=.015,'Under-chin surface rises back into the throat instead of a horizontal plate');
  for(const side of [-1,1]) {
    assert.ok(underside.some(v=>v[0]*side>.12&&v[1]>1.79&&v[1]<1.82&&v[2]<0&&v[2]>-.05),'The jaw corner has width and sits behind the cheek, not at the tiny neck radius');
  }
});
test('outer forehead and under-eye cheek do not step backward from the texture bed',()=>{
  const p=headPoints(),nearest=(x,y)=>p.reduce((a,b)=>Math.hypot(b[0]-x,b[1]-y)<Math.hypot(a[0]-x,a[1]-y)?b:a);
  const brow=nearest(.218*Math.sqrt(3)/2,1.9975),forehead=nearest(.192*Math.sqrt(3)/2,2.1025);
  assert.ok(brow[2]-forehead[2]<.035,'Avoid the abrupt cosine-shaped retreat above the temple');
  const cheek=nearest(.161*Math.sqrt(3)/2,1.845);
  assert.ok(Math.abs(cheek[2]-base45FaceDepth(cheek[0],cheek[1]))<1e-6,'The cheek continues the same shallow surface');
  const nose=nearest(0,1.89),eye=nearest(.102,1.932);
  assert.ok(nose[2]-eye[2]<.04,'Avoid the long triangular wedge below the inner eyes');
});
