import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { FACE_ANATOMY } from '../../models/ashley-face.mjs';

test('Ashley: embedded texture, front/profile/back, face focus and standalone GLB',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=ashley');
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#model-name')).toHaveText('ashley.glb');
  await expect(page.locator('#animation-panel')).toBeHidden();
  expect(Number((await page.locator('#triangles').textContent()).replaceAll(',',''))).toBeLessThanOrEqual(3200);
  for(const [view,name] of [['正面','front'],['側面','side'],['背面','back'],['斜め','viewer']]) {
    await page.getByRole('button',{name:view,exact:true}).click();
    await expect(page.getByRole('button',{name:view,exact:true})).toHaveAttribute('aria-pressed','true');
    await page.locator('canvas').screenshot({path:`output/ashley-${name}.png`});
  }
  for(const [view,name] of [['正面','shorts-front'],['背面','shorts-back'],['斜め','shorts-quarter']]) {
    await page.getByRole('button',{name:view,exact:true}).click();
    await page.locator('canvas').hover();await page.mouse.wheel(0,-1700);
    // Allow the damped orbit control to settle before recording the hem.
    await page.waitForTimeout(300);
    await page.locator('canvas').screenshot({path:`output/ashley-${name}.png`});
  }
  await page.getByRole('button',{name:'背面',exact:true}).click();
  const backCanvas=page.locator('canvas'),backRect=await backCanvas.boundingBox();
  await backCanvas.dblclick({position:{x:backRect.width*.5,y:backRect.height*.35}});
  await expect(page.locator('#selection')).toContainText('Body');
  await backCanvas.screenshot({path:'output/ashley-harness-back.png'});
  await page.getByRole('button',{name:'背面',exact:true}).click();
  const rear=await page.locator('canvas').boundingBox();
  await page.mouse.move(rear.x+rear.width*.5,rear.y+rear.height*.6);
  await page.mouse.down();
  await page.mouse.move(rear.x+rear.width*.58,rear.y+rear.height*.6,{steps:10});
  await page.mouse.up();
  await page.locator('canvas').screenshot({path:'output/ashley-rear-quarter.png'});
  await page.getByRole('button',{name:'正面',exact:true}).click();
  const canvas=page.locator('canvas'),rect=await canvas.boundingBox();
  await canvas.dblclick({position:{x:rect.width*.5,y:rect.height*.215}});
  await expect(page.locator('#selection')).toContainText('Head');
  await canvas.screenshot({path:'output/ashley-face.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  await canvas.screenshot({path:'output/ashley-face-wireframe.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
  await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.6);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.38,rect.y+rect.height*.6,{steps:10});
  await page.mouse.up();
  await canvas.screenshot({path:'output/ashley-jaw-quarter.png'});
  await page.getByRole('button',{name:'側面',exact:true}).click();
  // A view preset frames the full model; select the head again in profile.
  const after=await canvas.boundingBox();
  await canvas.dblclick({position:{x:after.width*.5,y:after.height*.215}});
  await canvas.screenshot({path:'output/ashley-profile.png'});
  // Include the nape-to-shoulder transition, not just a tightly framed skull.
  await canvas.hover();await page.mouse.wheel(0,320);
  await page.mouse.move(after.x+after.width*.55,after.y+after.height*.60);
  await page.mouse.down({button:'right'});
  await page.mouse.move(after.x+after.width*.55,after.y+after.height*.48,{steps:10});
  await page.mouse.up({button:'right'});
  await canvas.screenshot({path:'output/ashley-neck-profile.png'});
  await page.getByLabel('GLBファイルを選択').setInputFiles(fileURLToPath(new URL('../../output/ashley.glb',import.meta.url)));
  await expect(page.locator('#status')).toHaveText('表示中');
  const upperLid=Math.round((FACE_ANATOMY.top-FACE_ANATOMY.eyeY)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95)-2;
  const decoded=await page.evaluate(async(upperLid)=>{
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const loaded=await new GLTFLoader().loadAsync('/output/ashley.glb');
    const face=loaded.scene.getObjectByName('Face'),map=face.material.map;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.drawImage(map.image,0,0);
    return {width:map.image.width,height:map.image.height,filter:map.magFilter,topology:face.userData.topology,
      eye:[...ctx.getImageData(29,upperLid,1,1).data],hair:[...ctx.getImageData(166,20,1,1).data]};
  },upperLid);
  expect(decoded.width).toBe(256);expect(decoded.height).toBe(256);
  expect(decoded.topology.features.map(f=>f.name)).toEqual(['leftEye','rightEye','mouth']);
  expect(decoded.filter).toBe(1003);expect(decoded.eye).toEqual([65,53,39,255]);
  expect(decoded.hair[0]).toBeGreaterThan(decoded.hair[2]);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
