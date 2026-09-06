import {test,expect} from '@playwright/test';

// Assert displayed pixels, not only data-proportion labels or distinct screenshots.
// Comparisons deliberately warm other proportions' caches during every draw.
test('autoplay never borrows frames from another proportion',async({page})=>{
  test.setTimeout(60_000);
  await page.clock.install();
  await page.goto('/sprite-lab.html');
  await page.locator('#ground').uncheck();
  await page.evaluate(async()=>{
    const {renderFrame,toRgba,SPEC,DIRECTIONS,PROPORTIONS}=await import('/sprites/walk.mjs');
    const expected=new Map();
    for(const p of PROPORTIONS) for(const d of DIRECTIONS) for(const colored of [true,false]) {
      for(let f=0;f<SPEC.frames;f++) {
        const rgba=toRgba(renderFrame(f/SPEC.frames,d.id,{proportion:p.id,colored}));
        expected.set(`${p.id}/${d.id}/${colored}/${f}`,rgba.data);
      }
    }
    window.checkSpritePixels=()=>{
      const stage=document.getElementById('stage');
      const {proportion,direction,frame}=stage.dataset;
      const colored=document.getElementById('colored').checked,errors=[];
      const compare=(id,p,f,x,y,height)=>{
        const canvas=document.getElementById(id);
        const actual=canvas.getContext('2d').getImageData(x,y,32,height).data;
        const reference=expected.get(`${p}/${direction}/${colored}/${f}`);
        let differentPixels=0;
        for(let i=0;i<actual.length;i+=4) {
          const wanted=reference[i+3]?reference.subarray(i,i+4):[17,27,34,255];
          if(wanted.some((value,c)=>actual[i+c]!==value)) differentPixels++;
        }
        if(differentPixels) errors.push({id,proportion:p,direction,frame:f,colored,differentPixels});
      };
      // Ground is disabled; omit the bottom area containing contact markers.
      compare('stage',proportion,Number(frame),48,8,42);
      for(let f=0;f<8;f++) compare('strip',proportion,f,f*32,0,47);
      for(const p of ['8head','4head','3head','2head']) compare(`compare-${p}`,p,Number(frame),0,0,48);
      return {frame:Number(frame),errors};
    };
  });
  for(const colored of [true,false]) {
    await page.locator('#colored').setChecked(colored);
    for(const proportion of ['8head','2head','3head','8head','4head','legacy','8head']) {
      await page.locator('#proportion').selectOption(proportion);
      for(const direction of ['s','sw','w','nw','n','ne','e','se']) {
        await page.locator('#direction').selectOption(direction);
        const frames=new Set();
        for(let step=0;step<32;step++) {
          await page.clock.runFor(50);
          const result=await page.evaluate(()=>window.checkSpritePixels());
          expect(result.errors).toEqual([]);
          frames.add(result.frame);
        }
        expect(frames.size).toBe(8);
      }
    }
  }
  // Negative control: replacing the selected 8-head frame with the 2-head
  // comparison must be detected even though the stage label still says 8head.
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  const corrupted=await page.evaluate(()=>{
    const stage=document.getElementById('stage');
    const other=document.getElementById('compare-2head');
    stage.getContext('2d').putImageData(other.getContext('2d').getImageData(0,0,32,48),48,8);
    return window.checkSpritePixels();
  });
  expect(corrupted.errors).toEqual([
    expect.objectContaining({id:'stage',proportion:'8head',differentPixels:expect.any(Number)}),
  ]);
  expect(corrupted.errors[0].differentPixels).toBeGreaterThan(0);
});
