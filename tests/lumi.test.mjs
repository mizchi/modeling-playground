import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import validator from 'gltf-validator';
import { readFile } from 'node:fs/promises';
import { createBase45, createBase45Topology } from '../models/base45.mjs';
import { createLumi } from '../models/lumi.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';
import { createLumiTexture, lumiFaceUV, LUMI_EYE_CENTER_X } from '../models/lumi-texture.mjs';
import { LUMI_FRINGE, lumiForeheadZ } from '../models/lumi-hair-definition.mjs';
import { lumiCapFaces } from '../models/lumi-cap.mjs';

test('scalp LOD keeps one open rim without cracks when skull-only columns and dome rows are omitted',()=>{
  const data=createBase45Topology(),before=structuredClone(data),faces=lumiCapFaces(data),edges=new Map();
  for(const f of faces){
    assert.equal(f.length,4);
    for(const tri of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]){
      const[a,b,c]=tri.map(i=>new Vector3(...data.positions[i]));
      assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-7);
    }
    f.forEach((a,i)=>{const b=f[(i+1)%4],key=[a,b].sort((x,y)=>x-y).join();const list=edges.get(key)??[];list.push([a,b]);edges.set(key,list);});
  }
  const rim=new Map();
  for(const e of edges.values()){
    assert.ok(e.length===1||e.length===2);
    if(e.length===2)assert.deepEqual(e[0],e[1].toReversed(),'Shared edges must face opposite ways');
    else{assert.ok(!rim.has(e[0][0]));rim.set(...e[0]);}
  }
  const first=rim.keys().next().value,seen=new Set();let id=first;
  do{assert.ok(rim.has(id)&&!seen.has(id));seen.add(id);id=rim.get(id);}while(id!==first);
  assert.equal(seen.size,rim.size,'Only the intended lower opening remains');
  assert.deepEqual(data,before);assert.equal(createLumi().getObjectByName('Hair').geometry.index.count/3,710);
});

test('simplified fringe uses five broad locks without secondary root overlays',()=>{
  assert.equal(LUMI_FRINGE.length,5);
  const hair=createLumi().getObjectByName('Hair');
  assert.ok(hair.geometry.index.count/3<=720);
});

test('fringe ridges stay shallow above the shared hair envelope',()=>{
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  let maxRelief=-Infinity;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),surface=lumiForeheadZ(x,y);
    if(y>2.12&&y<2.28&&Math.abs(x)<.145&&z>.15&&surface!==undefined)maxRelief=Math.max(maxRelief,z-surface);
  }
  assert.ok(maxRelief>.01&&maxRelief<.026,`Hair ridge is too inflated: ${maxRelief}`);
});

test('five fringe locks share ordered boundaries instead of crossing each other',()=>{
  for(let row=0;row<4;row++)for(let i=1;i<LUMI_FRINGE.length;i++) {
    const left=LUMI_FRINGE[i-1],right=LUMI_FRINGE[i];
    const a=left.rows[row],b=right.rows[row];
    assert.equal(a[1],b[1],'Adjacent guides must share the same height');
    assert.ok(Math.abs(a[0]+left.width*a[3]-(b[0]-right.width*b[3]))<1e-8,'Fringe borders must meet without overlap or a gap');
  }
});

test('painted irises have tonal depth and small specular highlights',()=>{
  const {data,width}=createLumiTexture().image;
  for(const side of [-1,1]) {
    const [u,v]=lumiFaceUV([side*LUMI_EYE_CENTER_X,1.932]);
    const colors=new Set();let shine=0;
    for(let dy=-13;dy<=13;dy++)for(let dx=-12;dx<=12;dx++) {
      if((dx/12)**2+(dy/13)**2>1)continue;
      const i=(Math.round(v*width+dy)*width+Math.round(u*width+dx))*4;
      const rgb=[...data.slice(i,i+3)];colors.add(rgb.join(','));
      if(rgb.every(c=>c>240))shine++;
    }
    assert.ok(colors.size>24,'Iris should have a gradient, not two flat bands');
    assert.ok(shine>3&&shine<100,'Keep readable glints without washing out the iris');
  }
});

