import { test, expect } from '@playwright/test';
import { createBase45 } from '../../models/base45.mjs';
import { createBase45Inspection } from '../../models/base45-inspection.mjs';
import { exportGlb } from '../../scripts/export_glb.mjs';

async function inspectAngle(page,yaw,pitch) {
  const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
  await page.getByRole('button',{name:'正面',exact:true}).click();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  // OrbitControls: a full canvas height corresponds to 360 degrees.
  await page.mouse.move(x-box.height*yaw/360,y+box.height*pitch/360,{steps:12});await page.mouse.up();
  let previous;
  await expect.poll(async()=>{
    const current=await canvas.screenshot(),stable=previous?.equals(current);previous=current;return stable;
  },{timeout:10_000,intervals:[200,300]}).toBe(true);
  return canvas;
}

for(const [yaw,pitch,name] of [[35,-35,'reference-low'],[-55,-25,'right-low'],[55,-25,'left-low'],[-90,0,'profile'],[90,-25,'side-low'],[-135,-20,'rear-low'],[0,-45,'under-chin']]) {
  test(`jaw underside: ${name} wire and clay`,async({page})=>{
    const stage=process.env.BASE45_REVIEW_STAGE==='before'?'before':'after';
    const bytes=Buffer.from(await exportGlb(createBase45Inspection()));
    await page.route('**/output/base45.glb*',route=>route.request().resourceType()==='fetch'
      ?route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes}):route.continue());
    await page.goto('/?model=base45');
    await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
    const canvas=await inspectAngle(page,yaw,pitch);
    await canvas.screenshot({path:`output/base45-jaw-${stage}-${name}-wire.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
    await canvas.screenshot({path:`output/base45-jaw-${stage}-${name}.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  });
}

test('jaw underside: delivered body low angle',async({page})=>{
  if(process.env.BASE45_REVIEW_STAGE!=='before') {
    await page.goto('/?model=base45');
    await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
    const canvas=await inspectAngle(page,-55,-25);
    await canvas.screenshot({path:'output/base45-jaw-after-body-low.png'});
  }
});

for(const [yaw,pitch,name] of [[35,0,'left-35'],[55,0,'left-55'],[-35,0,'right-35'],[-55,0,'right-55'],[45,15,'high-45'],[45,-15,'low-45']]) {
  test(`head contour: ${name} wire and clay`,async({page})=>{
    const bytes=Buffer.from(await exportGlb(createBase45Inspection()));
    await page.route('**/output/base45.glb*',route=>route.request().resourceType()==='fetch'
      ?route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes}):route.continue());
    await page.goto('/?model=base45');
    await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
    const canvas=await inspectAngle(page,yaw,pitch);
    await canvas.screenshot({path:`output/base45-contour-${name}.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
    await canvas.screenshot({path:`output/base45-contour-${name}-clay.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  });
}

for(const surface of ['eyes','grid']) {
  for(const [yaw,pitch,name] of [[0,0,'front'],[35,0,'35'],[55,0,'55'],[45,15,'high'],[45,-15,'low'],[180,0,'back']]) {
    test(`head surface: ${surface} ${name}`,async({page})=>{
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      if(surface==='grid') {
        const bytes=Buffer.from(await exportGlb(createBase45Inspection({surface})));
        await page.route('**/output/base45-face-check.glb*',route=>route.request().resourceType()==='fetch'
          ?route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes}):route.continue());
      }
      await page.goto('/?model=base45-face-check');
      await expect(page.locator('#model-name')).toHaveText('base45-face-check.glb',{timeout:15_000});
      await expect(page.locator('#status')).toHaveText('表示中');
      const canvas=await inspectAngle(page,yaw,pitch);
      await canvas.screenshot({path:`output/base45-${surface}-${name}.png`});
      expect(errors).toEqual([]);
    });
  }
}

test('base45 loads with editable quad wires and is inspected from every side',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?model=base45');
  await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.getByLabel('ワイヤーフレーム',{exact:true})).toBeChecked();
  const canvas=page.locator('#viewport canvas');
  for(const [label,name] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back'],['上面','top']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await canvas.screenshot({path:`output/base45-${name}.png`});
  }
  const box=await canvas.boundingBox();
  for(const [label,dy,name] of [['背面',70,'high-back'],['正面',70,'high-front'],['正面',-70,'low-front']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.5+70,box.y+box.height*.5+dy,{steps:15});await page.mouse.up();
    await canvas.screenshot({path:`output/base45-${name}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  const wire=await canvas.screenshot();
  await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
  expect((await canvas.screenshot({path:'output/base45-clay.png'})).equals(wire)).toBe(false);
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await canvas.screenshot({path:'output/base45-rig.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'斜め',exact:true}).click();
  await canvas.screenshot({path:'output/base45-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('shoulder elbow hip and knee bend survive GLB round-trip with quad overlay',async({page})=>{
  const root=createBase45();
  root.getObjectByName('LeftUpperArm').rotation.z=-.65;
  root.getObjectByName('RightUpperArm').rotation.z=.65;
  root.getObjectByName('LeftForearm').rotation.y=-1.0;
  root.getObjectByName('RightForearm').rotation.y=.6;
  root.getObjectByName('LeftThigh').rotation.x=-.55;
  root.getObjectByName('LeftShin').rotation.x=1.0;
  root.getObjectByName('Head').rotation.y=.2;root.updateMatrixWorld(true);
  const bytes=Buffer.from(await exportGlb(root));let served=0;
  await page.route('**/output/base45.glb*',route=>{
    if(route.request().resourceType()!=='fetch')return route.continue();
    served++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes});
  });
  await page.goto('/?model=base45');await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
  for(const [label,name] of [['斜め','pose'],['側面','pose-side'],['背面','pose-back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/base45-${name}.png`});
  }
  expect(served).toBe(1);
});

for(const [label,name] of [['正面','face-front'],['側面','face-side'],['斜め','face-quarter'],['背面','face-back']]) {
  test(`egg-shaped face and neck: ${name}`,async({page})=>{
    await page.goto('/?model=base45');await expect(page.locator('#model-name')).toHaveText('base45.glb',{timeout:15_000});
    const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down({button:'right'});
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5+220,{steps:15});await page.mouse.up({button:'right'});
    await page.mouse.wheel(0,-1600);
    await canvas.screenshot({path:`output/base45-${name}.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
    await canvas.screenshot({path:`output/base45-${name}-clay.png`});
    await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  });
}
