import { expect } from '@playwright/test';

/** Native pointer lock warps the cursor differently on Linux/macOS runners.
 * Keep gameplay scenarios on real RMB-drag input; test the granted lock contract separately. */
export async function useDragLook(page,training=true) {
  if(training)await page.getByLabel('演習モード',{exact:true}).selectOption('training');
  await page.evaluate(()=>{
    document.querySelector('.arena').requestPointerLock=()=>Promise.reject(new Error('Deterministic E2E drag-look mode'));
  });
}

export async function expectDragLookActive(page) {
  await expect(page.locator('.arena')).toHaveAttribute('data-active','true');
  await expect(page.locator('.fallback-note')).toBeVisible();
}