test('eye spacing is slightly tighter and the mouth has a readable stroke',()=>{
  const {data,width}=createLumiTexture().image;
  const pixel=(x,y)=>{
    const [u,v]=lumiFaceUV([x,y]),i=(Math.round(v*width)*width+Math.round(u*width))*4;
    return [...data.slice(i,i+3)];
  };
  for(const side of [-1,1]) {
    const c=pixel(side*.092,1.935);
    assert.ok(c[0]<60&&c[1]<90&&c[2]<100,'Pupil center must move inward with the iris');
  }
  let mouthPixels=0;
  for(let y=1.805;y<=1.825;y+=.48/256)for(let x=-.025;x<=.026;x+=.48/256) {
    const c=pixel(x,y);if(c[0]<165&&c[1]<120&&c[2]<115)mouthPixels++;
  }
  assert.ok(mouthPixels>=30&&mouthPixels<90,`Mouth stroke should be readable but restrained: ${mouthPixels}`);
});

test('LUMI inherits the current BASE-45 positions, normals, weights and body rig',()=>{
  const base=createBase45().getObjectByName('BaseBody'),root=createLumi(),body=root.getObjectByName('BaseBody');
  for(const [i,source] of body.userData.sourceVertices.entries())for(const name of ['position','normal','skinIndex','skinWeight']) {
    const a=body.geometry.attributes[name],b=base.geometry.attributes[name];
    for(let k=0;k<a.itemSize;k++)assert.equal(a.array[i*a.itemSize+k],b.array[source*b.itemSize+k]);
  }
  assert.equal(body.skeleton.bones.length,22);
  assert.ok(body.material.map);assert.ok(body.geometry.attributes.uv);
  assert.equal(root.getObjectByName('LumiHairAnchor').parent.name,'HairSocket');
  assert.equal(root.getObjectByName('Hair').parent,root);
  const unchanged=createBase45().getObjectByName('BaseBody');assert.equal(unchanged.material.map,null);
});

test('independent fitted short hair has a cap, layered locks and a rigged ahoge',()=>{
  const root=createLumi(),hair=root.getObjectByName('Hair'),g=hair.geometry;
  assert.ok(hair.isSkinnedMesh);assert.ok(hair.skeleton.bones.some(b=>b.name==='LumiAhogeTip'));
  // Side/back overlap is now explicit geometry, rather than long flat sheets.
  assert.ok(g.index.count/3<=720,'Simplified hair including loose cheek strands must stay within 720 triangles');
  assert.ok(Math.min(...Array.from({length:g.attributes.position.count},(_,i)=>g.attributes.position.getY(i)))>=1.75,'Short cut must leave the neck exposed');
  assert.ok(hair.userData.capClearance>=.012);
  const target=hair.skeleton.bones.find(b=>b.name==='LumiSideLeftMid'),joint=hair.skeleton.bones.indexOf(target);
  const sample=Array.from({length:g.attributes.position.count},(_,i)=>i).find(i=>g.attributes.skinIndex.getX(i)===joint);
  assert.ok(Number.isInteger(sample));root.updateMatrixWorld(true);
  const at=()=>hair.applyBoneTransform(sample,new Vector3().fromBufferAttribute(g.attributes.position,sample));
  const before=at();target.rotation.x=.3;root.updateMatrixWorld(true);assert.ok(before.distanceTo(at())>.005);
  for(let i=0;i<g.attributes.position.count;i++)assert.ok(Number.isFinite(g.attributes.position.getX(i)));
});

