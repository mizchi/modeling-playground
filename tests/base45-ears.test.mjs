import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { createBase45Topology } from '../models/base45.mjs';
import { createLumi } from '../models/lumi.mjs';
import { validateBaseTopology } from '../contracts/base-topology.mjs';

test('small mirrored ears are connected quads with a rim and shallow bowl, weighted to Head',()=>{
  const d=createBase45Topology();validateBaseTopology(d);
  for(const [side,name] of [[1,'Left'],[-1,'Right']]) {
    const faces=d.faces.filter((_,i)=>d.regions[i].startsWith(`Head.${name}Ear`));
    assert.equal(faces.length,15);
    const ids=[...new Set(faces.flat())],points=ids.map(i=>d.positions[i]);
    assert.ok(faces.every(f=>f.length===4));
    assert.ok(Math.max(...points.map(p=>side*p[0]))>.26);
    assert.ok(Math.max(...points.map(p=>side*p[0]))<.29);
    assert.ok(Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))<.14);
    for(const i of ids)assert.deepEqual(d.weights[i],[['Head',1]]);
    const outside=new Set(d.faces.flatMap((f,i)=>d.regions[i].startsWith(`Head.${name}Ear`)?[]:f));
    assert.equal(ids.filter(i=>outside.has(i)).length,6,'Ear must share its root with the skull');
    const rimIds=new Set(d.faces.flatMap((f,i)=>d.regions[i]===`Head.${name}Ear.Rim`?f:[]));
    const depths=[...rimIds].map(i=>d.positions[i][2]);
    assert.ok(Math.max(...depths)-Math.min(...depths)>.07,'Ear plane must turn toward the side, not be a flat front-facing plate');
  }
  assert.ok(d.positions.length<=666&&d.faces.length<=664,'Ear detail must remain local');
});

test('LUMI exposes both ears through its short hair from front, quarter and side',()=>{
  const root=createLumi();root.updateMatrixWorld(true);
  const body=root.getObjectByName('BaseBody'),hair=root.getObjectByName('Hair');
  for(const side of [-1,1])for(const yaw of [0,40,90]) {
    const a=side*yaw*Math.PI/180,direction=new Vector3(Math.sin(a),0,Math.cos(a));
    const target=new Vector3(side*.256,1.945,.018),origin=target.clone().add(direction);
    const hit=new Raycaster(origin,direction.negate()).intersectObjects([body,hair],false)[0];
    assert.ok(hit?.object===body,`Ear hidden at side ${side}, yaw ${yaw}`);
    assert.ok(hit.point.x*side>.235,'The visible skin must be the ear, not the cheek');
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
