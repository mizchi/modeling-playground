import { test, expect } from '@playwright/test';
test('motion editor works at the Pages subdirectory',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./motion-editor.html');await expect(page.locator('#status')).toHaveText('編集できます');
  await page.locator('#timeline').fill('30');await page.locator('#rotate-y').fill('15');await page.locator('#put-key').click();
  await expect(page.locator('#key-count')).toHaveText('3 keys');expect(errors).toEqual([]);
});
