import { test, expect } from '@playwright/test';
const value=(page,key)=>page.locator('#combat-telemetry').getAttribute(`data-${key}`).then(Number);
test('live fire: rifle, multi-lock salvo, damage, pause cancellation and target reset',async({page})=>{
  test.setTimeout(120_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/game.html');
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await page.getByRole('button',{name:/出撃する/}).click();
  // Aim through the visible HUD using normal mouse controls, not injected combat state.
  await page.mouse.move(640,450);
  for(let i=0;i<4;i++) {
    const box=await page.locator('[data-target="B-01"]').boundingBox();expect(box).not.toBeNull();
    const dx=box.x+box.width/2-640,dy=box.y+box.height/2-450;
    if(Math.hypot(dx,dy)<8)break;
    await page.mouse.down({button:'right'});await page.mouse.move(640+dx*.6,450+dy,{steps:5});await page.mouse.up({button:'right'});
    await page.waitForTimeout(250);await page.mouse.move(640,450);
  }
  await page.mouse.down();
  await expect.poll(async()=>JSON.parse(await page.locator('#combat-telemetry').getAttribute('data-hp'))['B-01'],{timeout:5000}).toBeLessThan(180);
  await page.mouse.up();
  await page.keyboard.down('e');
  await expect.poll(()=>value(page,'locked'),{timeout:10_000}).toBeGreaterThanOrEqual(2);
  await page.screenshot({path:'output/game-lock.png'});
  await page.keyboard.up('e');
  await expect.poll(()=>value(page,'missiles'),{timeout:10_000}).toBeGreaterThanOrEqual(4);
  await page.screenshot({path:'output/game-missiles.png'});
  await expect.poll(()=>value(page,'hits'),{timeout:20_000}).toBeGreaterThan(0);
  await page.keyboard.down('e');
  await expect.poll(()=>value(page,'locked'),{timeout:15_000}).toBeGreaterThanOrEqual(2);
  await page.keyboard.up('e');
  await expect.poll(()=>value(page,'kills'),{timeout:20_000}).toBeGreaterThan(0);
  await page.keyboard.down('e');await page.keyboard.press('Escape');await page.keyboard.up('e');
  await expect(page.locator('.arena')).toHaveAttribute('data-active','false');
  const shots=await value(page,'shots'),missiles=await value(page,'missiles');
  await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();
  expect(await value(page,'shots')).toBe(shots);expect(await value(page,'missiles')).toBe(missiles);
  await page.getByRole('button',{name:'出発地点へ戻す',exact:true}).click();
  await expect.poll(()=>value(page,'shots')).toBe(0);await expect.poll(()=>value(page,'kills')).toBe(0);
  await expect(page.locator('#combat-telemetry')).toHaveAttribute('data-hp','{"B-01":180,"B-02":180,"B-03":180}');
  await page.getByRole('button',{name:/操作を再開/}).click();await page.waitForTimeout(300);
  expect(await value(page,'missiles')).toBe(0);expect(await value(page,'shots')).toBe(0);
  expect(errors).toEqual([]);
});
