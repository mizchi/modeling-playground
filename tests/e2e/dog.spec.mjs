import { test, expect } from '@playwright/test';

for(const model of ['dog','corgi'])test(`${model} reads from all sides and plays the shared lightweight idle`,async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/?model=${model}`);
  await expect(page.locator('#model-name')).toHaveText(`${model}.glb`,{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#clip-select option')).toHaveText(['Idle','Rest']);
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Rest'});
  for(const [label,file] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/${model}-${file}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Idle'});
  await page.getByLabel('再生位置').fill('0');
  const initial=await page.locator('#viewport canvas').screenshot();
  await page.getByLabel('再生位置').fill('0.6');
  expect((await page.locator('#viewport canvas').screenshot({path:`output/${model}-idle.png`})).equals(initial)).toBe(false);
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await page.locator('#viewport canvas').screenshot({path:`output/${model}-rig.png`});
  await page.getByLabel('骨格を表示',{exact:true}).uncheck();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.locator('#viewport canvas').screenshot({path:`output/${model}-mobile.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});
