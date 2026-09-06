import { test, expect } from '@playwright/test';
import { useDragLook, expectDragLookActive } from './game-input.mjs';

// Preserve CSS geometry and gameplay; reduce only framebuffer pixels on software-rendered CI.
test.use({deviceScaleFactor:process.env.CI ? 0.5 : 1});

const state=page=>page.locator('#pilot-telemetry').evaluate(node=>({x:Number(node.dataset.x),z:Number(node.dataset.z),yaw:Number(node.dataset.yaw),speed:Number(node.dataset.speed),boost:Number(node.dataset.boost)}));

test('IRON YARD: real GLBs, mouse-look, WASD, boost, pause, resume and reset',async({page})=>{
  test.setTimeout(90_000);
  const errors=[],assets=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().includes('.glb'))assets.push(response.url());});
  await page.goto('/game.html');
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await useDragLook(page);
  await expect(page.getByRole('heading',{name:'IRON YARD',exact:true})).toBeVisible();
  await page.screenshot({path:'output/game-deployment.png'});
  await page.getByRole('button',{name:/出撃する/}).click();
  await expectDragLookActive(page);
  await page.screenshot({path:'output/game-tps.png'});
  const initial=await state(page);
  expect(initial.yaw).toBe(0);
  await page.keyboard.down('w');
  await expect.poll(async()=>(await state(page)).z).toBeGreaterThan(initial.z+.8);
  await page.keyboard.up('w');
  await expect.poll(async()=>(await state(page)).speed).toBeLessThan(.05);
  const before=await state(page);
  await page.keyboard.down('d');
  await expect.poll(async()=>(await state(page)).x).toBeLessThan(before.x-.5);
  await page.keyboard.up('d');
  await page.keyboard.down('w');await page.keyboard.down('Shift');
  await expect.poll(async()=>(await state(page)).boost).toBeGreaterThan(.8);
  await expect.poll(async()=>(await state(page)).speed).toBeGreaterThan(10);
  await page.screenshot({path:'output/game-boost.png'});
  await page.keyboard.up('Shift');await page.keyboard.up('w');
  const looking=await state(page);
  const locked=await page.evaluate(()=>Boolean(document.pointerLockElement));
  if(!locked)await page.mouse.down({button:'right'});
  await page.mouse.move(900,340,{steps:8});
  if(!locked)await page.mouse.up({button:'right'});
  await expect.poll(async()=>Math.abs((await state(page)).yaw-looking.yaw)).toBeGreaterThan(.03);
  await page.keyboard.press('Escape');
  await expect(page.locator('.arena')).toHaveAttribute('data-active','false');
  const paused=await state(page);
  await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
  const still=await state(page);expect(still.x).toBeCloseTo(paused.x,3);expect(still.z).toBeCloseTo(paused.z,3);
  await page.getByRole('button',{name:'出発地点へ戻す',exact:true}).click();
  await expect.poll(async()=>(await state(page)).z).toBe(-36);
  await page.getByRole('button',{name:/操作を再開/}).click();
  await expect(page.locator('.arena')).toHaveAttribute('data-active','true');
  await page.waitForTimeout(200);expect((await state(page)).speed).toBe(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.arena')).toHaveAttribute('data-active','false');
  expect(assets.some(url=>url.includes('strix'))).toBe(true);
  expect(assets.some(url=>url.includes('bastion'))).toBe(true);
  expect(errors).toEqual([]);
});

test('IRON YARD menu fits a narrow screen and pointer-lock denial has a usable fallback',async({page})=>{
  await page.setViewportSize({width:700,height:700});
  await page.goto('/game.html');
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>{document.querySelector('.arena').requestPointerLock=()=>Promise.reject(new Error('Preview denies pointer lock'));});
  await page.getByRole('button',{name:/出撃する/}).click();
  await expect(page.locator('.fallback-note')).toBeVisible();
  await page.keyboard.down('w');
  await expect.poll(async()=>(await state(page)).z).toBeGreaterThan(-35.5);
  await page.keyboard.up('w');
  const before=await state(page);
  await page.mouse.move(340,300);await page.mouse.down({button:'right'});await page.mouse.move(420,320,{steps:5});await page.mouse.up({button:'right'});
  await expect.poll(async()=>Math.abs((await state(page)).yaw-before.yaw)).toBeGreaterThan(.1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.arena')).toHaveAttribute('data-active','false');
});
