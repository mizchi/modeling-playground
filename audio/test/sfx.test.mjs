import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX_PRESETS } from '../src/sfx-presets.mjs';
import { renderSfx, addOneShotReflections } from '../src/sfx.mjs';

test('five effects render repeatably, without clipping or a truncated release',()=>{
  assert.deepEqual(SFX_PRESETS.map(p=>p.id),['explosion','confirm','cancel','sword-hit','blunt-hit']);
  for(const preset of SFX_PRESETS) {
    const channels=renderSfx(preset,24000);
    assert.equal(channels.length,2);
    assert.deepEqual(channels,renderSfx(preset,24000));
    for(const channel of channels) {
      assert.equal(channel.length,Math.round(preset.duration*24000));
      assert.equal(channel[0],0);
      assert.ok(channel.at(-1)===0);
      assert.ok(channel.every(Number.isFinite));
      const peak=channel.reduce((max,n)=>Math.max(max,Math.abs(n)),0);
      assert.ok(peak>.1 && peak<=preset.peak+1e-6);
      const tail=channel.slice(-240);
      assert.ok(Math.sqrt(tail.reduce((sum,x)=>sum+x*x,0)/tail.length)<.002);
    }
  }
});

test('one-shot reflections never fold late audio back into the beginning',()=>{
  const channels=[Float32Array.from([0,0,1,0]),Float32Array.from([0,0,1,0])];
  addOneShotReflections(channels,[{delay:.2,gain:.5}],10);
  assert.deepEqual([...channels[0]],[0,0,1,0]);
});

test('sword impact has a sharper attack spectrum than the blunt impact',()=>{
  const roughness=id=>{
    const pcm=renderSfx(SFX_PRESETS.find(p=>p.id===id),24000)[0].slice(0,2400);
    let power=0,difference=0;
    for(let i=1;i<pcm.length;i++){power+=pcm[i]**2;difference+=(pcm[i]-pcm[i-1])**2;}
    return difference/power;
  };
  assert.ok(roughness('sword-hit')>roughness('blunt-hit')*2);
});

test('UI sounds have opposite pitch directions',()=>{
  const estimate=(id,start,end)=>{
    const signal=renderSfx(SFX_PRESETS.find(p=>p.id===id),24000)[0];
    let crossings=0;
    for(let i=Math.ceil(start*24000)+1;i<end*24000;i++) if(signal[i-1]<0 && signal[i]>=0) crossings++;
    return crossings/(end-start);
  };
  assert.ok(estimate('confirm',.09,.13)>estimate('confirm',.01,.04)*1.25);
  assert.ok(estimate('cancel',.10,.15)<estimate('cancel',.01,.04)*.8);
});
