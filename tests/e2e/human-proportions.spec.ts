import { outputPath } from '../../modeling/asset-paths.ts';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { presetRecipe } from '../../human/contract.ts';
import { createHuman, disposeHuman } from '../../human/model.ts';

test('height and leg sliders migrate, preserve edits, frame all views and export actual proportions',async({page})=>{
  test.setTimeout(90_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  const legacy={...presetRecipe('base45-female'),hair:'lumi-side-tail',face:'lumi',bodyShape:{chestSize:.5,waistWidth:-.5,muscularity:.3}};
  await page.locator('#recipe-file').setInputFiles({name:'old-body.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await expect(page.locator('#height')).toHaveValue('0');await expect(page.locator('#legLength')).toHaveValue('0');
  const set=async(key,value)=>{await page.locator(`#${key}`).fill(String(value));await page.locator(`#${key}`).dispatchEvent('change');};
  const canvas=page.locator('#viewport canvas');
  for(const [name,height,leg] of [['short',-1,-1],['long-legs',0,1],['tall',1,1]]){
    await set('height',height);await set('legLength',leg);
    for(const view of ['front','side','back','high']){
      await page.locator(`[data-view="${view}"]`).click();await canvas.screenshot({path:outputPath(`human-proportions-${name}-${view}.png`)});
    }
  }
  await page.locator('#body-type').selectOption('male');await expect(page.locator('#height')).toHaveValue('1');
  await expect(page.locator('#chestSize')).toHaveValue('0.5');await expect(page.locator('#hair')).toHaveValue('lumi-side-tail');
  await page.locator('#focus').click();await page.locator('[data-view="quarter"]').click();
  await set('height',-1);await set('legLength',-1);
  await canvas.screenshot({path:outputPath('human-proportions-short-face.png')});
  await set('height',1);await set('legLength',1);
  await canvas.screenshot({path:outputPath('human-proportions-tall-face.png')});
  await page.reload();await expect(page.locator('#height')).toHaveValue('1');await expect(page.locator('#legLength')).toHaveValue('1');
  await page.locator('#reset-body-shape').click();await expect(page.locator('#height')).toHaveValue('0');
  await page.locator('#undo').click();await expect(page.locator('#height')).toHaveValue('1');
  await page.locator('#redo').click();await expect(page.locator('#legLength')).toHaveValue('0');await page.locator('#undo').click();
  await page.locator('#motion').selectOption('歩行テスト');await page.locator('#timeline').fill('0.5');await page.locator('#timeline').dispatchEvent('input');
  await canvas.screenshot({path:outputPath('human-proportions-tall-walk.png')});
  const file=page.waitForEvent('download');await page.locator('#save-recipe').click();
  const recipe=JSON.parse(await readFile(await (await file).path(),'utf8'));expect(recipe.bodyShape.height).toBe(1);expect(recipe.bodyShape.legLength).toBe(1);
  const download=page.waitForEvent('download');await page.locator('#export-glb').click();
  const bytes=await readFile(await (await download).path());expect((await validateBytes(bytes)).issues.numErrors).toBe(0);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  expect(json.scenes[json.scene].extras.humanRecipe.bodyShape).toEqual(recipe.bodyShape);
  const root=createHuman(recipe),g=root.getObjectByName('BaseBody').geometry;g.computeBoundingBox();
  const body=json.nodes.find(n=>n.name==='BaseBody'),a=json.accessors[json.meshes[body.mesh].primitives[0].attributes.POSITION];
  expect(a.min).toEqual(g.boundingBox.min.toArray());expect(a.max).toEqual(g.boundingBox.max.toArray());expect(a.max[1]).toBeGreaterThan(3);disposeHuman(root);
  await page.locator('#play').click();await set('legLength',-.5);await expect(page.locator('#play')).toHaveText('一時停止');
  await page.locator('#play').click();await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
