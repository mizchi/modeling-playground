import { test, expect } from '@playwright/test';
import { createLumi } from '../../models/lumi.mjs';
import { exportGlb } from '../../scripts/export_glb.mjs';

for(const [view,name] of [['正面','front'],['斜め','quarter'],['側面','side'],['背面','back']]) {
  test(`LUMI fitted hair: ${name}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/?model=lumi');await expect(page.locator('#model-name')).toHaveText('lumi.glb',{timeout:15_000});
    await expect(page.locator('#status')).toHaveText('表示中');
    const canvas=page.locator('#viewport canvas');
    await page.getByRole('button',{name:view,exact:true}).click();await canvas.screenshot({path:`output/lumi-${name}.png`});
    expect(errors).toEqual([]);
  });
}

async function exportHeadInspection() {
  // Export a diagnostic head/neck crop; hair stays attached to the real bones.
  const root=createLumi(),body=root.getObjectByName('BaseBody'),g=body.geometry,p=g.attributes.position;
  const indices=[];
  for(let i=0;i<g.index.count;i+=3) {
    const f=[0,1,2].map(k=>g.index.getX(i+k));if(f.every(v=>p.getY(v)>1.62))indices.push(...f);
  }
  g.setIndex(indices);delete body.userData.quadTopology;
  // Bounds use all vertices: collapse unused crop vertices onto a retained one.
  const used=new Set(indices),sample=indices[0];
  for(let i=0;i<p.count;i++)if(!used.has(i))p.setXYZ(i,p.getX(sample),p.getY(sample),p.getZ(sample));
  g.computeBoundingBox();g.computeBoundingSphere();
  return Buffer.from(await exportGlb(root));
}

for(const [yaw,pitch,name] of [[0,0,'face-front'],[40,0,'face-quarter'],[-40,0,'face-right'],[90,0,'face-side'],[-90,0,'face-left-side'],[145,20,'hair-back-high'],[180,0,'hair-back'],[145,-25,'hair-back-low'],[180,-25,'hair-under-back'],[40,25,'face-high'],[40,-30,'face-low']]) {
  test(`LUMI head inspection: ${name}`,async({page})=>{
    test.setTimeout(60_000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const bytes=await exportHeadInspection();
    await page.route('**/output/lumi.glb*',route=>route.request().resourceType()==='fetch'
      ?route.fulfill({status:200,contentType:'model/gltf-binary',body:bytes}):route.continue());
    await page.goto('/?model=lumi');await expect(page.locator('#model-name')).toHaveText('lumi.glb',{timeout:15_000});
    await expect(page.locator('#status')).toHaveText('表示中');
    const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();
    await page.getByRole('button',{name:'正面',exact:true}).click();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x-box.height*yaw/360,y+box.height*pitch/360,{steps:12});await page.mouse.up();
    let previous;
    // Orbit damping converges per rendered frame; software WebGL needs more wall time.
    // Keep exact pixel stability as the gate, with a separate budget for each angle.
    await expect.poll(async()=>{const current=await canvas.screenshot(),stable=previous?.equals(current);previous=current;return stable;},{timeout:30_000,intervals:[200,300]}).toBe(true);
    await canvas.screenshot({path:`output/lumi-${name}.png`});
    expect(errors).toEqual([]);
  });
}
