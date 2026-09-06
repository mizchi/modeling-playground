import { test, expect } from '@playwright/test';

test('production TPS route loads both robot assets under the Pages subdirectory',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto('./game.html');
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await expect(page.getByRole('button',{name:/出撃する/})).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe('/modeling-playground/game.html');
  await expect(page.getByRole('link',{name:'モデルビューアへ'})).toHaveAttribute('href','./index.html?model=strix');
  expect(errors).toEqual([]);
});
