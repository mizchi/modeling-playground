import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Vector3, Triangle, Raycaster, NearestFilter, SRGBColorSpace } from 'three';
import validator from 'gltf-validator';
import { createAshley } from '../models/ashley.mjs';
import { createAshleyAtlas, ASHLEY_TILES } from '../models/ashley-texture.mjs';
import { FACE_ANATOMY } from '../models/ashley-face.mjs';
import { atlasUV } from '../modeling/pixel-atlas.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

// Probe the rendered surface by UV, not by the old cross-section vertex IDs.
// Feature loops deliberately move vertices without changing the UV landmarks.
function facialSurfacePoint(geometry,x,y) {
  const {position,uv}=geometry.attributes;
  const target=new Vector3(...atlasUV(ASHLEY_TILES.face,(x+1)/2,
    (y-FACE_ANATOMY.bottom)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom),256),0);
  for(let i=0;i<geometry.index.count;i+=3) {
    const ids=[0,1,2].map(j=>geometry.index.getX(i+j));
    const corners=ids.map(id=>new Vector3(uv.getX(id),uv.getY(id),0)),weights=new Vector3();
    if(!Triangle.getBarycoord(target,...corners,weights)||Math.min(...weights)<-1e-5)continue;
    return ids.reduce((point,id,j)=>point.addScaledVector(new Vector3().fromBufferAttribute(position,id),weights.getComponent(j)),new Vector3());
  }
  assert.fail(`Missing facial surface ${x}, ${y}`);
}

test('pixel atlas is deterministic, bounded, and uses nearest-filtered sRGB texels',()=>{
  const a=createAshleyAtlas(),b=createAshleyAtlas();
  assert.equal(a.image.width,256);assert.equal(a.image.height,256);
  assert.deepEqual(a.image.data,b.image.data);
  assert.equal(a.magFilter,NearestFilter);assert.equal(a.minFilter,NearestFilter);
  assert.equal(a.colorSpace,SRGBColorSpace);assert.equal(a.generateMipmaps,false);
  for(const tile of Object.values(ASHLEY_TILES))for(const u of [0,1])for(const v of [0,1]) {
    const uv=atlasUV(tile,u,v,256);
    assert.ok(uv.every(n=>n>0&&n<1));
  }
  assert.throws(()=>atlasUV([-1,0,64,64],0,0,256),/atlas/i);
  assert.throws(()=>atlasUV([0,0,64,64],2,0,256),/atlas/i);
});

test('eyes retain a visible dark iris beneath the heavy upper lid',()=>{
  const data=createAshleyAtlas().image.data;
  const pixel=(x,y)=>Array.from(data.slice((y*256+x)*4,(y*256+x)*4+3));
  const pixelY=y=>Math.round((FACE_ANATOMY.top-y)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95);
  const eye=pixelY(FACE_ANATOMY.eyeY),brow=pixelY(FACE_ANATOMY.browY);
  for(const x of [29,66]) {
    assert.ok(Math.max(...pixel(x,eye+1))<90,'Iris must occupy the opening, not a white sleepy slit');
    assert.ok(Math.max(...pixel(x,eye-2))<75,'Upper lid must frame the iris');
    assert.ok(Math.max(...pixel(x,brow+1))<95,'Brows sit close to the upper eyelid');
  }
});

test('iris retains its reduced width and centered pupil within the larger eye opening',()=>{
  const data=createAshleyAtlas().image.data;
  const eye=Math.round((FACE_ANATOMY.top-FACE_ANATOMY.eyeY)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95);
  const pixel=x=>Array.from(data.slice(((eye+1)*256+x)*4,((eye+1)*256+x)*4+3));
  for(const mirror of [x=>x,x=>95-x]) {
    const row=Array.from({length:20},(_,i)=>pixel(mirror(18+i)));
    const dark=row.filter(rgb=>['80,82,62','52,54,44'].includes(rgb.join(',')));
    assert.equal(dark.length,7,'Iris plus pupil spans 7 texels instead of 8');
    assert.deepEqual(pixel(mirror(33)),[136,135,113],'Newly exposed sclera stays muted');
    assert.equal(row.filter(rgb=>rgb.join(',')==='52,54,44').length,3,'Pupil width is unchanged');
    assert.deepEqual(pixel(mirror(29)),[52,54,44],'Central pupil stays in place');
  }
});

