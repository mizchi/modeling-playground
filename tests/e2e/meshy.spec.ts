import { test, expect } from '@playwright/test';
import { join } from 'node:path';

test('generated Meshy model exposes its rig and plays walking without page errors',async({page},testInfo)=>{
  test.skip(!process.env.MESHY_OUTPUT_DIR,'Optional generated-model smoke test. Never calls a paid API.');
  test.setTimeout(90_000);
  const prefix='lumi-meshy-v2',suffix='-relaxed';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#file').setInputFiles(join(process.env.MESHY_OUTPUT_DIR,`${prefix}${suffix}.glb`));
  await expect(page.locator('#model-name')).toHaveText(`${prefix}${suffix}.glb`);
  await expect(page.locator('#error')).toBeHidden();await page.locator('#wireframe').uncheck();
  await expect(page.locator('#finger-panel')).toBeVisible();
  await expect(page.locator('#finger-panel input[type="range"]')).toHaveCount(10);
  await page.locator('#finger-Left-Index').fill('80');
  await expect(page.locator('#finger-Right-Index')).toHaveValue('0');
  await page.locator('#finger-reset').click();
  await expect(page.locator('#finger-Left-Index')).toHaveValue('0');
  for(const view of ['front','side','back','perspective']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.screenshot({path:testInfo.outputPath(`meshy-${view}.png`)});
  }
  await page.locator('#file').setInputFiles(join(process.env.MESHY_OUTPUT_DIR,`${prefix}-walking${suffix}.glb`));
  await expect(page.locator('#model-name')).toHaveText(`${prefix}-walking${suffix}.glb`);
  await expect(page.locator('#animation-panel')).toBeVisible();
  await page.locator('#finger-Right-Thumb').fill('50');
  await page.locator('#skeleton').check();await page.locator('#play-pause').click();
  await page.locator('#timeline').fill('0.5');
  await page.screenshot({path:testInfo.outputPath('meshy-walking.png')});
  await page.locator('#file').setInputFiles(join(process.env.MESHY_OUTPUT_DIR,`${prefix}-running${suffix}.glb`));
  await expect(page.locator('#model-name')).toHaveText(`${prefix}-running${suffix}.glb`);
  await expect(page.locator('#finger-Right-Thumb')).toHaveValue('0');
  await page.locator('#finger-Left-Little').fill('-50');
  await page.locator('#timeline').fill('0.3');
  await page.screenshot({path:testInfo.outputPath('meshy-running.png')});
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
