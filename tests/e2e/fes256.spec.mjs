import { test,expect } from '@playwright/test';

test('FES-inspired character renders from all sides and switches texture expressions',async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=fes256');
  await expect(page.locator('#model-name')).toHaveText('fes256.glb',{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#expression-select option')).toHaveText(['通常','笑顔','怒り','驚き','まばたき','ウインク']);
  await expect(page.locator('#animation-panel')).toBeHidden();
  for(const [label,file] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/fes256-${file}.png`});
  }
  await page.getByRole('button',{name:'正面',exact:true}).click();
  const neutral=await page.locator('#viewport canvas').screenshot(),frames=[];
  for(const label of ['Happy','Angry','Surprised','Blink','Wink','Neutral']) {
    await page.getByLabel('表情を選択').selectOption(label);
    const frame=await page.locator('#viewport canvas').screenshot({path:`output/fes256-${label.toLowerCase()}.png`});
    if(label==='Neutral')expect(frame.equals(neutral)).toBe(true);
    else {expect(frame.equals(neutral)).toBe(false);expect(frames.every(other=>!other.equals(frame))).toBe(true);frames.push(frame);}
  }
  await page.getByLabel('表情を自動再生',{exact:true}).check();
  await expect(page.getByLabel('表情を選択')).not.toHaveValue('Neutral');
  await page.getByLabel('表情を自動再生',{exact:true}).uncheck();
  await page.getByLabel('表情を選択').selectOption('Neutral');
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await page.locator('#viewport canvas').screenshot({path:'output/fes256-rig.png'});
  await page.getByLabel('骨格を表示',{exact:true}).uncheck();
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
  await canvas.dblclick({position:{x:box.width*.5,y:box.height*.26}});
  await expect(page.locator('#selection')).toContainText('Head');
  await canvas.screenshot({path:'output/fes256-face.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).check();
  await canvas.screenshot({path:'output/fes256-face-wire.png'});
  await page.getByLabel('ワイヤーフレーム',{exact:true}).uncheck();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.locator('#viewport canvas').screenshot({path:'output/fes256-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.getByLabel('モデルを選択').selectOption('corgi');
  await expect(page.locator('#expression-panel')).toBeHidden();
});