test('eye opening has a visible lower almond while the upper lid remains dark',()=>{
  const data=createAshleyAtlas().image.data;
  const eye=Math.round((FACE_ANATOMY.top-FACE_ANATOMY.eyeY)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95);
  const rgb=(x,y)=>Array.from(data.slice((y*256+x)*4,(y*256+x)*4+3));
  for(const mirror of [x=>x,x=>95-x]) {
    assert.deepEqual(rgb(mirror(24),eye+3),[136,135,113],'Lower eye opening must not collapse into a slit');
    assert.ok(Math.max(...rgb(mirror(29),eye-2))<75,'Upper eyelid stays strongly defined');
  }
});

test('cheek and jaw keep restrained continuous anatomical volume',()=>{
  const geometry=createAshley().getObjectByName('Face').geometry;
  const pointAt=(x,y)=>facialSurfacePoint(geometry,x,y);
  for(const sign of [-1,1]) {
    const cheek=pointAt(sign*.45,1.712).z,lower=pointAt(sign*.45,FACE_ANATOMY.noseBaseY).z;
    assert.ok(cheek-lower>.001&&cheek-lower<.006,'Cheek is a gentle volume, not a locally extruded ridge');
    assert.ok(pointAt(sign*.45,1.650).z>.094,'Mandible has front-to-back mass, not only a wider outline');
    const middle=pointAt(sign*.45,FACE_ANATOMY.noseTipY).z,socket=pointAt(sign*.45,FACE_ANATOMY.eyeY).z;
    assert.ok(lower<middle&&middle<cheek,'No recessed ring between the lower cheek and cheekbone');
    assert.ok(cheek-socket<.018,'Eye and cheek reconnect without a deep trough');
  }
});

test('lateral cheek flows through a mild hollow into a supported mandibular corner',()=>{
  const geometry=createAshley().getObjectByName('Face').geometry;
  for(const sign of [-1,1]) {
    const sample=y=>facialSurfacePoint(geometry,sign*.78,y);
    const upper=sample(1.712),middle=sample(1.675),jaw=sample(1.650),corner=sample(1.629);
    assert.ok(upper.z-middle.z>.002&&upper.z-middle.z<.007,'Cheek transitions into a shallow hollow, not a flat slab');
    assert.ok(jaw.z-middle.z>.002&&jaw.z-middle.z<.007,'Mandible supports the hollow without a projecting lump');
    assert.ok(corner.y>1.633&&corner.y<1.637,'Jaw corner stays lower before rising toward the ear');
    assert.ok(Math.abs(corner.x)>.069,'Retain jaw-corner mass instead of pinching the lower face');
    const turn=facialSurfacePoint(geometry,sign*.90,1.675);
    assert.ok(turn.z>.025&&turn.z<.031,'Cheek wraps around the side with volume instead of one flat chamfer');
  }
});

test('Ashley has an adult low-poly silhouette, a volumetric head, and distinct swept forelocks',()=>{
  const root=createAshley();root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root);
  assert.ok(bounds.min.y>=-.001);assert.ok(bounds.max.y>1.9&&bounds.max.y<2.2);
  for(const name of ['Head','Face','Hair','ForelockLift','ForelockDrop','ForelockSideSweep','CrownSpikeLeft','CrownSpikeRight',
    'IvoryBib','LeftGauntlet','RightGauntlet','LeftHipPanel','RightHipPanel','LeftBoot','RightBoot'])assert.ok(root.getObjectByName(name),name);
  const head=new Box3().setFromObject(root.getObjectByName('Face')).getSize(new Vector3());
  assert.ok(head.z/head.x>.65,'Face and skull need profile depth, not a face card');
  const torso=new Box3().setFromObject(root.getObjectByName('ExposedTorso')).getSize(new Vector3());
  assert.ok(torso.z/torso.x>.59,'Chest and back must have depth from oblique views');
  const upperArm=new Box3().setFromObject(root.getObjectByName('RightUpperArm')).getSize(new Vector3());
  assert.ok(upperArm.z<.182,'Upper arms stay slimmer than the chest and shoulder silhouette');
  const nape=new Box3().setFromObject(root.getObjectByName('HairCap'));
  assert.ok(nape.min.y<1.69,'Hair must taper down to the nape rather than stop like a cap');
  for(const name of ['CrownSpikeLeft','CrownSpikeRight']) {
    const box=new Box3().setFromObject(root.getObjectByName(name));
    assert.ok(box.min.z<-.28,'Long crown locks sweep backward, not upright horns');
  }
  let triangles=0;const maps=new Set();
  root.traverse(o=>{if(!o.isMesh)return;
    const {position,normal,uv}=o.geometry.attributes;
    assert.equal(uv.count,position.count,o.name);assert.ok(normal);
    for(const attribute of [position,normal,uv])assert.ok([...attribute.array].every(Number.isFinite),o.name);
    for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-4,o.name);
    for(const n of uv.array)assert.ok(n>=0&&n<=1,o.name);
    triangles+=(o.geometry.index?.count??position.count)/3;
    assert.ok(o.material.map,o.name);maps.add(o.material.map);
  });
  assert.equal(maps.size,1);assert.ok(triangles>700&&triangles<=3200,`${triangles} triangles`);
});