test('simplified hair preserves the approved multi-angle envelope',()=>{
  // Support distances from cd08a51, excluding the independently rigged ahoge.
  const reference=[.27553,.3392,.34903,.32974,.32974,.32974,.33495,.32786,.32786,.32786,.34903,.3392,
    .31883,.33956,.37214,.35306,.35306,.35306,.35396,.35217,.35217,.35217,.34981,.33129,
    .33111,.35035,.36428,.32334,.31661,.32308,.32767,.32308,.31973,.32334,.3616,.35035];
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  let sample=0;
  for(const pitch of [-30,0,30])for(let yaw=0;yaw<360;yaw+=30) {
    const a=yaw*Math.PI/180,b=pitch*Math.PI/180;
    const direction=new Vector3(Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b));
    let extent=-Infinity;
    for(let i=0;i<p.count;i++) {
      const v=new Vector3().fromBufferAttribute(p,i);if(v.y>2.32)continue;
      extent=Math.max(extent,v.sub(new Vector3(0,2.04,0)).dot(direction));
    }
    const delta=extent-reference[sample++];
    // The requested flatter fringe may recede slightly; never enlarge the
    // approved outline, and keep the original side/back tolerance unchanged.
    const shrink=yaw<=30||yaw>=330?.035:.025;
    assert.ok(delta> -shrink&&delta<.025,`Envelope changed at yaw ${yaw}, pitch ${pitch}: ${extent}`);
  }
});

test('hair uses a subtle opaque flow texture instead of alternating palette stripes',()=>{
  const hair=createLumi().getObjectByName('Hair'),g=hair.geometry,texture=hair.material.map;
  assert.ok(texture,'Hair needs its own embedded texture');
  assert.equal(hair.material.vertexColors,false);
  assert.equal(hair.material.transparent,false);
  assert.equal(g.attributes.uv.count,g.attributes.position.count);
  for(const n of g.attributes.uv.array)assert.ok(Number.isFinite(n)&&n>=0&&n<=1);
  const {data,width,height}=texture.image;
  assert.ok(width<=128&&height<=128);
  const luma=[];
  for(let i=0;i<data.length;i+=4) {
    assert.equal(data[i+3],255);
    luma.push(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);
  }
  const range=Math.max(...luma)-Math.min(...luma);
  assert.ok(range>10&&range<38,`Texture contrast must remain restrained: ${range}`);
});

test('side and back hair retain coverage except for the intentional ear and temple openings',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  const hair=root.getObjectByName('Hair'),body=root.getObjectByName('BaseBody'),data=createBase45Topology();
  for(const y of [2.00,2.10,2.20])for(const pitch of [-25,0,25])for(let yaw=60;yaw<=300;yaw+=10) {
    const a=yaw*Math.PI/180,b=pitch*Math.PI/180;
    const direction=new Vector3(Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b));
    const origin=new Vector3(0,y,0).add(direction);
    const ray=new Raycaster(origin,direction.negate()),hit=ray.intersectObject(hair,false)[0];
    if(hit&&hit.distance<.96)continue;
    const skin=ray.intersectObject(body,false)[0],region=data.regions[Math.floor(skin?.faceIndex/2)];
    const earWindow=(yaw<=100||yaw>=260)&&skin&&skin.point.y>1.88&&skin.point.y<2.01&&Math.abs(skin.point.x)>.175
      &&/^Head\.(Left|Right)(Contour|Ear\.(Root|Rim|Bowl))$/.test(region);
    assert.ok(earWindow,`Unintended hair gap at y ${y}, yaw ${yaw}, pitch ${pitch}`);
  }
});

test('hair volume surrounds the face in width and depth, not just a front silhouette',()=>{
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  const band=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i)).filter(v=>v.y>2.03&&v.y<2.17);
  const span=axis=>Math.max(...band.map(v=>v[axis]))-Math.min(...band.map(v=>v[axis]));
  assert.ok(span('x')>.57,`Side/crown volume too narrow: ${span('x')}`);
  assert.ok(span('z')>.50,`Front/back volume too shallow: ${span('z')}`);
});

