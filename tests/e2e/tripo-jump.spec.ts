import {test,expect} from '@playwright/test';
import {existsSync,readFileSync} from 'node:fs';
import type {RetargetDiagnostics} from '../../motion/retarget/meshy.ts';
import type {SkinnedMesh} from 'three';

test('HY jump plays on the Meshy-rigged Tripo character with raw/corrected comparison',async({page},testInfo)=>{
  const path='human/models/lumi-tripo-rig/output/jump-report.json';
  test.skip(!existsSync(path),'Optional local generated assets; never calls paid APIs.');
  test.setTimeout(90_000);
  const report:RetargetDiagnostics=JSON.parse(readFileSync(path,'utf8')).corrected,samples=report.samples;
  const peak=samples.reduce((a,b)=>a.soleY>b.soleY?a:b);
  const squat=samples.filter(s=>s.time<peak.time).reduce((a,b)=>a.hips[1]<b.hips[1]?a:b);
  const takeoff=samples.find(s=>s.soleY>.03);
  const landing=samples.find(s=>s.time>peak.time&&s.soleY<.01);
  expect(takeoff).toBeDefined();expect(landing).toBeDefined();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=lumi-tripo-jump');
  await expect(page.locator('#model-name')).toHaveText('lumi-tripo-jump.glb');
  await expect(page.locator('#animation-panel')).toBeVisible();
  await expect(page.locator('#clip-select option')).toHaveCount(3);
  await page.locator('#play-pause').click();
  for(const view of ['front','side']){
    await page.locator('#timeline').fill('0');await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-pressed','true');
    for(const [name,time] of [['start',0],['squat',squat.time],['takeoff',takeoff!.time],['peak',peak.time],['landing',landing!.time],['end',report.sourceDuration]] as const){
      await page.locator('#timeline').fill(String(Math.floor(time*100)/100));
      await page.screenshot({path:testInfo.outputPath(`jump-${view}-${name}.png`)});
    }
  }
  await page.locator('#clip-select').selectOption('1');
  await page.locator('#timeline').fill(String(Math.floor(squat.time*100)/100));
  await page.screenshot({path:testInfo.outputPath('jump-raw-squat.png')});
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
  const geometryCheck=await page.evaluate(async()=>{
    const loaderPath:string='/node_modules/three/examples/jsm/loaders/GLTFLoader.js',threePath:string='/node_modules/three/build/three.module.js';
    const {GLTFLoader}:typeof import('three/addons/loaders/GLTFLoader.js')=await import(loaderPath);
    const {AnimationMixer,Vector3,LoopOnce}:typeof import('three')=await import(threePath);
    const gltf=await new GLTFLoader().loadAsync('/human/models/lumi-tripo-rig/output/lumi-tripo-jump.glb');
    const mixer=new AnimationMixer(gltf.scene),action=mixer.clipAction(gltf.animations[0]);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
    const meshes:SkinnedMesh[]=[];gltf.scene.traverse(o=>{if('isSkinnedMesh' in o&&o.isSkinnedMesh)meshes.push(o as SkinnedMesh);});
    let minimum=Infinity,maximum=-Infinity,finite=true;
    for(let time=0;time<gltf.animations[0].duration;time+=1/120){
      mixer.setTime(time);gltf.scene.updateMatrixWorld(true);let sole=Infinity;
      for(const mesh of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
        finite&&=p.toArray().every(Number.isFinite);sole=Math.min(sole,p.y);
      }}
      minimum=Math.min(minimum,sole);maximum=Math.max(maximum,sole);
    }
    return {minimum,maximum,finite};
  });
  expect(geometryCheck.finite).toBe(true);
  expect(geometryCheck.minimum).toBeGreaterThan(-.003); // Interpolated, not only baked keys.
  expect(geometryCheck.maximum).toBeGreaterThan(.1);
  await testInfo.attach('reimported-skin-measurements',{body:JSON.stringify(geometryCheck),contentType:'application/json'});
});
