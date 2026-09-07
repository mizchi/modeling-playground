import { test, expect } from '@playwright/test';
import { AnimationClip, QuaternionKeyframeTrack } from 'three';
import { createBase45 } from '../../models/base45.mjs';
import { exportGlb } from '../../scripts/export_glb.mjs';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { BASE45_BONES } from '../../models/base45-definition.mjs';

test('human workshop edits, switches modules, preserves history and exports a GLB',async({page})=>{
  test.setTimeout(90_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  await page.getByRole('button',{name:'顔に寄る',exact:true}).click();
  const canvas=page.locator('#viewport canvas');
  await page.locator('#noseHeight').fill('0.8');await page.locator('#noseHeight').dispatchEvent('change');
  await expect(page.locator('#noseHeight-value')).toHaveText('0.80');
  await page.getByRole('button',{name:'元に戻す',exact:true}).click();await expect(page.locator('#noseHeight')).toHaveValue('0');
  await page.getByRole('button',{name:'やり直す',exact:true}).click();await expect(page.locator('#noseHeight')).toHaveValue('0.8');
  await page.locator('#eyeSpacing').fill('-0.5');await page.locator('#eyeSpacing').dispatchEvent('change');
  for(const [view,name] of [['正面','front'],['側面','side'],['斜め下','low'],['斜め上','high'],['背面','back']]) {
    await page.getByRole('button',{name:view,exact:true}).click();await canvas.screenshot({path:`output/human-${name}.png`});
  }
  await page.getByRole('button',{name:'BASE-45 素体 / ニュートラル',exact:true}).click();
  await expect(page.locator('#model-title')).toHaveText('BASE45');await expect(page.locator('#model-stats')).toContainText('1,296 triangles');
  await page.locator('#hair').selectOption('lumi-short');await page.locator('#face').selectOption('lumi');
  await expect(page.locator('#model-stats')).toContainText('2,006 triangles');
  await page.locator('#wireframe').check();await page.locator('#skeleton').check();
  await page.getByRole('button',{name:'斜め',exact:true}).click();await page.screenshot({path:'output/human-workshop.png'});
  await page.reload();await expect(page.locator('#hair')).toHaveValue('lumi-short');
  await page.locator('#motion').selectOption('待機');await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect.poll(()=>page.locator('#time').textContent()).not.toBe('0.00 s');
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'GLBを書き出す ↗',exact:true}).click();
  const file=await download;expect(file.suggestedFilename()).toBe('human.glb');
  const exported=await readFile(await file.path()),report=await validateBytes(exported);
  expect(report.issues.numErrors).toBe(0);
  const json=JSON.parse(exported.subarray(20,20+exported.readUInt32LE(12)).toString());
  expect(json.skins).toHaveLength(2);expect(json.animations).toHaveLength(2);expect(json.images).toHaveLength(2);
  expect(json.nodes.some(n=>n.name==='AuthoringEdges')).toBe(false);
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});

test('compatible motion and skeleton imports work; invalid settings leave the character intact',async({page})=>{
  test.setTimeout(60_000);await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  const rig={version:1,bones:BASE45_BONES.map(b=>({...b,position:b.position.map((v,k)=>k===1?v*1.05:v)}))};
  await page.locator('#rig-file').setInputFiles({name:'rig.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rig))});
  await expect(page.locator('#rig-name')).toContainText('読み込み骨格');
  await page.locator('#face-file').setInputFiles('output/lumi-face.png');await expect(page.locator('#face-asset')).toHaveText('lumi-face.png');
  await page.getByRole('button',{name:'顔に寄る',exact:true}).click();
  await page.screenshot({path:'output/human-imported.png'});
  const exportedImage=page.waitForEvent('download');await page.getByRole('button',{name:'GLBを書き出す ↗',exact:true}).click();
  const imageFile=await exportedImage;expect((await validateBytes(await readFile(await imageFile.path()))).issues.numErrors).toBe(0);
  const clip=new AnimationClip('head test',1,[new QuaternionKeyframeTrack('Head.quaternion',[0,1],[0,0,0,1,0,.1,0,Math.sqrt(.99)])]);
  const bytes=Buffer.from(await exportGlb(createBase45(),[clip]));
  await page.locator('#motion-file').setInputFiles({name:'motion.glb',mimeType:'model/gltf-binary',buffer:bytes});
  await expect(page.locator('#motion')).toHaveValue('外部 1: head test');
  await page.getByRole('button',{name:'再生',exact:true}).click();await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  const before=await page.locator('#viewport').getAttribute('data-revision');
  await page.locator('#recipe-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#error')).toContainText('version');await expect(page.locator('#viewport')).toHaveAttribute('data-revision',before);
  await page.locator('#rig-file').setInputFiles({name:'bad-rig.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"bones":[]}')});
  await expect(page.locator('#error')).toContainText('22ボーン');
});

test('human workshop fits a mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/human-viewer.html');
  await expect(page.locator('#status')).toHaveText('編集を反映しました');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'output/human-mobile.png',fullPage:true});
});
