import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPEC,PROPORTIONS,getRig,artifactNames,DIRECTIONS,PALETTE,sampleWalk,renderFrame,buildSheet,toRgba} from '../sprites/walk.mjs';
import {encodeRgbaPng} from '../scripts/png.mjs';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('8, 4, 3 and 2 heads share stature but retarget their skeleton, not just their head',()=>{
  for(const [id,heads] of [['8head',8],['4head',4],['3head',3],['2head',2]]) {
    const rig=getRig(id);
    close(rig.stature/rig.headHeight,heads);
    close(rig.headCenter+rig.headHeight/2,rig.stature);
    close(rig.stature,1.76);
  }
  assert.ok(getRig('8head').upperLeg>getRig('4head').upperLeg);
  assert.ok(getRig('4head').upperLeg>getRig('3head').upperLeg);
  assert.ok(getRig('3head').upperLeg>getRig('2head').upperLeg);
  assert.ok(getRig('3head').bodyWidth>getRig('8head').bodyWidth);
  assert.throws(()=>getRig('unknown'),/proportion/);
});

test('eight-head pixel skull has one fixed footprint across every direction and phase',()=>{
  let expectedMask;
  for(const {id:direction} of DIRECTIONS) for(let i=0;i<32;i++) {
    const frame=renderFrame(i/32,direction,{proportion:'8head'}),head=frame.head;
    assert.ok(head,'8-head rendering must expose its pixel-anchored head part');
    assert.equal(head.width,4);assert.equal(head.height,5);
    assert.ok(Number.isInteger(head.x)&&Number.isInteger(head.y));
    const mask=Array.from(head.pixels,c=>c!==0);
    if(!expectedMask) expectedMask=mask;
    assert.deepEqual(mask,expectedMask);
    assert.equal(frame.pixels.filter(color=>color>=11&&color<=14).length,16,
      'the actual frame must not contain a second skull or skin-colored neck extension');
    head.pixels.forEach((color,j)=>{
      if(color) assert.equal(frame.pixels[(head.y+Math.floor(j/4))*32+head.x+j%4],color);
    });
    const original=renderFrame(0,direction,{proportion:'8head'}).head;
    assert.deepEqual(head.pixels,original.pixels,'head shading must not flicker during the walk');
  }
});

test('all proportions preserve limb lengths, contact, stride speed and loop continuity',()=>{
  for(const {id} of PROPORTIONS) {
    const rig=getRig(id);
    assert.deepEqual(sampleWalk(0,id),sampleWalk(1,id));
    close(rig.travelPerCycle,2*rig.stride);
    for(let i=0;i<200;i++) {
      const phase=i/200,pose=sampleWalk(phase,id);
      assert.notEqual(pose.left.contact,pose.right.contact);
      close(pose.head[1]+rig.headHeight/2+rig.bounce*Math.cos(4*Math.PI*pose.phase),rig.stature);
      for(const side of ['left','right']) {
        const leg=pose[side];
        close(distance(leg.hip,leg.knee),rig.upperLeg);close(distance(leg.knee,leg.ankle),rig.lowerLeg);
        close(distance(leg.shoulder,leg.elbow),rig.upperArm);close(distance(leg.elbow,leg.wrist),rig.lowerArm);
        assert.ok(leg.ankle[1]>=rig.ankleHeight-1e-8);
        if(leg.contact) close(leg.ankle[1],rig.ankleHeight);
      }
    }
    for(const [side,start] of [['left',0],['right',.5]]) {
      const world=[.01,.14,.3,.49].map(t=>sampleWalk(start+t,id)[side].ankle[2]+(start+t)*rig.travelPerCycle);
      world.forEach(z=>close(z,world[0]));
      assert.ok(distance(sampleWalk(1-1e-5,id)[side].ankle,sampleWalk(1e-5,id)[side].ankle)<.001);
    }
  }
});

test('each proportion fits all 64 frames on the same pixel grid without clipping',()=>{
  for(const {id} of PROPORTIONS) for(const {id:direction} of DIRECTIONS) for(let f=0;f<SPEC.frames;f++) {
    const frame=renderFrame(f/SPEC.frames,direction,{proportion:id});
    assert.equal(frame.width,32);assert.equal(frame.height,48);
    assert.deepEqual(frame,renderFrame(f/SPEC.frames,direction,{proportion:id}));
    let count=0;
    frame.pixels.forEach((color,i)=>{
      assert.ok(color<PALETTE.length);
      if(color) {count++;assert.ok(i%32>0&&i%32<31&&Math.floor(i/32)>0&&Math.floor(i/32)<47);}
    });
    assert.ok(count>100);
  }
  for(const id of ['8head','3head','2head']) assert.notDeepEqual(renderFrame(0,'s',{proportion:id}).pixels,renderFrame(0,'s',{proportion:'4head'}).pixels);
});

test('all proportion exports match their source, including retargeted pose metadata',()=>{
  for(const {id} of PROPORTIONS) {
    const paths=artifactNames(id),rig=getRig(id);
    for(const [key,colored] of [['debug',true],['neutral',false]]) {
      assert.deepEqual(readFileSync(new URL(`../output/${paths[key]}`,import.meta.url)),
        encodeRgbaPng(toRgba(buildSheet({proportion:id,colored}))));
    }
    const metadata=JSON.parse(readFileSync(new URL(`../output/${paths.metadata}`,import.meta.url),'utf8'));
    assert.equal(metadata.proportion.id,id);close(metadata.source.travelPerCycle,rig.travelPerCycle);
    metadata.phases.forEach(({phase,pose})=>assert.deepEqual(pose,sampleWalk(phase,id)));
  }
});
