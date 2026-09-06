import { test, expect } from '@playwright/test';
import { STRIX_GAIT, STRIX_BOOST } from '../../models/strix-definition.mjs';

test('Strix: low four-legged rig, multi-view inspection, diagonal trot and forward travel',async({page})=>{
  test.setTimeout(60_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=strix');
  await expect(page.locator('#model-name')).toHaveText('strix.glb',{timeout:15_000});
  await expect(page.locator('#clip-select option')).toHaveText(['Idle','Walk','Advance','Boost']);
  await expect(page.locator('#assembly-panel')).toBeHidden();
  await page.getByLabel('IKハンドルを表示').uncheck();
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

test('Strix Boost: multi-view flight, IK takeover, reset, FK, seek and one-shot replay',async({page})=>{
  test.setTimeout(90_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?model=strix');
  await expect(page.locator('#model-name')).toHaveText('strix.glb',{timeout:15_000});
  await expect(page.locator('#ik-panel')).toBeVisible();
  await expect(page.locator('#ik-target option')).toHaveCount(9);
  await page.getByLabel('IKハンドルを表示').uncheck();
  await page.getByLabel('アニメーションを選択').selectOption({label:'Boost'});
  await page.getByLabel('再生位置').fill('1.4');
  for(const [name,file] of [['斜め','quarter'],['側面','side'],['背面','back'],['上面','top']]) {
    await page.getByRole('button',{name,exact:true}).click();
    await page.locator('#viewport canvas').screenshot({path:`output/strix-boost-${file}.png`});
  }
  await page.getByRole('button',{name:'斜め',exact:true}).click();
  for(const t of [.25,.55,2.35,2.85,3.2]) {
    await page.getByLabel('再生位置').fill(String(t));
    await page.locator('#viewport canvas').screenshot({path:`output/strix-boost-${Math.round(t*100)}.png`});
  }
  await page.getByLabel('再生位置').fill('1.4');
  const initial=await page.locator('#viewport canvas').screenshot({path:test.info().outputPath('ik-initial.png')});
  await page.getByLabel('操作対象').selectOption('FrontLeft');
  const y=Number(await page.getByLabel('ターゲット Y').inputValue());
  await page.getByLabel('ターゲット Y').fill(String(Math.round((y+.2)*100)/100));
  await expect(page.getByRole('button',{name:'再生',exact:true})).toBeVisible();
  await expect(page.locator('#ik-status')).toContainText('追従');
  expect((await page.locator('#viewport canvas').screenshot()).equals(initial)).toBe(false);
  await page.getByRole('button',{name:'ポーズをリセット',exact:true}).click();
  expect((await page.locator('#viewport canvas').screenshot()).equals(initial)).toBe(true);
  await page.getByRole('button',{name:'しゃがむ',exact:true}).click();
  await expect(page.locator('#ik-status')).toContainText('追従');
  await page.getByRole('button',{name:'ポーズをリセット',exact:true}).click();
  expect((await page.locator('#viewport canvas').screenshot({path:test.info().outputPath('ik-reset.png')})).equals(initial)).toBe(true);
  // Pointer takeover of a current animation frame, rather than the rest pose.
  await page.getByLabel('IKハンドルを表示').check();
  const foot=page.getByRole('button',{name:'前左足ターゲット',exact:true});
  const box=await foot.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+15,box.y+box.height/2-20,{steps:8});
  await page.mouse.up();
  await expect(page.getByLabel('操作対象')).toHaveValue('FrontLeft');
  await expect(page.locator('#ik-status')).toContainText('追従');
  await page.locator('#viewport').screenshot({path:'output/strix-boost-ik.png'});
  await page.getByLabel('制御方式').selectOption('FK');
  await expect(foot).toBeHidden();
  await page.getByLabel('FK関節').selectOption('FrontLeftLower');
  await page.getByLabel('関節 X').fill('15');
  await page.getByLabel('再生位置').fill('1.4');
  await expect(page.getByLabel('制御方式')).toHaveValue('IK');
  await page.getByLabel('IKハンドルを表示').uncheck();
  expect((await page.locator('#viewport canvas').screenshot()).equals(initial)).toBe(true);
  await page.getByLabel('再生位置').fill((STRIX_BOOST.duration-.01).toFixed(2));
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'再生',exact:true})).toBeVisible();
  await expect(page.locator('#animation-time')).toHaveText('3.20 / 3.20 s');
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  await page.getByLabel('IKハンドルを表示').check();
  await expect(foot).toBeHidden();
  expect(errors).toEqual([]);
});
