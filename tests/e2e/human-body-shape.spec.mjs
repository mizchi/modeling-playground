import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateBytes } from 'gltf-validator';
import { presetRecipe } from '../../human/contract.mjs';
import { createHuman, disposeHuman } from '../../human/model.mjs';

test('body sliders preserve parts, migrate settings, undo, persist and export shaped geometry',async({page})=>{
  test.setTimeout(90_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const old=presetRecipe('lumi');delete old.bodyShape;
  await page.addInitScript(recipe=>{if(!localStorage.getItem('human-viewer.recipe.v1'))localStorage.setItem('human-viewer.recipe.v1',JSON.stringify(recipe));},old);
  await page.goto('/human-viewer.html');await expect(page.locator('#status')).toHaveText('編集を反映しました');
  const set=async(key,value)=>{await page.locator(`#${key}`).fill(String(value));await page.locator(`#${key}`).dispatchEvent('change');};
  await expect(page.locator('#chestSize')).toHaveValue('0');
  await page.locator('#body-type').selectOption('female');await page.locator('#hair').selectOption('lumi-side-tail');
  await set('noseHeight',.4);
  for(const [name,values] of [['neutral',[0,0,0]],['slender',[-1,-1,0]],['full',[1,1,0]],['muscular',[0,-.5,1]]]){
    for(const [i,key] of ['chestSize','waistWidth','muscularity'].entries())await set(key,values[i]);
    for(const view of ['front','side','back']){
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('#viewport canvas').screenshot({path:`output/human-body-${name}-${view}.png`});
    }
  }
  await page.locator('#undo').click();await expect(page.locator('#muscularity')).toHaveValue('0');
  await page.locator('#redo').click();await expect(page.locator('#muscularity')).toHaveValue('1');
  await page.locator('#body-type').selectOption('male');await expect(page.locator('#waistWidth')).toHaveValue('-0.5');
  await expect(page.locator('#hair')).toHaveValue('lumi-side-tail');await expect(page.locator('#noseHeight')).toHaveValue('0.4');
  await page.locator('[data-view="quarter"]').click();
  await page.locator('#viewport canvas').screenshot({path:'output/human-body-male-muscular.png'});
  await page.reload();await expect(page.locator('#muscularity')).toHaveValue('1');
  await page.locator('#reset-body-shape').click();await expect(page.locator('#muscularity')).toHaveValue('0');
  await expect(page.locator('#noseHeight')).toHaveValue('0.4');
  await page.locator('#undo').click();await expect(page.locator('#muscularity')).toHaveValue('1');
  const download=page.waitForEvent('download');await page.locator('#save-recipe').click();
  const saved=JSON.parse(await readFile(await (await download).path(),'utf8'));
  expect(saved.bodyShape).toEqual({chestSize:0,waistWidth:-.5,muscularity:1,legLength:0,height:0});
  const before=await page.locator('#viewport').getAttribute('data-revision');
  await page.locator('#recipe-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,bodyShape:{...saved.bodyShape,muscularity:2}}))});
  await expect(page.locator('#error')).toContainText('muscularity');await expect(page.locator('#viewport')).toHaveAttribute('data-revision',before);
  await page.locator('#recipe-file').setInputFiles({name:'body.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  await expect(page.locator('#error')).toBeHidden();
  await page.locator('#motion').selectOption('歩行テスト');await page.locator('#timeline').fill('0.5');await page.locator('#timeline').dispatchEvent('input');
  await page.locator('#viewport canvas').screenshot({path:'output/human-body-muscular-walk.png'});
  const glb=page.waitForEvent('download');await page.locator('#export-glb').click();
  const bytes=await readFile(await (await glb).path());expect((await validateBytes(bytes)).issues.numErrors).toBe(0);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  expect(json.scenes[json.scene].extras.humanRecipe.bodyShape).toEqual(saved.bodyShape);
  const expected=createHuman(saved),geometry=expected.getObjectByName('BaseBody').geometry;geometry.computeBoundingBox();
  const bodyNode=json.nodes.find(n=>n.name==='BaseBody'),accessor=json.accessors[json.meshes[bodyNode.mesh].primitives[0].attributes.POSITION];
  expect(accessor.min).toEqual(geometry.boundingBox.min.toArray());expect(accessor.max).toEqual(geometry.boundingBox.max.toArray());disposeHuman(expected);
  expect(json.animations).toHaveLength(3);expect(json.skins).toHaveLength(3);
  await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('一時停止');
  await set('chestSize',.5);await expect(page.locator('#play')).toHaveText('一時停止');
  await page.locator('#play').click();await expect(page.locator('#model-stats')).toContainText('2,438 triangles');
  await expect(page.locator('#error')).toBeHidden();expect(errors).toEqual([]);
});