test('forelocks separate a raised root, a descending fringe and a lateral temple sweep',()=>{
  const root=createAshley(),bounds=name=>{
    const mesh=root.getObjectByName(name);assert.ok(mesh,name);return new Box3().setFromObject(mesh);
  };
  const lift=bounds('ForelockLift'),drop=bounds('ForelockDrop'),sweep=bounds('ForelockSideSweep'),cap=bounds('HairCap');
  assert.ok(lift.max.y>cap.max.y+.015,'Raised root breaks the scalp silhouette');
  assert.ok(lift.max.x-lift.min.x>.05,'Raised root reads as a broad lock rather than a thin wire');
  assert.ok(drop.min.y<1.80&&drop.min.y>1.75,'Descending fringe stops above the eyes');
  assert.ok(drop.min.z>.12,'Fringe lies in front of the forehead');
  assert.ok(sweep.max.x-sweep.min.x>.07&&sweep.max.x>.105,'Lateral lock crosses toward the temple');
  assert.ok(!root.getObjectByName('ForelockZigzag'),'Remove the ambiguous zigzag construction');
  const ray=new Raycaster();
  for(const name of ['ForelockLift','ForelockSideSweep']) {
    const mesh=root.getObjectByName(name),anchor=new Vector3();
    for(let i=0;i<4;i++)anchor.add(new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i));
    anchor.divideScalar(4).applyMatrix4(mesh.matrixWorld);
    ray.set(new Vector3(anchor.x,anchor.y,1),new Vector3(0,0,-1));
    const hit=ray.intersectObject(root.getObjectByName('HairCap'))[0];
    assert.ok(hit&&Math.abs(hit.point.z-anchor.z)<.010,`${name} must grow from the scalp, not float in front of it`);
  }
});

test('textured Ashley exports reproducibly as a self-contained, valid GLB with a PNG atlas',async()=>{
  const bytes=Buffer.from(await exportGlb(createAshley()));
  assert.deepEqual(bytes,await readFile(new URL('../output/ashley.glb',import.meta.url)));
  const report=await validator.validateBytes(bytes,{maxIssues:30});
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));
  assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.images.length,1);assert.equal(json.images[0].mimeType,'image/png');
  assert.ok(Number.isInteger(json.images[0].bufferView));assert.ok(!json.images[0].uri);
  assert.equal(json.samplers[0].magFilter,9728);assert.equal(json.samplers[0].minFilter,9728);
  assert.ok(json.materials.every(m=>m.pbrMetallicRoughness.baseColorTexture));
  assert.ok(json.buffers.every(b=>!b.uri));assert.ok(bytes.length<1024*1024);
});

test('front and back ivory cloth stay outside the torso between their vertices',()=>{
  const root=createAshley();root.updateMatrixWorld(true);
  const torso=root.getObjectByName('ExposedTorso');
  for(const [name,direction] of [['IvoryBib',1],['WhiteBackTriangle',-1]]) {
    const bib=root.getObjectByName(name);
    const geometry=bib.geometry.index?bib.geometry.toNonIndexed():bib.geometry;
    const pos=geometry.attributes.position,ray=new Raycaster();
    for(let i=0;i<pos.count;i+=3) {
      const center=new Vector3();
      for(let j=0;j<3;j++)center.add(new Vector3().fromBufferAttribute(pos,i+j));
      center.divideScalar(3);ray.set(new Vector3(center.x,center.y,direction),new Vector3(0,0,-direction));
      const hit=ray.intersectObject(torso)[0];
      assert.ok(hit,`${name} must cover an actual torso surface`);
      assert.ok(direction*(center.z-hit.point.z)>.001,`${name} intersects torso at ${center.toArray()}`);
    }
  }
});

