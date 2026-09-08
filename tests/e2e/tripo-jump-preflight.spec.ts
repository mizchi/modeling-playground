import {test,expect} from '@playwright/test';
import {existsSync,readFileSync} from 'node:fs';

test('existing Tripo geometry and HY jump are readable inputs, not a completed retarget',async({page})=>{
  const model='human/models/lumi-tripo/output/lumi-tripo.glb';
  test.skip(!existsSync(model)||!existsSync('motion/output/jump-001/motion.fbx'),'Optional generated inputs; no paid requests.');
  const bytes=readFileSync(model),doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  expect(doc.meshes.length).toBeGreaterThan(0);
  // This file is the immutable unrigged source. Rigged derivatives must be separate.
  expect(doc.skins??[]).toHaveLength(0);
  await page.goto('/');
  const report=await page.evaluate(async()=>{
    // Execute in a real browser: this FBX contains images that require DOM APIs.
    const {FBXLoader}=await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const response=await fetch('/motion/output/jump-001/motion.fbx');
    if(!response.ok)throw Error('Missing jump FBX');
    const source=new FBXLoader().parse(await response.arrayBuffer(),''),names=new Set<string>();
    source.traverse(object=>{if(object.isBone)names.add(object.name);});
    return {bones:names.size,clips:source.animations.map(clip=>({duration:clip.duration,tracks:clip.tracks.length,
      finite:clip.tracks.every(track=>track.times.every(Number.isFinite)&&track.values.every(Number.isFinite)),
      root:clip.tracks.some(track=>track.name==='Pelvis.position')})),
      required:['Pelvis','Spine1','Spine2','Spine3','Neck','Head','L_Hip','L_Knee','L_Ankle','R_Hip','R_Knee','R_Ankle'].every(name=>names.has(name))};
  });
  expect(report.bones).toBe(52);expect(report.required).toBe(true);
  expect(report.clips).toHaveLength(1);
  expect(report.clips[0].duration).toBeCloseTo(2.9666667,5);
  expect(report.clips[0].tracks).toBe(53);
  expect(report.clips[0].finite).toBe(true);expect(report.clips[0].root).toBe(true);
});
