import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';

test('female head derivative and original remain independently viewable',async({page},testInfo)=>{
  test.skip(!existsSync('human/models/lumi-tripo-girl/output/lumi-tripo-girl.glb'),'Optional generated head; never calls a paid API.');
  test.setTimeout(90_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?model=lumi-tripo-girl');
  await expect(page.locator('#model-name')).toHaveText('lumi-tripo-girl.glb');
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#meshes')).toHaveText('3');
  await expect(page.locator('#finger-panel')).toBeHidden();
  for(const view of ['front','side','back','perspective','top']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.screenshot({path:testInfo.outputPath(`head-swap-${view}.png`)});
  }
  await page.goto('/?model=lumi-tripo');
  await expect(page.locator('#model-name')).toHaveText('lumi-tripo.glb');
  await expect(page.locator('#meshes')).toHaveText('1');
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