test('shorts have complete leg coverage and open hems joined to the exposed thighs',()=>{
  const root=createAshley(),ray=new Raycaster(),hem=.673;
  for(const [label,sign] of [['Left',-1],['Right',1]]) {
    const thigh=root.getObjectByName(label+'Thigh'),shorts=root.getObjectByName(label+'Shorts');
    const bounds=new Box3().setFromObject(thigh);
    assert.ok(Math.abs(bounds.max.y-hem)<1e-6,'Hidden upper-thigh skin must end at the hem');
    const edge=root.getObjectByName(label+'ShortsHem');
    assert.ok(edge,'Hem needs an annular cloth edge');
    const edgePoints=Array.from({length:edge.geometry.attributes.position.count},(_,i)=>
      new Vector3().fromBufferAttribute(edge.geometry.attributes.position,i));
    for(const mesh of [thigh,shorts]) {
      const position=mesh.geometry.attributes.position;
      for(let i=0;i<position.count;i++)if(Math.abs(position.getY(i)-hem)<1e-6) {
        const point=new Vector3().fromBufferAttribute(position,i);
        assert.ok(edgePoints.some(other=>other.distanceTo(point)<1e-6),'Skin and cloth both meet the hem without gaps');
      }
    }
    for(const y of [.674,.70,.78,.82,.87,.94,.985]) {
      const t=(y-hem)/(.995-hem),cx=sign*(.192057+(.097-.192057)*t);
      for(let i=0;i<32;i++) {
        const direction=new Vector3(Math.sin(i/32*Math.PI*2),0,Math.cos(i/32*Math.PI*2));
        ray.set(new Vector3(cx,y,-.01).addScaledVector(direction,.4),direction.clone().negate());
        assert.ok(ray.intersectObject(shorts)[0],`${label} shorts have a hole at ${y}, angle ${i}`);
        assert.equal(ray.intersectObject(thigh).length,0,'No skin can poke through the cloth');
      }
    }
    // A trouser opening must not be a disk crossing the leg at the hem.
    ray.set(new Vector3(sign*.192057,.65,-.002586),new Vector3(0,1,0));
    const hit=ray.intersectObject(shorts)[0];
    assert.ok(!hit||hit.point.y>.70,'No bottom cap across the leg opening');
  }
});

test('trouser rise covers the front pelvis with cloth and a surface-fitted ivory tab',()=>{
  const root=createAshley(),pelvis=root.getObjectByName('Pelvis'),tab=root.getObjectByName('IvoryLowerTab');
  const ray=new Raycaster(),tile=ASHLEY_TILES.cloth;
  for(const y of [.89,.91,.94])for(const x of [-.025,0,.025]) {
    ray.set(new Vector3(x,y,1),new Vector3(0,0,-1));
    const hit=ray.intersectObject(pelvis)[0];assert.ok(hit,'Continuous front crotch coverage');
    assert.ok(hit.uv.x>=tile[0]/256&&hit.uv.x<=(tile[0]+tile[2])/256&&
      hit.uv.y>=tile[1]/256&&hit.uv.y<=(tile[1]+tile[3])/256,'Front pelvis must use cloth, not exposed skin');
  }
  const pos=pelvis.geometry.attributes.position;
  const bottom=[];
  for(let i=0;i<pos.count;i++)if(pos.getY(i)<.895)bottom.push(new Vector3().fromBufferAttribute(pos,i));
  assert.ok(Math.max(...bottom.map(p=>Math.abs(p.x)))<.065,'Crotch tapers instead of ending in a wide box');
  assert.ok(Math.max(...bottom.map(p=>p.z))<.065,'Lower crotch turns inward rather than projecting like a pouch');
  const flat=tab.geometry.index?tab.geometry.toNonIndexed():tab.geometry;
  for(let i=0;i<flat.attributes.position.count;i+=3) {
    const center=new Vector3();
    for(let j=0;j<3;j++)center.add(new Vector3().fromBufferAttribute(flat.attributes.position,i+j));
    center.divideScalar(3);ray.set(new Vector3(center.x,center.y,1),new Vector3(0,0,-1));
    const hit=ray.intersectObject(pelvis)[0];assert.ok(hit,'Ivory tab follows the pelvis');
    assert.ok(center.z-hit.point.z>.001&&center.z-hit.point.z<.008,'Tab has only a small surface clearance');
  }
});

