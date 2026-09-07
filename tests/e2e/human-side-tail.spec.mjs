import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';

test('yellow side tail switches, persists, poses and exports on both bodies',async({page})=>{
  test.setTimeout(60_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  await page.locator('#body-type').selectOption('female');
  await page.locator('#hair').selectOption('lumi-side-tail');
  await expect(page.locator('#model-stats')).toContainText('36 hair bones');
  await page.reload();await expect(page.locator('#hair')).toHaveValue('lumi-side-tail');
  const canvas=page.locator('#viewport canvas');
  for(const view of ['front','quarter','side','back','high']){
    await page.locator(`[data-view="${view}"]`).click();
    await canvas.screenshot({path:`output/human-side-tail-${view}.png`});
  }
  await page.locator('[data-view="quarter"]').click();
  await page.locator('#motion').selectOption('歩行テスト');
  await page.locator('#timeline').fill('0.5');await page.locator('#timeline').dispatchEvent('input');
  await canvas.screenshot({path:'output/human-side-tail-walk.png'});
  await page.locator('#motion').selectOption('首・頭チェック');
  for(const time of [1,2,4,5]){
    await page.locator('#timeline').fill(String(time));await page.locator('#timeline').dispatchEvent('input');
    await canvas.screenshot({path:`output/human-side-tail-neck-${time}.png`});
  }
  const download=page.waitForEvent('download');await page.locator('#export-glb').click();
  const file=await download,bytes=await readFile(await file.path());
  expect((await validateBytes(bytes)).issues.numErrors).toBe(0);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  expect(json.skins).toHaveLength(3);expect(json.nodes.some(n=>n.name==='SideTail')).toBe(true);
  expect(json.animations).toHaveLength(3);
  await page.locator('#body-type').selectOption('male');await expect(page.locator('#hair')).toHaveValue('lumi-side-tail');
  await page.locator('#hair').selectOption('lumi-short');await expect(page.locator('#model-stats')).toContainText('31 hair bones');
  await page.locator('#hair').selectOption('none');await expect(page.locator('#model-stats')).toContainText('no hair');
  await page.locator('#undo').click();await expect(page.locator('#hair')).toHaveValue('lumi-short');
  await page.locator('#undo').click();await expect(page.locator('#hair')).toHaveValue('lumi-side-tail');
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
