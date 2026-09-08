import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { fileURLToPath } from 'node:url';

test('motion editor authors keys, switches bodies, undoes and round-trips JSON/GLB',async({page})=>{
  test.setTimeout(90_000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/motion-editor.html');await expect(page.locator('#status')).toHaveText('編集できます');
  await page.locator('#timeline').fill('30');
  await page.locator('#bone').selectOption('Head');await page.locator('#rotate-y').fill('30');
  await expect(page.locator('#draft')).toBeVisible();await page.locator('#put-key').click();
  await expect(page.locator('#key-count')).toHaveText('3 keys');
  await page.locator('#key-frame').fill('35');await page.locator('#move-key').click();
  await expect(page.locator('#timeline')).toHaveValue('35');
  await page.locator('#delete-key').click();await expect(page.locator('#key-count')).toHaveText('2 keys');
  await page.locator('#undo').click();await expect(page.locator('#key-count')).toHaveText('3 keys');
  await page.locator('#model').selectOption('base45-female');
  for(const view of ['side','back','quarter'])await page.locator(`[data-view="${view}"]`).click();
  const save=page.waitForEvent('download');await page.locator('#save-project').click();
  const json=await readFile(await (await save).path());const project=JSON.parse(json.toString());
  expect(project.keys[1].frame).toBe(35);expect(project.recipe.model).toBe('base45-female');
  expect(project.keys[1].pose.rotations.Head[1]).toBeCloseTo(Math.sin(Math.PI/12));
  await page.reload();await expect(page.locator('#key-count')).toHaveText('3 keys');
  await page.locator('#project-file').setInputFiles({name:'motion.json',mimeType:'application/json',buffer:json});
  await page.locator('#project-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#key-count')).toHaveText('3 keys');
  const saveGlb=page.waitForEvent('download');await page.locator('#export-glb').click();
  const glb=await readFile(await (await saveGlb).path());expect((await validateBytes(glb)).issues.numErrors).toBe(0);
  const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());expect(gltf.animations).toHaveLength(1);
  await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('一時停止');
  await page.locator('#play').click();await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});

test('IK edits become keys; unsaved draft cannot silently disappear on seek',async({page})=>{
  await page.goto('/motion-editor.html');await expect(page.locator('#status')).toHaveText('編集できます');
  await page.locator('#target').selectOption('leftHand');await page.locator('#target-z').fill('0.2');
  await expect(page.locator('#draft')).toBeVisible();await expect(page.locator('#timeline')).toBeDisabled();
  await expect(page.locator('#clip-name')).toBeDisabled();await expect(page.locator('#loop')).toBeDisabled();
  await page.locator('#target-z').fill('');await page.locator('#target-z').pressSequentially('0.15');
  await expect(page.locator('#target-z')).toHaveValue('0.15');
  await page.locator('#put-key').click();await expect(page.locator('#timeline')).toBeEnabled();
  const download=page.waitForEvent('download');await page.locator('#save-project').click();
  const p=JSON.parse((await readFile(await (await download).path())).toString());
  expect(p.keys[0].pose.rotations.LeftUpperArm).not.toEqual([0,0,0,1]);
  await page.locator('#timeline').fill('60');await expect(page.locator('#time')).toHaveText('2.00 s · 60 f');
  await page.locator('#previous-frame').click();await expect(page.locator('#timeline')).toHaveValue('59');
});

test('motion editor fits mobile and offers a local-only reference video input',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/motion-editor.html');
  await expect(page.locator('#status')).toHaveText('編集できます');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await expect(page.locator('#video-file')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('motion-mobile.png'),fullPage:true});
});

test('local video trimming, synchronized seek, undo and reload without uploading',async({page},testInfo)=>{
  const file=fileURLToPath(new URL('../fixtures/motion-reference.webm',import.meta.url));
  const external=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
  await page.goto('/motion-editor.html');await expect(page.locator('#status')).toHaveText('編集できます');
  await page.locator('#video-file').setInputFiles(file);await expect(page.locator('#video-name')).toContainText('ローカル参照');
  await page.locator('#video-in').fill('1');await page.locator('#video-out').fill('2.5');await page.locator('#apply-trim').click();
  await expect(page.locator('#timeline')).toHaveAttribute('max','45');await page.locator('#timeline').fill('30');
  await expect.poll(()=>page.locator('#reference-video').evaluate(v=>v.currentTime)).toBeCloseTo(2,1);
  await page.locator('#next-frame').click();await expect.poll(()=>page.locator('#reference-video').evaluate(v=>v.currentTime)).toBeCloseTo(2+1/30,2);
  await page.locator('#undo').click();await expect(page.locator('#timeline')).toHaveAttribute('max','60');
  await page.locator('#redo').click();await page.locator('#timeline').fill('0');
  await page.locator('#play').click();await expect.poll(()=>page.locator('#reference-video').evaluate(v=>v.currentTime)).toBeGreaterThan(1.1);
  await page.locator('#play').click();await page.reload();await expect(page.locator('#video-name')).toContainText('同じ動画を再選択');
  await page.locator('#video-file').setInputFiles(file);await expect(page.locator('#video-in')).toHaveValue('1');
  await page.locator('#video-out').fill('0.5');await page.locator('#apply-trim').click();await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#timeline')).toHaveAttribute('max','45');expect(external).toEqual([]);
  await page.locator('#video-out').fill('2.5');await page.locator('#apply-trim').click();
  await page.screenshot({path:testInfo.outputPath('motion-desktop.png'),fullPage:true});
});

test('public Hunyuan sample imports, edits and exports on the shared human rig',async({page},testInfo)=>{
  test.skip(!process.env.HUNYUAN_SAMPLE_FBX,'Optional real-provider smoke test; supply a local FBX, never calls a paid API.');
  test.setTimeout(90_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/motion-editor.html');await expect(page.locator('#status')).toHaveText('編集できます');
  await page.locator('#fbx-file').setInputFiles(process.env.HUNYUAN_SAMPLE_FBX);
  await expect(page.locator('#import-fbx')).toBeEnabled();await page.locator('#import-fbx').click();
  await expect(page.locator('#import-status')).toContainText('Hunyuan SMPL-H → BASE-45');
  await expect(page.locator('#key-count')).not.toHaveText('2 keys');await page.locator('#show-bones').uncheck();
  const last=Number(await page.locator('#timeline').getAttribute('max'));
  for(const [view,f] of [['front',0],['side',Math.round(last*.3)],['back',Math.round(last*.6)],['quarter',last]]){
    await page.locator(`[data-view="${view}"]`).click();await page.locator('#timeline').fill(String(f));
    await page.screenshot({path:testInfo.outputPath(`hunyuan-${view}.png`)});
  }
  await page.locator('#rotate-y').fill('15');await page.locator('#put-key').click();
  const download=page.waitForEvent('download');await page.locator('#export-glb').click();
  expect((await validateBytes(await readFile(await (await download).path()))).issues.numErrors).toBe(0);
  await page.locator('#model').selectOption('base45-female');await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText('一時停止');await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
