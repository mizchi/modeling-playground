import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { createBase45Topology } from '../human/models/base45/src/model.ts';
import { createLumi } from '../human/models/lumi/src/model.ts';
import { validateBaseTopology } from '../contracts/base-topology.ts';

test('posterior ear roots attach to a narrow skull strip rather than the rearward 30-degree head column',()=>{
  const d=createBase45Topology();
  for(const name of ['Left','Right']){
    const roots=d.faces.filter((_,i)=>d.regions[i]===`Head.${name}Ear.Root`);
    const points=[...new Set(roots.flat())].map(i=>d.positions[i]);
    assert.ok(Math.min(...points.map(p=>p[2]))>-.045,'No root extends toward the rear skull');
    assert.ok(d.regions.some(r=>r===`Head.${name}Postauricular`),'Skull flow continues behind the ear independently');
  }
});
test('ears extrude from a compact attachment instead of pulling broad skull panels into a wedge',()=>{
  const d=createBase45Topology();
  for(const name of ['Left','Right']){
    assert.ok(!d.regions.includes(`Head.${name}Ear.Attachment`),'Do not restore the long inset annulus');
    const attachment=d.faces.filter((f,i)=>d.regions[i]===`Head.${name}Postauricular`&&f.every(v=>d.positions[v][1]>1.87&&d.positions[v][1]<1.98));
    assert.ok(attachment.length>=4,'Skull strips continue behind the ear');
    for(const f of attachment){
      const [a,b,c,e]=f.map(i=>new Vector3(...d.positions[i]));
      const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const m=c.clone().sub(a).cross(e.clone().sub(a)).normalize();
      const side=name==='Left'?1:-1;
      assert.ok(n.x*side>.65&&m.x*side>.65,'The attachment stays on the outward skull surface');
      assert.ok(n.angleTo(m)<Math.PI/5,'No folded attachment quad');
    }
    const roots=d.faces.filter((_,i)=>d.regions[i]===`Head.${name}Ear.Root`);
    for(const f of roots)for(let k=0;k<4;k++){
      const a=d.positions[f[k]],b=d.positions[f[(k+1)%4]];
      assert.ok(Math.hypot(...a.map((v,j)=>v-b[j]))<.11,'Ear root must not span the rear skull');
    }
  }
});

test('small mirrored ears are connected quads with a rim and shallow bowl, weighted to Head',()=>{
  const d=createBase45Topology();validateBaseTopology(d);
  for(const [side,name] of [[1,'Left'],[-1,'Right']]) {
    const faces=d.faces.filter((_,i)=>d.regions[i].startsWith(`Head.${name}Ear`));
    assert.equal(faces.length,15);
    const ids=[...new Set(faces.flat())],points=ids.map(i=>d.positions[i]);
    assert.ok(faces.every(f=>f.length===4));
    assert.ok(Math.max(...points.map(p=>side*p[0]))>.25);
    assert.ok(Math.max(...points.map(p=>side*p[0]))<.27,'Keep the ear closer to the skull');
    assert.ok(Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))<.14);
    for(const i of ids)assert.deepEqual(d.weights[i],[['Head',1]]);
    const outside=new Set(d.faces.flatMap((f,i)=>d.regions[i].startsWith(`Head.${name}Ear`)?[]:f));
    assert.equal(ids.filter(i=>outside.has(i)).length,6,'Ear must share its root with the skull');
    const rimIds=new Set(d.faces.flatMap((f,i)=>d.regions[i]===`Head.${name}Ear.Rim`?f:[]));
    const depths=[...rimIds].map(i=>d.positions[i][2]);
    assert.ok(Math.max(...depths)-Math.min(...depths)>.07,'Ear plane must turn toward the side, not be a flat front-facing plate');
  }
  assert.ok(d.positions.length<=722&&d.faces.length<=720,'Local posterior columns and one dome shoulder row, no global subdivision');
});

test('LUMI exposes both ears through its short hair from front, quarter and side',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  const body=root.getObjectByName('BaseBody'),hair=root.getObjectByName('Hair');
  const regions=createBase45Topology().regions;
  for(const side of [-1,1])for(const yaw of [0,40,90]) {
    const a=side*yaw*Math.PI/180,direction=new Vector3(Math.sin(a),0,Math.cos(a));
    const target=new Vector3(side*.245,1.945,.003),origin=target.clone().add(direction);
    const hit=new Raycaster(origin,direction.negate()).intersectObjects([body,hair],false)[0];
    assert.ok(hit?.object===body,`Ear hidden at side ${side}, yaw ${yaw}`);
    assert.match(regions[Math.floor(hit.faceIndex/2)],/Ear\.(Root|Rim|Bowl)$/,'The visible skin must be the ear, not the cheek');
  }
});

test('ear-front locks cover the side cheek with visible profile width',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  const body=root.getObjectByName('BaseBody'),hair=root.getObjectByName('Hair');
  for(const side of [-1,1])for(const y of [1.975,1.94,1.90,1.86])for(const z of [.085,.105,.125]) {
    const hit=new Raycaster(new Vector3(side,y,z),new Vector3(-side,0,0)).intersectObjects([body,hair],false)[0];
    assert.ok(hit?.object===hair,`Ear-front cheek uncovered in profile: side ${side}, y ${y}, z ${z}`);
    assert.ok(hit.point.x*side<.25,'Lock should hug the cheek, not widen the head');
  }
});
