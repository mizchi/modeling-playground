import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';

test('Tripo comparison loads textured geometry from the catalog in five views',async({page},testInfo)=>{
  test.skip(!existsSync('human/models/lumi-tripo/output/lumi-tripo.glb'),'Optional generated artifact; never calls a paid API.');
  test.setTimeout(90_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?model=lumi-tripo');
  await expect(page.locator('#model-name')).toHaveText('lumi-tripo.glb');
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#triangles')).not.toHaveText('—');
  await expect(page.locator('#finger-panel')).toBeHidden();
  await expect(page.locator('#wireframe')).not.toBeChecked();
  for(const view of ['front','side','back','perspective','top']){
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:testInfo.outputPath(`tripo-${view}.png`)});
  }
  expect(errors).toEqual([]);
});