test('waist belt clears skin, cloth and lacing all around, with an open center and visible buckle',()=>{
  const root=createAshley(),belt=root.getObjectByName('WaistBelt'),buckle=root.getObjectByName('BeltBuckle');
  const targets=root.getObjectByName('Body').children.filter(o=>o.isMesh&&o!==belt&&o!==buckle);
  const ray=new Raycaster();
  for(const y of [1.045,1.052,1.064,1.076,1.085])for(let i=0;i<96;i++) {
    const direction=new Vector3(Math.sin(i/96*Math.PI*2),0,Math.cos(i/96*Math.PI*2));
    ray.set(new Vector3(0,y,0).addScaledVector(direction,.5),direction.clone().negate());
    const base=ray.intersectObjects(targets,false)[0],hit=ray.intersectObject(belt)[0];
    assert.ok(base&&hit,'Belt wraps the entire waist');
    assert.ok(base.distance-hit.distance>.002,`Belt intersects underlying layers at ${y}, angle ${i}`);
    assert.ok(base.distance-hit.distance<.040,'Belt stays close to the waist');
  }
  ray.set(new Vector3(0,1,0),new Vector3(0,1,0));
  assert.equal(ray.intersectObject(belt).length,0,'Belt edges are annuli, not disks through the torso');
  ray.set(new Vector3(0,1.065,1),new Vector3(0,0,-1));
  assert.ok(ray.intersectObject(buckle)[0].distance<ray.intersectObject(belt)[0].distance-.004,'Buckle stands outside the strap');
  assert.ok(ASHLEY_TILES.waistLeather&&ASHLEY_TILES.waistBuckle,'Strap and buckle use separate atlas regions');
});

test('the swept nape covers the skull instead of exposing a bald patch between locks',()=>{
  const root=createAshley();root.updateMatrixWorld(true);
  const face=root.getObjectByName('Face'),hair=root.getObjectByName('HairCap'),ray=new Raycaster();
  for(const y of [1.71,1.73,1.75,1.77,1.79])for(const x of [-.055,0,.055]) {
    ray.set(new Vector3(x,y,-1),new Vector3(0,0,1));
    const skin=ray.intersectObject(face)[0],cap=ray.intersectObject(hair)[0];
    assert.ok(cap&&skin&&cap.distance<skin.distance-.001,`Uncovered back of skull at ${x}, ${y}`);
  }
});

test('side silhouette has a rising jaw, inclined neck and a restrained S-shaped back',()=>{
  const root=createAshley();root.updateMatrixWorld(true);
  const face=root.getObjectByName('Face').geometry.attributes.position;
  let chin=Infinity,nape=Infinity;
  for(let i=0;i<face.count;i++) {
    if(face.getZ(i)>.07)chin=Math.min(chin,face.getY(i));
    if(face.getZ(i)<-.03)nape=Math.min(nape,face.getY(i));
  }
  assert.ok(nape-chin>.018&&nape-chin<.045,'Mandible rises gently, not as a steep wedge toward the ear');
  const ray=new Raycaster(),torso=root.getObjectByName('ExposedTorso'),neck=root.getObjectByName('Neck');
  const depth=(mesh,y,direction)=>{
    ray.set(new Vector3(0,y,direction),new Vector3(0,0,-direction));
    return ray.intersectObject(mesh)[0].point.z;
  };
  const waist=depth(torso,1.12,-1),chest=depth(torso,1.39,-1),pelvis=depth(torso,1.012,-1);
  assert.ok(depth(torso,1.39,1)>.150,'Chest thickness includes the pectoral front, not just the back');
  assert.ok(chest<waist-.06);assert.ok(pelvis<waist-.025,'Lumbar hollow returns outward at the pelvis');
  const neckCenter=y=>(depth(neck,y,1)+depth(neck,y,-1))/2;
  assert.ok(neckCenter(1.62)>neckCenter(1.546)+.009,'Neck inclines gently toward the head');
});

test('chin has a broad lower plane rather than a pointed triangular tip',()=>{
  const face=createAshley().getObjectByName('Face').geometry.attributes.position;
  const lower=[];
  for(let i=0;i<face.count;i++)if(face.getY(i)<1.633&&face.getZ(i)>.045)lower.push(face.getX(i));
  const width=Math.max(...lower)-Math.min(...lower);
  assert.ok(width>.085&&width<.135,`Lower chin width ${width} must retain a visible flat plane`);
});

