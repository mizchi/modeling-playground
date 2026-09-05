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
