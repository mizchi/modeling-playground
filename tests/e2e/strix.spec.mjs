import { test, expect } from '@playwright/test';
import { STRIX_GAIT } from '../../models/strix-definition.mjs';

test('Strix: low four-legged rig, multi-view inspection, diagonal trot and forward travel',async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=strix');
  await expect(page.locator('#model-name')).toHaveText('strix.glb',{timeout:15_000});
  await expect(page.locator('#clip-select option')).toHaveText(['Idle','Walk','Advance']);
  await expect(page.locator('#assembly-panel')).toBeHidden();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.getByLabel('再生位置').fill('0');
  for(const [name,file] of [['斜め','quarter'],['正面','front'],['側面','side'],['背面','back'],['上面','top']]) {
    await page.getByRole('button',{name,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/strix-${file}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Walk'});
  const frames=[];
  // Mid-swing of each diagonal pair, plus overlap and rest phases.
  for(const time of [0,.74,1.20,1.94,2.30]) {
    await page.getByLabel('再生位置').fill(String(time));
    frames.push(await page.locator('#viewport canvas').screenshot({path:`output/strix-walk-${Math.round(time*100)}.png`}));
  }
  expect(frames.slice(1).every(f=>!f.equals(frames[0]))).toBe(true);
  await page.getByLabel('骨格を表示',{exact:true}).check();
  await page.locator('#viewport canvas').screenshot({path:'output/strix-rig.png'});
  await page.getByLabel('骨格を表示',{exact:true}).uncheck();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Advance'});
  await page.getByLabel('再生位置').fill(String(STRIX_GAIT.duration-.01));
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'再生',exact:true})).toBeVisible();
  await expect(page.locator('#animation-time')).toHaveText(`${STRIX_GAIT.duration.toFixed(2)} / ${STRIX_GAIT.duration.toFixed(2)} s`);
  await page.locator('#viewport canvas').screenshot({path:'output/strix-advance.png'});
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