test('rear skull is compact without changing the approved face positions or UVs',()=>{
  const root=createAshley(),geometry=root.getObjectByName('Face').geometry,values=[];
  const {position,uv}=geometry.attributes;
  for(let i=0;i<position.count;i++)if(position.getZ(i)>=0)
    values.push(position.getX(i),position.getY(i),position.getZ(i),uv.getX(i),uv.getY(i));
  assert.equal(createHash('sha256').update(JSON.stringify(values)).digest('hex'),
    'a2bb0060aa00089d05dc5d3516360da760b798e8341e80d7d28018537e4fc976','Freeze the approved frontal face');
  const cap=new Box3().setFromObject(root.getObjectByName('HairCap'));
  assert.ok(cap.min.z>-.135,'Rear hair must not swell into a rolled cap');
  const ray=new Raycaster();
  for(const y of [1.73,1.76,1.79,1.82]) {
    ray.set(new Vector3(0,y,-1),new Vector3(0,0,1));
    const skin=ray.intersectObject(root.getObjectByName('Face'))[0],hair=ray.intersectObject(root.getObjectByName('HairCap'))[0];
    assert.ok(skin&&hair&&skin.distance-hair.distance>.001&&skin.distance-hair.distance<.025,'Hair closely covers the occiput');
  }
});

test('halter straps connect the front bib around the neck to the central back strap',()=>{
  const root=createAshley(),body=root.getObjectByName('Body');
  const skin=[root.getObjectByName('ExposedTorso'),root.getObjectByName('Neck')],ray=new Raycaster();
  for(const side of ['Left','Right']) {
    const strap=root.getObjectByName(side+'HalterStrap');assert.ok(strap);
    const g=strap.geometry,p=g.attributes.position;
    const center=row=>new Vector3().fromBufferAttribute(p,row*2).add(new Vector3().fromBufferAttribute(p,row*2+1)).multiplyScalar(.5);
    const start=center(0),end=center(p.count/2-1);
    ray.set(new Vector3(start.x,start.y,1),new Vector3(0,0,-1));
    const bib=ray.intersectObject(root.getObjectByName('IvoryBib'))[0];
    assert.ok(bib&&start.distanceTo(bib.point)<.008,'Strap attaches to the actual front cloth');
    assert.ok(Math.abs(end.x)<.002&&Math.abs(end.y-1.558)<.002&&end.z<-.08,'Both sides meet at the rear junction');
    for(let i=0;i<g.index.count;i+=3) {
      const point=new Vector3();for(let j=0;j<3;j++)point.add(new Vector3().fromBufferAttribute(p,g.index.getX(i+j)));
      point.divideScalar(3);const direction=new Vector3(point.x,0,point.z).normalize();
      ray.set(new Vector3(direction.x,point.y,direction.z),direction.clone().negate());
      const hit=ray.intersectObjects(skin)[0];assert.ok(hit);
      const clearance=point.clone().sub(hit.point).dot(direction);
      assert.ok(clearance>.0005&&clearance<.012,`Strap must follow skin without clipping or floating: ${clearance}`);
    }
  }
  assert.ok(!body.getObjectByName('LeftCrossedNeckStrap'),'Remove the detached rear X');
  const spine=root.getObjectByName('CentralBackStrap0').geometry.attributes.position;
  assert.ok(Math.abs(spine.getY(0)-1.558)<.001,'Central back strap starts at the same junction');
  const junction=new Vector3().fromBufferAttribute(spine,0).add(new Vector3().fromBufferAttribute(spine,1)).multiplyScalar(.5);
  for(const side of ['Left','Right']) {
    const p=root.getObjectByName(side+'HalterStrap').geometry.attributes.position;
    const end=new Vector3().fromBufferAttribute(p,p.count-2).add(new Vector3().fromBufferAttribute(p,p.count-1)).multiplyScalar(.5);
    assert.ok(end.distanceTo(junction)<.005,'Halter and back strap meet geometrically, not only at a named node');
  }
  const tail=root.getObjectByName('CentralBackStrap1').geometry.attributes.position;
  const end=new Vector3().fromBufferAttribute(tail,tail.count-2).add(new Vector3().fromBufferAttribute(tail,tail.count-1)).multiplyScalar(.5);
  ray.set(new Vector3(end.x,end.y,-1),new Vector3(0,0,1));
  const backCloth=ray.intersectObject(root.getObjectByName('WhiteBackTriangle'))[0];
  assert.ok(backCloth&&end.distanceTo(backCloth.point)<.008,'Back strap terminates on the back cloth');
});

