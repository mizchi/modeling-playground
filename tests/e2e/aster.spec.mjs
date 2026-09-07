import { test,expect } from '@playwright/test';
import { createAster } from '../../models/aster.mjs';
import { exportGlb } from '../../scripts/export_glb.mjs';
import { HairRig } from '../../runtime/hair-rig.mjs';
import { Quaternion,Vector3 } from 'three';

test('independent Aster model renders the long-limbed silhouette and texture expressions',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=aster');
  await expect(page.locator('#model-name')).toHaveText('aster.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  const canvas=page.locator('#viewport canvas');
  for(const [label,file] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await canvas.screenshot({path:`output/aster-${file}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  const box=await canvas.boundingBox();
  await canvas.dblclick({position:{x:box.width*.50,y:box.height*.22}});
  await expect(page.locator('#selection')).toContainText('Head');
  await canvas.screenshot({path:'output/aster-face.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  await canvas.screenshot({path:'output/aster-face-wire.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
  const neutral=await canvas.screenshot();
  await page.getByLabel('表情を選択').selectOption('Happy');
  expect((await canvas.screenshot({path:'output/aster-happy.png'})).equals(neutral)).toBe(false);
  await page.getByLabel('表情を選択').selectOption('Neutral');
  expect((await canvas.screenshot()).equals(neutral)).toBe(true);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
  await page.mouse.wheel(0,400);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5-110,{steps:12});
  await page.mouse.up();
  await canvas.screenshot({path:'output/aster-low-angle.png'});
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await canvas.screenshot({path:'output/aster-rig.png'});
  await page.getByLabel('骨格を表示',{exact:true}).uncheck();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await canvas.screenshot({path:'output/aster-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('モデルを選択').selectOption('fes256');
  await expect(page.locator('#model-name')).toHaveText('fes256.glb');
  expect(errors).toEqual([]);
});

test('rounded hair crown is inspected from both elevated quarters and elevated rear',async({page})=>{
  await page.goto('/?model=aster');
  await expect(page.locator('#model-name')).toHaveText('aster.glb',{timeout:15_000});
  const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
  for(const [preset,dx,dy,name] of [['正面',65,70,'high-left'],['正面',-65,70,'high-right'],['背面',65,70,'high-back']]) {
    await page.getByRole('button',{name:preset,exact:true}).click();
    // Pixel deltas correspond to azimuth/elevation changes, not a frontal crop.
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.5+dx,box.y+box.height*.5+dy,{steps:15});
    await page.mouse.up();
    await canvas.screenshot({path:`output/aster-${name}.png`});
  }
});

test('hair joints deform the long strands and ahoge after GLB reload',async({page})=>{
  const root=createAster(),rig=new HairRig(root.getObjectByName('Hair'));
  for(const chain of rig.chains) {
    const axis=chain.id==='ahoge'?new Vector3(0,0,1):new Vector3(1,0,0);
    rig.setJoint(chain.id,1,new Quaternion().setFromAxisAngle(axis,.35));
    rig.setJoint(chain.id,2,new Quaternion().setFromAxisAngle(axis,.18));
  }
  root.updateMatrixWorld(true);
  const bytes=Buffer.from(await exportGlb(root));let served=0;
  await page.route('**/output/aster.glb*',route=>{
    if(route.request().resourceType()!=='fetch')return route.continue();
    served++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes});
  });
  await page.goto('/?model=aster');
  await expect(page.locator('#model-name')).toHaveText('aster.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await page.locator('#viewport canvas').screenshot({path:'output/aster-hair-bend.png'});
  await page.getByRole('button',{name:'側面',exact:true}).click();
  await page.locator('#viewport canvas').screenshot({path:'output/aster-hair-bend-side.png'});
  await page.getByRole('button',{name:'背面',exact:true}).click();
  await page.locator('#viewport canvas').screenshot({path:'output/aster-hair-bend-back.png'});
  expect(served).toBe(1);
});

test('Aster elbow and knee pose survives GLB reload',async({page})=>{
  const root=createAster();
  root.getObjectByName('LeftUpperArm').rotation.z=.18;
  root.getObjectByName('LeftForearm').rotation.x=-1.0;
  root.getObjectByName('RightForearm').rotation.x=-.45;
  root.getObjectByName('LeftThigh').rotation.x=-.35;
  root.getObjectByName('LeftShin').rotation.x=.7;
  root.getObjectByName('Head').rotation.y=.12;
  root.updateMatrixWorld(true);
  const bytes=Buffer.from(await exportGlb(root));
  let servedPose=0;
  await page.route('**/output/aster.glb*',route=>{
    if(route.request().resourceType()!=='fetch')return route.continue();
    servedPose++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes});
  });
  await page.goto('/?model=aster');
  await expect(page.locator('#model-name')).toHaveText('aster.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await page.locator('#viewport canvas').screenshot({path:'output/aster-pose.png'});
  await page.getByRole('button',{name:'側面',exact:true}).click();
  await page.locator('#viewport canvas').screenshot({path:'output/aster-pose-side.png'});
  expect(servedPose).toBe(1);
});

test('the bare head remains a complete model when hair is removed',async({page})=>{
  const root=createAster();root.getObjectByName('Hair').removeFromParent();
  const bytes=Buffer.from(await exportGlb(root));let served=0;
  await page.route('**/output/aster.glb*',route=>{
    if(route.request().resourceType()!=='fetch')return route.continue();
    served++;return route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes});
  });
  await page.goto('/?model=aster');
  await expect(page.locator('#model-name')).toHaveText('aster.glb',{timeout:15_000});
  const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
  await canvas.dblclick({position:{x:box.width*.50,y:box.height*.22}});
  await expect(page.locator('#selection')).toContainText('Head');
  await canvas.screenshot({path:'output/aster-head-only.png'});
  expect(served).toBe(1);
});
