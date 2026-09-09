import { test, expect } from '@playwright/test';

test('studio distribution loads models and audio from a deployment subdirectory',async({page})=>{
  const failures:string[]=[],errors:string[]=[],assets:string[]=[];
  page.on('response',r=>{if(r.status()>=400)failures.push(r.url());if(/\.(glb|wav)(\?|$)/.test(r.url()))assets.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('scene-editor.html');
  await expect(page.getByRole('heading',{name:'SCENE STUDIO'})).toBeVisible();
  await expect(page.getByRole('region',{name:'シーンプレビュー'})).toHaveAttribute('data-ready','true',{timeout:30_000});
  await page.screenshot({path:'test-results/studio-production.png'});
  await page.getByRole('button',{name:'試遊',exact:true}).click();
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await page.evaluate(()=>{(document.querySelector('.arena') as HTMLElement).requestPointerLock=()=>Promise.reject(new Error('Preview'));});
  await page.getByRole('button',{name:/出撃する/}).click();
  await expect(page.locator('#audio-telemetry')).toHaveAttribute('data-ready','true',{timeout:20_000});
  await expect(page.locator('#audio-telemetry')).toHaveAttribute('data-playing','true');
  expect(assets.filter(url=>url.includes('/modeling-playground/assets/')&&url.endsWith('.wav')).length).toBe(6);
  expect(assets.some(url=>url.includes('strix'))).toBe(true);
  expect(failures).toEqual([]);expect(errors).toEqual([]);
});