test('occipital volume and a supported nape replace the thin head on a pinched neck',()=>{
  const root=createAshley();root.updateMatrixWorld(true);
  const skull=new Box3().setFromObject(root.getObjectByName('Face')).getSize(new Vector3());
  assert.ok(skull.z>.25&&skull.z<.275,'Rear skull is reduced without becoming a flat head');
  const neck=root.getObjectByName('Neck'),torso=root.getObjectByName('ExposedTorso'),ray=new Raycaster();
  const back=(object,y)=>{
    ray.set(new Vector3(0,y,-1),new Vector3(0,0,1));return ray.intersectObject(object)[0].point.z;
  };
  assert.ok(back(neck,1.60)<-.065,'Nape must not pinch forward into a thin stalk');
  assert.ok(Math.abs(back(neck,1.5451)-back(torso,1.5449))<.002,'Neck base and upper back meet without a ledge');
  const normalWidth=new Box3().setFromObject(neck).getSize(new Vector3());
  assert.ok(normalWidth.x<.20,'Neck root flares into the shoulders without an oversized column');
});

test('neck and upper torso share a smoothly shaded boundary instead of overlapping closed caps',()=>{
  const root=createAshley(),neck=root.getObjectByName('Neck').geometry,torso=root.getObjectByName('ExposedTorso').geometry;
  const boundary=geometry=>{
    const {position,normal}=geometry.attributes,result=[];
    for(let i=0;i<position.count;i++)if(Math.abs(position.getY(i)-1.545)<1e-6&&Math.abs(position.getX(i))+Math.abs(position.getZ(i)+.017)>.02)
      result.push({point:new Vector3().fromBufferAttribute(position,i),normal:new Vector3().fromBufferAttribute(normal,i)});
    return result;
  };
  const a=boundary(torso),b=boundary(neck);assert.ok(a.length>=12&&b.length>=12,'Matching neck-root rings');
  for(const vertex of a) {
    const peer=b.find(other=>other.point.distanceTo(vertex.point)<1e-6);
    assert.ok(peer&&vertex.normal.dot(peer.normal)>.999,'Continuous boundary positions and lighting normals');
  }
});

test('recessed eye surfaces face forward rather than wrapping sideways with the cheeks',()=>{
  const geometry=createAshley().getObjectByName('Face').geometry,y=FACE_ANATOMY.eyeY-.003;
  for(const sign of [-1,1]) {
    const center=facialSurfacePoint(geometry,sign*.41,y);
    const inner=facialSurfacePoint(geometry,sign*.25,y),outer=facialSurfacePoint(geometry,sign*.57,y);
    assert.ok(Math.abs(inner.z-outer.z)<.001,'Inner and outer eye have the same depth, not a sideways-sloping eye card');
    assert.ok(center.z>inner.z&&center.z>outer.z,'Visible eye has a small convex surface, not a concave painted socket');
    assert.ok(center.z>.079&&center.z<.083,'Eye is brought forward while remaining beneath the brow');
    const tangent=outer.clone().sub(inner).normalize();
    assert.ok(Math.abs(tangent.z)<.035,'Horizontal eye axis is parallel to the frontal plane');
  }
});

test('eyes have defined sockets without pushing the brow or cheek into a projecting band',()=>{
  const geometry=createAshley().getObjectByName('Face').geometry;
  const zAt=(x,y)=>facialSurfacePoint(geometry,x,y).z;
  for(const sign of [-1,1]) {
    const socket=zAt(sign*.45,FACE_ANATOMY.eyeY);
    const browDepth=zAt(sign*.45,FACE_ANATOMY.browY)-socket;
    assert.ok(socket>.078&&socket<.084,'Ocular surface sits forward of the previous over-deep socket');
    assert.ok(browDepth>.009&&browDepth<.017,`Brow-to-eye transition is defined without a cavern: ${browDepth}`);
    const noseContrast=zAt(0,FACE_ANATOMY.eyeY)-socket;
    assert.ok(noseContrast>.030&&noseContrast<.040,`Nasal root contrast remains proportionate: ${noseContrast}`);
    assert.ok(zAt(sign*.45,FACE_ANATOMY.browY)<.096,'Deepen the socket instead of extruding the brow');
    assert.ok(Math.abs(zAt(sign*.45,1.712)-socket)<.018,'Eye and cheek reconnect without a deep trough');
    const outerDepth=socket-zAt(sign*.78,FACE_ANATOMY.eyeY);
    assert.ok(outerDepth>.018&&outerDepth<.034,'Socket connects to the temple without an inverted hollow');
    assert.ok(Math.abs(zAt(sign*.78,FACE_ANATOMY.browY)-zAt(sign*.78,1.793))<.012,'Brow and lateral forehead connect without a protruding ledge');
    assert.ok(zAt(sign*.20,1.692)>.111,'Raised nose retains substantial side planes');
  }
  const tip=zAt(0,1.692),bridge=zAt(0,1.712),root=zAt(0,1.736);
  assert.ok(tip>.135&&tip<.140,'Nose tip projects moderately, without a beak');
  assert.ok(bridge>.126&&bridge<tip&&root<bridge,'Bridge rises gradually from the nasal root');
});

