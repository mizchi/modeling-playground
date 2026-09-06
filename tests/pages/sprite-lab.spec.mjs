import {test,expect} from '@playwright/test';

test('production sprite lab serves its atlas and metadata under the Pages subdirectory',async({page,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./sprite-lab.html');
  await expect(page.locator('#stage')).toHaveAttribute('data-direction','w');
  for(const proportion of ['8head','4head','3head','2head','legacy']) {
    await page.locator('#proportion').selectOption(proportion);
    for(const id of ['debug-download','neutral-download']) {
      const url=await page.locator(`#${id}`).evaluate(a=>a.href);
      const response=await request.get(url);expect(response.ok()).toBe(true);
      const bytes=await response.body();
      expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(256);expect(bytes.readUInt32BE(20)).toBe(384);
      expect(bytes[25]).toBe(6); // RGBA PNG, not a painted checkerboard.
    }
    const metadata=await page.locator('#metadata-download').evaluate(async a=>(await fetch(a.href)).json());
    expect(metadata.proportion.id).toBe(proportion);
    expect(metadata.headRendering.mode).toBe(proportion==='8head'?'pixel-part':'projected-3d');
    expect(metadata.rows.map(row=>row.id)).toEqual(['s','sw','w','nw','n','ne','e','se']);
    expect(metadata.columns).toBe(8);expect(metadata.phases).toHaveLength(8);
  }
  expect(errors).toEqual([]);
});
