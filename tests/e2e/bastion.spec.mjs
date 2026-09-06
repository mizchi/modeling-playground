import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Bastion: multi-view inspection, part swaps and standalone assembly export',async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=bastion');
  await expect(page.locator('#model-name')).toHaveText('bastion.glb',{timeout:15_000});
  await expect(page.locator('#assembly-panel')).toBeVisible();
  await expect(page.locator('#assembly-fields select')).toHaveCount(11);
  for(const [label,id] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/bastion-${id}.png`});
  }
  // Check the rear-quarter thickness and the opposite flank, not just the front.
  const canvas=page.locator('#viewport canvas'),rect=await canvas.boundingBox();
  for(const [preset,offset,id] of [['背面',rect.height/12,'rear-quarter'],['側面',rect.height/2,'opposite-side']]) {
    await page.getByRole('button',{name:preset,exact:true}).click();
    await page.mouse.move(rect.x+rect.width*.25,rect.y+rect.height*.65);await page.mouse.down();
    await page.mouse.move(rect.x+rect.width*.25+offset,rect.y+rect.height*.65,{steps:12});await page.mouse.up();
    await page.waitForTimeout(350);
    await canvas.screenshot({path:`output/bastion-${id}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  const before=await page.locator('#viewport canvas').screenshot();
  await page.getByLabel('頭部', {exact:true}).selectOption('command');
  await page.getByLabel('左手武装',{exact:true}).selectOption('rifle');
  await page.getByLabel('右肩武装',{exact:true}).selectOption('none');
  await expect(page.locator('#assembly-status')).toContainText('右肩武装');
  const after=await page.locator('#viewport canvas').screenshot({path:'output/bastion-custom.png'});
  expect(before.equals(after)).toBe(false);
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'構成をGLBで保存'}).click();
  const download=await downloadEvent;
  const bytes=await readFile(await download.path());
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const assembly=json.nodes.find(n=>n.extras?.modelId==='bastion');
  expect(assembly.extras.loadout.head).toBe('command');
  expect(assembly.extras.loadout.rightShoulder).toBe('none');
  await page.getByLabel('GLBファイルを選択').setInputFiles({name:'bastion-custom.glb',mimeType:'model/gltf-binary',buffer:bytes});
  await expect(page.locator('#model-name')).toHaveText('bastion-custom.glb');
  await expect(page.getByLabel('頭部',{exact:true})).toHaveValue('command');
  await page.getByRole('button',{name:'標準構成に戻す'}).click();
  await expect(page.getByLabel('頭部',{exact:true})).toHaveValue('sensor');
  await page.getByLabel('モデルを選択').selectOption('raven');
  await expect(page.locator('#model-name')).toHaveText('raven.glb',{timeout:15_000});
  await expect(page.locator('#assembly-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Bastion assembly remains usable on a narrow viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?model=bastion');
  await expect(page.locator('#model-name')).toHaveText('bastion.glb',{timeout:15_000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('左脚',{exact:true}).selectOption('field');
  await expect(page.getByLabel('右脚',{exact:true})).toHaveValue('siege');
  await expect(page.locator('#assembly-status')).toContainText('左脚');
});
