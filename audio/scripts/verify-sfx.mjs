import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const output=new URL('../output/sfx/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',output)));
assert.equal(manifest.effects.length,5);
const report=[];
for(const item of [...manifest.effects,manifest.demo]) {
  const data=await readFile(new URL(`${item.name}.wav`,output));
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WAVE');
  assert.equal(data.readUInt32LE(24),48000);
  assert.equal(data.readUInt16LE(22),2);
  assert.equal(data.readUInt16LE(34),16);
  assert.equal(data.readUInt32LE(40),item.frames*4);
  assert.equal(data.length,44+item.frames*4);
  let peak=0,power=0;
  for(let i=44;i<data.length;i+=2) {
    const sample=data.readInt16LE(i)/32768;
    peak=Math.max(peak,Math.abs(sample));power+=sample*sample;
  }
  assert.ok(peak>.1 && peak<.9);
  if(item.targetPeak) assert.ok(Math.abs(peak-item.targetPeak)<.00005);
  for(let c=0;c<2;c++) {
    assert.equal(data.readInt16LE(44+c*2),0);
    assert.equal(data.readInt16LE(data.length-4+c*2),0);
  }
  let tailPower=0;
  for(let i=data.length-480*4;i<data.length;i+=2) tailPower+=(data.readInt16LE(i)/32768)**2;
  const tailRms=Math.sqrt(tailPower/960);
  assert.ok(tailRms<.002,'Quiet release');
  const decoded=spawnSync('ffmpeg',['-v','error','-i',fileURLToPath(new URL(`${item.name}.mp3`,output)),'-f','null','-'],{encoding:'utf8'});
  assert.equal(decoded.status,0,decoded.stderr);
  report.push({name:item.name,duration:item.frames/48000,peakDb:20*Math.log10(peak),
    rms:Math.sqrt(power/(item.frames*2)),tailRms,checks:'passed'});
}
await writeFile(new URL('verification.json',output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