test('short front temple locks remain close to the face',()=>{
  const root=createLumi(),hair=root.getObjectByName('Hair');root.updateMatrixWorld(true);
  for(const side of [-1,1])for(const [x,y] of [[.225,1.98]]) {
    const ray=new Raycaster(new Vector3(side*x,y,1),new Vector3(0,0,-1));
    const hit=ray.intersectObject(hair,false)[0];
    assert.ok(hit&&hit.point.z>.15&&hit.point.z<.26,`Missing close face-framing hair at ${side*x},${y}`);
  }
});

test('hair silhouette is fuller above the temples and tapers below the cheeks',()=>{
  const p=createLumi().getObjectByName('Hair').geometry.attributes.position;
  const width=(low,high)=>{
    const xs=Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)>=low&&p.getY(i)<=high).map(i=>p.getX(i));
    return Math.max(...xs)-Math.min(...xs);
  };
  const crown=width(2.06,2.26),lower=width(1.70,1.86);
  assert.ok(lower<crown*.86,`Lower sides should taper: ${lower} vs crown ${crown}`);
  assert.ok(lower>.38,'Keep room for the accepted head, rather than scaling the entire hair down');
});

test('swept fringe leaves both painted pupils visible from the front',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-LUMI_EYE_CENTER_X,LUMI_EYE_CENTER_X]) {
    const ray=new Raycaster(new Vector3(x,1.932,1),new Vector3(0,0,-1));
    const hit=ray.intersectObjects([root.getObjectByName('Hair'),root.getObjectByName('BaseBody')],false)[0];
    assert.equal(hit?.object.name,'BaseBody');
  }
});

test('lower forehead remains visible below the broad front locks',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.10,.06]) {
    const ray=new Raycaster(new Vector3(x,1.975,1),new Vector3(0,0,-1));
    const hit=ray.intersectObjects([root.getObjectByName('Hair'),root.getObjectByName('BaseBody')],false)[0];
    assert.equal(hit?.object.name,'BaseBody',`Fringe gap at ${x} must reveal the forehead`);
  }
});

test('broad front locks cover the former straight forehead boundary',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.10,.06]) {
    const hit=new Raycaster(new Vector3(x,2.055,1),new Vector3(0,0,-1)).intersectObject(root.getObjectByName('Hair'),false)[0];
    assert.ok(hit&&hit.point.z>.255,`Missing raised fringe lock over the old boundary at ${x}`);
  }
});

test('five-lock fringe hides the support rim between the center and right sweep',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [.045,.060,.075,.09]) {
    const hit=new Raycaster(new Vector3(x,2.105,1),new Vector3(0,0,-1)).intersectObject(root.getObjectByName('Hair'),false)[0];
    assert.ok(hit&&hit.point.z>.26,`Missing raised fringe at ${x}: ${hit?.point.z}`);
    // Support faces sample one constant texel; swept locks have varying UVs.
    const uv=hit.object.geometry.attributes.uv;
    assert.ok([hit.face.a,hit.face.b,hit.face.c].some(i=>uv.getX(i)!==.5||uv.getY(i)!==.5),`Support, not a lock, is visible at ${x}`);
  }
});

test('upper fringe keeps its own convex volume instead of sinking into the skull cap',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  for(const x of [-.08,.08]) {
    const hit=new Raycaster(new Vector3(x,2.20,1),new Vector3(0,0,-1)).intersectObject(root.getObjectByName('Hair'),false)[0];
    assert.ok(hit&&hit.point.z>.20&&hit.point.z<.29,`Upper fringe depth at ${x}: ${hit?.point.z}`);
  }
});

test('LUMI is deterministic and exports an embedded face texture and both skeletons',async()=>{
  const bytes=Buffer.from(await exportGlb(createLumi()));
  const report=await validator.validateBytes(new Uint8Array(bytes));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(json.skins.length,2);assert.equal(json.images.length,2);
  assert.ok(json.images.every(image=>Number.isInteger(image.bufferView)));
  assert.deepEqual(bytes,await readFile(new URL('../output/lumi.glb',import.meta.url)));
  assert.ok(bytes.length<180*1024);
});
