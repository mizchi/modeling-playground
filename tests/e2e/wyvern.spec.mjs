import { test, expect } from '@playwright/test';

test('wyvern loads as a standalone low-poly asset and reads from multiple angles',async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=wyvern');
  await expect(page.locator('#model-name')).toHaveText('wyvern.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#clip-select option')).toHaveText(['Hover','Rest']);
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Rest'});
  for(const [label,id] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back'],['上面','top']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/wyvern-${id}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#viewport canvas').screenshot({path:'output/wyvern-mobile.png'});
  expect(errors).toEqual([]);
});

test('wyvern wingbeat plays, seeks, loops and shows its actual skeleton',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=wyvern');
  await expect(page.locator('#model-name')).toHaveText('wyvern.glb',{timeout:15_000});
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  const frames=[];
  for(const [time,label] of [[0,'up'],[.45,'downstroke'],[.9,'down'],[1.35,'recovery'],[1.5,'curl']]) {
    await page.getByLabel('再生位置').fill(String(time));
    frames.push(await page.locator('#viewport canvas').screenshot({path:`output/wyvern-hover-${label}.png`}));
  }
  expect(frames.slice(1).every(frame=>!frame.equals(frames[0]))).toBe(true);
  for(const [label,file] of [['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/wyvern-hover-curl-${file}.png`});
  }
  await page.getByLabel('再生位置').fill('0');
  for(const [label,file] of [['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/wyvern-hover-${file}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await page.locator('#viewport canvas').screenshot({path:'output/wyvern-hover-rig.png'});
  await page.getByLabel('骨格を表示',{exact:true}).uncheck();
  await page.getByLabel('再生位置').fill('1.78');
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect.poll(async()=>Number(await page.getByLabel('再生位置').inputValue())).toBeLessThan(1);
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
