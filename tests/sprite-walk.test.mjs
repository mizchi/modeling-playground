import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeRgbaPng} from '../scripts/png.mjs';
import { SPEC, DIRECTIONS, PALETTE, sampleWalk, renderFrame, buildSheet, toRgba } from '../sprites/walk.mjs';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('walk is periodic, keeps bone lengths, and alternates contact',()=>{
  assert.deepEqual(sampleWalk(0),sampleWalk(1));
  for(let i=0;i<100;i++) {
    const pose=sampleWalk(i/100);
    for(const side of ['left','right']) {
      const leg=pose[side];
      assert.ok(Math.abs(distance(leg.hip,leg.knee)-SPEC.upperLeg)<1e-8);
      assert.ok(Math.abs(distance(leg.knee,leg.ankle)-SPEC.lowerLeg)<1e-8);
      assert.ok(Math.abs(distance(leg.shoulder,leg.elbow)-SPEC.upperArm)<1e-8);
      assert.ok(Math.abs(distance(leg.elbow,leg.wrist)-SPEC.lowerArm)<1e-8);
      assert.ok(leg.ankle[1]>=SPEC.ankleHeight-1e-9);
      if(leg.contact) assert.equal(leg.ankle[1],SPEC.ankleHeight);
    }
    assert.notEqual(pose.left.contact,pose.right.contact);
  }
});

test('planted feet are stationary in world space, with continuous loop motion',()=>{
  for(const side of ['left','right']) {
    const start=side==='left'?0:0.5;
    const positions=[0.02,0.15,0.3,0.45].map(t=>{
      const phase=start+t;
      return sampleWalk(phase)[side].ankle[2]+phase*SPEC.travelPerCycle;
    });
    assert.ok(Math.max(...positions)-Math.min(...positions)<1e-8);
  }
  const before=sampleWalk(1-1e-5),after=sampleWalk(1e-5);
  for(const side of ['left','right']) assert.ok(distance(before[side].ankle,after[side].ankle)<0.001);
});

test('sprites are deterministic palette indices, bounded, and truly transparent',()=>{
  for(const direction of DIRECTIONS) for(let f=0;f<SPEC.frames;f++) {
    const frame=renderFrame(f/SPEC.frames,direction.id);
    assert.equal(frame.pixels.length,32*48);
    assert.deepEqual(frame,renderFrame(f/SPEC.frames,direction.id));
    let occupied=0;
    frame.pixels.forEach((index,i)=>{
      assert.ok(index>=0&&index<PALETTE.length);
      if(index) {
        occupied++;
        const x=i%32,y=Math.floor(i/32);
        assert.ok(x>0&&x<31&&y>0&&y<47,'silhouette must not be clipped');
      }
    });
    assert.ok(occupied>100);
    const rgba=toRgba(frame);
    for(let i=3;i<rgba.data.length;i+=4) assert.ok(rgba.data[i]===0||rgba.data[i]===255);
  }
});

test('sheet packs eight directions and all phases without changing their pixels',()=>{
  const sheet=buildSheet();
  assert.equal(sheet.width,SPEC.width*SPEC.frames);
  assert.equal(sheet.height,SPEC.height*8);
  for(let row=0;row<8;row++) for(let column=0;column<SPEC.frames;column++) {
    const frame=renderFrame(column/SPEC.frames,DIRECTIONS[row].id);
    for(let y=0;y<48;y++) {
      const start=(row*48+y)*sheet.width+column*32;
      assert.deepEqual(sheet.pixels.slice(start,start+32),frame.pixels.slice(y*32,y*32+32));
    }
  }
  assert.notDeepEqual(renderFrame(.125,'w').pixels,renderFrame(.625,'w').pixels);
  assert.throws(()=>renderFrame(0,'invalid'),/direction/);
  assert.throws(()=>sampleWalk(NaN),/phase/);
});

test('delivered PNGs and pose metadata match the procedural source',()=>{
  for(const [name,colored] of [['debug',true],['neutral',false]]) {
    const bytes=readFileSync(new URL(`../output/sprite-walk-${name}.png`,import.meta.url));
    assert.deepEqual(bytes,encodeRgbaPng(toRgba(buildSheet({colored}))));
  }
  const metadata=JSON.parse(readFileSync(new URL('../output/sprite-walk.json',import.meta.url),'utf8'));
  assert.deepEqual(metadata.palette,PALETTE);
  assert.deepEqual(metadata.rows.map(row=>row.id),DIRECTIONS.map(row=>row.id));
  assert.equal(metadata.frameDurationMs*metadata.columns/1000,SPEC.period);
  metadata.phases.forEach(({phase,pose})=>assert.deepEqual(pose,sampleWalk(phase)));
});
