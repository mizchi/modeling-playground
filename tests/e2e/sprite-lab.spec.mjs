import {test,expect} from '@playwright/test';

test('sprite lab plays discrete frames, seeks, changes direction and exports real pixels',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/sprite-lab.html');
  const canvas=page.locator('#stage');
  await expect(canvas).toHaveAttribute('data-direction','w');
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.locator('#frame').fill('0');
  await expect(canvas).toHaveAttribute('data-frame','0');
  const first=await canvas.evaluate(c=>c.toDataURL());
  await page.getByRole('button',{name:'1コマ進む',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-frame','1');
  expect(await canvas.evaluate(c=>c.toDataURL())).not.toBe(first);
  await page.locator('#direction').selectOption('ne');
  await expect(canvas).toHaveAttribute('data-direction','ne');
  await page.getByLabel('骨格を重ねる').check();
  await page.getByLabel('左右の手足を色分け').uncheck();
  await page.getByRole('button',{name:'再生',exact:true}).click();
  await expect(canvas).not.toHaveAttribute('data-frame','1');
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.locator('#direction').selectOption('w');
  await page.getByLabel('左右の手足を色分け').check();
  await page.getByLabel('骨格を重ねる').uncheck();
  await page.locator('#frame').fill('2');
  await page.screenshot({path:'output/sprite-lab-preview.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const size=await canvas.evaluate(c=>({native:c.width,shown:c.clientWidth}));
  expect(size.shown%size.native).toBe(0);
  expect(errors).toEqual([]);
});

test('proportions stay synchronized, preserve phase, and remain usable on mobile',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/sprite-lab.html');
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.locator('#frame').fill('2');
  const stage=page.locator('#stage'),images=[];
  for(const id of ['8head','4head','3head','2head','legacy']) {
    await page.getByLabel('頭身',{exact:true}).selectOption(id);
    await expect(stage).toHaveAttribute('data-proportion',id);
    await expect(stage).toHaveAttribute('data-frame','2');
    images.push(await stage.evaluate(c=>c.toDataURL()));
    const metadata=await page.locator('#metadata-download').evaluate(async a=>(await fetch(a.href)).json());
    expect(metadata.proportion.id).toBe(id);
    for(const profile of ['8head','4head','3head','2head']) await expect(page.locator(`#compare-${profile}`)).toHaveAttribute('data-frame','2');
  }
  expect(new Set(images).size).toBe(5);
  await page.getByRole('button',{name:'8頭身を選択',exact:true}).click();
  await expect(page.locator('#head-mode')).toContainText('固定4×5px');
  await page.locator('#strip').screenshot({path:'output/sprite-8head-stable-walk.png'});
  await page.getByRole('button',{name:'2頭身を選択',exact:true}).click();
  await expect(stage).toHaveAttribute('data-proportion','2head');
  const comparison=page.locator('.comparison');
  for(const [direction,name] of [['w','side'],['s','front'],['ne','rear-quarter']]) {
    await page.locator('#direction').selectOption(direction);
    for(const profile of ['8head','4head','3head','2head']) await expect(page.locator(`#compare-${profile}`)).toHaveAttribute('data-direction',direction);
    await comparison.screenshot({path:`output/sprite-proportions-${name}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['compare-8head','compare-4head','compare-3head','compare-2head']) {
    await expect.poll(()=>page.locator(`#${id}`).evaluate(c=>c.clientWidth%c.width)).toBe(0);
  }
  const scales=await page.locator('.comparison canvas').evaluateAll(list=>list.map(c=>c.clientWidth/c.width));
  expect(new Set(scales).size).toBe(1);
  expect(errors).toEqual([]);
});
