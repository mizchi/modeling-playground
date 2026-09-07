import { test, expect } from '@playwright/test';
import { useDragLook, expectDragLookActive } from './game-input.mjs';

test.use({deviceScaleFactor:process.env.CI ? .5 : 1});
const telemetry=page=>page.locator('#enemy-telemetry').evaluate(n=>({hp:Number(n.dataset.playerHp),shots:Number(n.dataset.shots),hits:Number(n.dataset.hits),units:JSON.parse(n.dataset.units)}));

test('AI combat: moving enemies, incoming fire, player damage, pause, reset and training mode',async({page})=>{
  test.setTimeout(120_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/game.html');
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await expect(page.getByLabel('演習モード',{exact:true})).toHaveValue('combat');
  await useDragLook(page,false);
  await page.getByRole('button',{name:/出撃する/}).click();
  await expectDragLookActive(page);
  await expect.poll(async()=>{
    const state=await telemetry(page),enemy=state.units.find(u=>u.id==='B-01');
    return enemy?Math.hypot(enemy.position[0]+9,enemy.position[2]+9):0;
  },{timeout:15_000}).toBeGreaterThan(.5);
  await expect.poll(async()=>(await telemetry(page)).shots,{timeout:40_000}).toBeGreaterThan(0);
  await expect.poll(async()=>(await telemetry(page)).hp,{timeout:30_000}).toBeLessThan(1000);
  await page.screenshot({path:'output/game-enemy-ai.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('.arena')).toHaveAttribute('data-active','false');
  await page.waitForTimeout(400);const paused=await telemetry(page);
  await page.waitForTimeout(600);expect(await telemetry(page)).toEqual(paused);
  await page.getByRole('button',{name:'出発地点へ戻す',exact:true}).click();
  await expect.poll(async()=>(await telemetry(page)).hp).toBe(1000);
  await expect.poll(async()=>(await telemetry(page)).shots).toBe(0);
  await page.getByLabel('演習モード',{exact:true}).selectOption('training');
  await page.getByRole('button',{name:/操作を再開/}).click();
  await expectDragLookActive(page);await page.waitForTimeout(1500);
  const training=await telemetry(page);expect(training.hp).toBe(1000);expect(training.shots).toBe(0);
  expect(training.units.find(u=>u.id==='B-01').position).toEqual([-9,0,-9]);
  expect(errors).toEqual([]);
});