test('face UV seams share area-weighted normals across cheek, skull and chin',()=>{
  const {position,normal}=createAshley().getObjectByName('Face').geometry.attributes,seen=new Map();
  let duplicates=0;
  for(let i=0;i<position.count;i++) {
    const point=new Vector3().fromBufferAttribute(position,i),n=new Vector3().fromBufferAttribute(normal,i);
    const key=point.toArray().map(v=>Math.round(v*1e6)).join(',');
    if(seen.has(key)) {
      duplicates++;assert.ok(seen.get(key).dot(n)>.99999,'UV separation must not create a lighting seam');
    } else seen.set(key,n);
  }
  assert.ok(duplicates>10,'Exercise actual face-to-skull and chin UV seams');
});

test('angular hairline has defined temple corners and covers the fitted forehead',()=>{
  const root=createAshley(),cap=root.getObjectByName('HairCap'),face=root.getObjectByName('Face');
  const position=cap.geometry.attributes.position;
  assert.ok(position.getY(1)>=position.getY(0)&&position.getY(1)-position.getY(0)<.007,'Shallow central point, not an ambiguous rounded scallop');
  assert.ok(position.getY(2)<1.791,'Temple corner is a distinct descending edge');
  const ray=new Raycaster();
  for(let row=0;row<=8;row++)for(let column=-7;column<=7;column++) {
    const y=1.820+row*.0025,x=column*.010;
    ray.set(new Vector3(x,y,1),new Vector3(0,0,-1));
    const skin=ray.intersectObject(face)[0],hair=ray.intersectObject(cap)[0];
    assert.ok(skin&&hair&&skin.distance-hair.distance>.001,`Forehead pierces hair at ${x}, ${y}`);
  }
  for(const y of [1.805,1.810,1.815])for(const x of [-.085,-.080,.080,.085]) {
    ray.set(new Vector3(x,y,1),new Vector3(0,0,-1));
    const skin=ray.intersectObject(face)[0],hair=ray.intersectObject(cap)[0];
    assert.ok(skin&&hair&&skin.distance-hair.distance>.001,'Temple hairline must not reveal a skin triangle');
  }
});

test('painted eye corners share a level axis instead of a diagonal slit',()=>{
  const data=createAshleyAtlas().image.data;
  const eye=Math.round((FACE_ANATOMY.top-FACE_ANATOMY.eyeY)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95);
  for(const mirror of [x=>x,x=>95-x]) {
    const lidRows=x=>Array.from({length:9},(_,i)=>eye-3+i).filter(y=>
      Array.from(data.slice((y*256+mirror(x))*4,(y*256+mirror(x))*4+3)).join(',')==='65,53,39');
    const outer=lidRows(18),inner=lidRows(38);
    assert.ok(outer.length&&inner.length,'Both eye corners must be defined');
    assert.equal(Math.min(...outer),Math.min(...inner),'Inner and outer corner paint has the same height');
  }
});

test('face is vertically proportioned with restrained cheeks and a retained jaw corner',()=>{
  const root=createAshley(),face=root.getObjectByName('Face'),box=new Box3().setFromObject(face);
  const width=box.max.x-box.min.x,visibleHeight=1.800-box.min.y;
  assert.ok(width>.20&&width<.215,'Cheeks narrow without shrinking the face into a sliver');
  assert.ok(visibleHeight/width>.90,'Visible face is elongated, not a wide inverted triangle');
  const position=face.geometry.attributes.position;
  let jawWidth=0;
  for(let i=0;i<position.count;i++)if(position.getY(i)<1.655)jawWidth=Math.max(jawWidth,Math.abs(position.getX(i))*2);
  assert.ok(jawWidth/width>.81,'Mandibular corner retains width below the narrower cheek');
  const hair=new Box3().setFromObject(root.getObjectByName('HairCap'));
  assert.ok(hair.max.x-hair.min.x<.237,'Hair cap follows the narrowed temples');
});

test('cheek shading uses tonal variation instead of a solid graphic shadow patch',()=>{
  const {data}=createAshleyAtlas().image,colors=new Set();
  for(let y=55;y<60;y++)for(let x=20;x<26;x++)colors.add(data.slice((y*256+x)*4,(y*256+x)*4+3).join(','));
  assert.ok(colors.size>=4,'Painted cheek planes need graded tones');
});
