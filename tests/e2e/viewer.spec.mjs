import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const town = fileURLToPath(new URL('../../output/little-town.glb', import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto('/?model=little-town');
  await expect(page.locator('#status')).toHaveText('表示中');
});

test('town renders and view/display controls change the canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('#dimensions')).toHaveText('28.12 × 10.60 × 24.19 m');
  const original = await page.locator('canvas').screenshot();
  await page.getByRole('button', { name: '上面', exact: true }).click();
  await expect(page.getByRole('button', { name: '上面', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await page.locator('canvas').screenshot()).equals(original)).toBe(false);
  await page.getByRole('checkbox', { name: 'ワイヤーフレーム' }).check();
  await expect(page.getByRole('checkbox', { name: 'ワイヤーフレーム' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'グリッド', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'グリッド', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '全体を表示 F' }).click();
  await expect(page.getByRole('button', { name: '斜め', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('file selection, invalid file recovery, and town reload', async ({ page }) => {
  const input = page.getByLabel('GLBファイルを選択');
  await input.setInputFiles(town);
  await expect(page.locator('#status')).toHaveText('表示中');
  await input.setInputFiles({ name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('invalid glb') });
  await expect(page.getByRole('alert')).toContainText('有効なGLB');
  await expect(page.locator('#status')).toHaveText('前のモデルを表示中');
  await expect(page.locator('#model-name')).toHaveText('little-town.glb');
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.getByRole('alert')).toBeHidden();
});

test('shared viewer switches assets, reloads the active model, and accepts deep links', async ({ page }) => {
  await page.getByLabel('モデルを選択').selectOption('traveler');
  await expect(page.locator('#model-name')).toHaveText('traveler.glb');
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page).toHaveURL(/model=traveler/);
  await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#model-name')).toHaveText('traveler.glb');
  await page.reload();
  await expect(page.locator('#model-name')).toHaveText('traveler.glb');
  await expect(page.locator('#status')).toHaveText('表示中');
  await page.getByLabel('モデルを選択').selectOption('little-town');
  await expect(page.locator('#model-name')).toHaveText('little-town.glb');
  await expect(page.locator('#status')).toHaveText('表示中');
});

test('mobile viewport has a usable canvas and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.locator('canvas').boundingBox();
  expect(box.width).toBe(390);
  expect(box.height).toBeGreaterThan(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await expect(page.getByRole('button', { name: '正面', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('walking model can pause, scrub, change speed and return to a static model', async ({ page }) => {
  await page.getByLabel('モデルを選択').selectOption('traveler-walk');
  await expect(page.locator('#model-name')).toHaveText('traveler-walk.glb');
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await expect(page.getByRole('button',{name:'再生',exact:true})).toBeVisible();
  const time = await page.locator('#animation-time').textContent();
  await page.waitForTimeout(180);
  await expect(page.locator('#animation-time')).toHaveText(time);
  const before = await page.locator('canvas').screenshot();
  await page.getByLabel('再生位置').fill('0.6');
  await expect(page.locator('#animation-time')).toHaveText('0.60 / 1.20 s');
  expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
  await page.getByLabel('再生速度').selectOption('0.5');
  await page.getByRole('checkbox',{name:'骨格を表示'}).check();
  await expect(page.getByRole('checkbox',{name:'骨格を表示'})).toBeChecked();
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(page.getByRole('button',{name:'一時停止',exact:true})).toBeVisible();
  await page.getByLabel('モデルを選択').selectOption('little-town');
  await expect(page.locator('#model-name')).toHaveText('little-town.glb');
  await expect(page.locator('#animation-panel')).toBeHidden();
});

test('IK handles can be dragged, crouched, reset, and switched to FK', async ({page})=>{
  await page.getByLabel('モデルを選択').selectOption('traveler-ik');
  await expect(page.locator('#model-name')).toHaveText('traveler-ik.glb');
  const hand=page.getByRole('button',{name:'左手ターゲット',exact:true});
  await expect(hand).toBeVisible();
  const initial=await page.locator('canvas').screenshot();
  const box=await hand.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2-12,box.y+box.height/2-50,{steps:12});
  await page.mouse.up();
  await expect(page.getByLabel('操作対象')).toHaveValue('leftHand');
  expect((await page.locator('canvas').screenshot()).equals(initial)).toBe(false);
  await page.getByRole('button',{name:'しゃがむ',exact:true}).click();
  await expect(page.locator('#ik-status')).toContainText('追従');
  await page.getByLabel('制御方式').selectOption('FK');
  await expect(hand).toBeHidden();
  await page.getByLabel('FK関節').selectOption('LeftUpperArm');
  await page.getByLabel('関節 X').fill('25');
  await page.getByRole('button',{name:'ポーズをリセット',exact:true}).click();
  await expect(page.getByLabel('制御方式')).toHaveValue('IK');
  await expect(hand).toBeVisible();
  await page.getByLabel('モデルを選択').selectOption('little-town');
  await expect(page.locator('#ik-panel')).toBeHidden();
  await expect(hand).toHaveCount(0);
});

test('Suzu renders through the shared viewer, including a face close-up and mobile',async ({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.getByLabel('モデルを選択').selectOption('suzu');
  await expect(page.locator('#model-name')).toHaveText('suzu.glb');
  await expect(page.locator('#animation-panel')).toBeHidden();
  await expect(page.locator('#ik-panel')).toBeHidden();
  await page.getByRole('button',{name:'正面',exact:true}).click();
  await page.screenshot({path:'output/suzu-front.png'});
  const canvas=page.locator('canvas'),rect=await canvas.boundingBox();
  await canvas.dblclick({position:{x:rect.width*.5,y:rect.height*.24}});
  await expect(page.locator('#selection')).toContainText('Head');
  await page.screenshot({path:'output/suzu-face.png'});
  await page.getByRole('button',{name:'全体を表示 F'}).click();
  await page.screenshot({path:'output/suzu-viewer.png'});
  await page.getByRole('button',{name:'側面',exact:true}).click();
  await expect(page.getByRole('button',{name:'側面',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'output/suzu-side.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#model-name')).toHaveText('suzu.glb');
  expect(errors).toEqual([]);
});
