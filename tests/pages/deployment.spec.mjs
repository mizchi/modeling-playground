import { test, expect } from '@playwright/test';

async function expectModelReady(page,filename) {
  // Model loading includes GLB parsing and WebGL startup, not just navigation.
  // Bound that wait independently of fast UI assertions and check real success.
  await expect(page.locator('#model-name')).toHaveText(filename,{timeout:15_000});
  await expect(page.locator('#status')).toHaveText('表示中');
  await expect(page.locator('#error')).toBeHidden();
}

test('production site loads every GLB under the Pages subdirectory',async({page})=>{
  const errors=[];
  const sidecars=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  page.on('response',response=>{if(/raven\.asset(?:-[^/]+)?\.json(?:\?|$)/.test(response.url()))sidecars.push(response);});
  await page.goto('./?model=suzu');
  await expectModelReady(page,'suzu.glb');
  const models=['traveler','traveler-walk','traveler-ik','little-town','raven','ashley','suzu'];
  for(const model of models) {
    await page.getByLabel('モデルを選択').selectOption(model);
    await expectModelReady(page,model+'.glb');
    expect(new URL(page.url()).pathname).toMatch(/\/modeling-playground\/$/);
  }
  // Consume the response while its document is still alive, before reload.
  expect(sidecars.length).toBeGreaterThan(0);
  expect((await sidecars[0].json()).id).toBe('raven');
  // Exercise a real reload that exceeds Playwright's default 5-second assertion
  // timeout. CI also needs time for GLB parsing and software WebGL initialization.
  let delayedLoads=0;
  await page.route('**/suzu*.glb*',async route=>{
    delayedLoads++;
    const response=await route.fetch();
    await new Promise(resolve=>setTimeout(resolve,6_000));
    await route.fulfill({response});
  });
  await page.reload();
  await expectModelReady(page,'suzu.glb');
  expect(delayedLoads).toBe(1);
  await page.getByRole('button',{name:'側面',exact:true}).click();
  await expect(page.getByRole('button',{name:'側面',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});
