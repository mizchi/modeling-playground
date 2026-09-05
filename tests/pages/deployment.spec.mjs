import { test, expect } from '@playwright/test';

test('production site loads every GLB under the Pages subdirectory',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto('./?model=suzu');
  await expect(page.locator('#model-name')).toHaveText('suzu.glb');
  const models=['traveler','traveler-walk','traveler-ik','little-town','suzu'];
  for(const model of models) {
    await page.getByLabel('モデルを選択').selectOption(model);
    await expect(page.locator('#model-name')).toHaveText(model+'.glb');
    await expect(page.locator('#status')).toHaveText('表示中');
    expect(new URL(page.url()).pathname).toMatch(/\/modeling-playground\/$/);
  }
  await page.reload();
  await expect(page.locator('#model-name')).toHaveText('suzu.glb');
  await page.getByRole('button',{name:'側面',exact:true}).click();
  await expect(page.getByRole('button',{name:'側面',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});
