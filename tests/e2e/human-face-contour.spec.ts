import { test, expect } from '@playwright/test';
import { outputPath } from '../../modeling/asset-paths.ts';

test('shared cheek and jaw are inspected without hair and with LUMI from multiple angles',async({page})=>{
  test.setTimeout(90_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  await page.locator('#focus').click();const canvas=page.locator('#viewport canvas');
  for(const model of ['base45','base45-female','lumi']){
    await page.locator(`[data-preset="${model}"]`).click();
    for(const view of ['front','quarter','side','low','back','high']){
      await page.locator(`[data-view="${view}"]`).click();
      await canvas.screenshot({path:outputPath(`human-contour-${process.env.CONTOUR_STAGE??'after'}-${model}-${view}.png`)});
    }
    // Rear three-quarter / overhead expose the skull-to-ear join hidden in front views.
    const box=await canvas.boundingBox();
    for(const [name,view,dx,dy] of [['rear-quarter','back',120,35],['rear-opposite','back',-120,35],['opposite-side','side',box.height/2,0],['overhead','high',0,100]]){
      await page.locator(`[data-view="${view}"]`).click();
      const x=box.x+box.width/2,y=box.y+box.height/2;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});await page.mouse.up();
      await canvas.screenshot({path:outputPath(`human-contour-${process.env.CONTOUR_STAGE??'after'}-${model}-${name}.png`)});
    }
    await page.locator('#wireframe').check();
    for(const [name,view] of [['wire','quarter'],['wire-side','side'],['wire-high','high'],['wire-back','back']]){
      await page.locator(`[data-view="${view}"]`).click();
      await canvas.screenshot({path:outputPath(`human-contour-${process.env.CONTOUR_STAGE??'after'}-${model}-${name}.png`)});
    }
    await page.locator('#wireframe').uncheck();
  }
  expect(errors).toEqual([]);await expect(page.locator('#error')).toBeHidden();
});
