import { test, expect } from '@playwright/test';

test('human viewer builds at the production subdirectory without root-relative assets',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  await page.locator('#faceLength').fill('0.5');await page.locator('#faceLength').dispatchEvent('change');
  await expect(page.locator('#faceLength-value')).toHaveText('0.50');
  await page.getByRole('button',{name:'BASE-45 素体 / ニュートラル',exact:true}).click();
  await expect(page.locator('#model-stats')).toContainText('1,320 triangles');expect(errors).toEqual([]);
  await page.locator('#body-type').selectOption('female');await expect(page.locator('#model-title')).toHaveText('BASE-45 F');
  await expect(page.locator('#hair')).toHaveValue('none');await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
