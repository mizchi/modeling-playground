import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=new URL('../output/',import.meta.url);
const manifestName=process.argv[2] ?? 'manifest.json';
const manifest=JSON.parse(await readFile(new URL(manifestName,output)));
const report=[];
for (const item of manifest) {
  const wav=await readFile(new URL(`${item.name}.wav`,output));
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt32LE(24),44100);
  assert.equal(wav.readUInt16LE(22),2);
  assert.equal(wav.readUInt32LE(40),item.frames*4);
  assert.equal(wav.length,44+item.frames*4);
  let peak=0,power=0;
  for (let i=44;i<wav.length;i+=2) {const v=wav.readInt16LE(i)/32768; peak=Math.max(peak,Math.abs(v)); power+=v*v;}
  const rms=Math.sqrt(power/((wav.length-44)/2));
  assert.ok(peak<.95 && rms>.01,'Audible and unclipped');
  const boundary=[0,1].map(c=>Math.abs(wav.readInt16LE(44+c*2)-wav.readInt16LE(wav.length-4+c*2))/32768);
  assert.ok(Math.max(...boundary)<.025,`Loop boundary discontinuity: ${boundary}`);
  const midi=await readFile(new URL(`${item.name}.mid`,output));
  assert.equal(midi.toString('ascii',0,4),'MThd');
  // Independently walk exported MIDI events: no hanging notes, every track spans the loop.
  let offset=14;
  for (let t=0;t<midi.readUInt16BE(10);t++) {
    assert.equal(midi.toString('ascii',offset,offset+4),'MTrk');
    const end=offset+8+midi.readUInt32BE(offset+4); offset+=8;
    let tick=0; const active=new Set();
    const readVlq=()=>{let value=0,byte; do {byte=midi[offset++]; value=(value<<7)|(byte&127);} while (byte&128); return value;};
    while (offset<end) {
      tick+=readVlq(); const status=midi[offset++];
      if(status===255) {offset++; const length=readVlq(); offset+=length;}
      else if((status&240)===192) offset++;
      else {const pitch=midi[offset++]; offset++;
        if((status&240)===144) {assert.ok(!active.has(pitch)); active.add(pitch);}
        else {assert.ok(active.has(pitch)); active.delete(pitch);}}
    }
    assert.equal(active.size,0); assert.equal(tick,item.bars*4*480); assert.equal(offset,end);
  }
  assert.equal(offset,midi.length);
  report.push({...item,measuredPeak:peak,measuredRms:rms,boundaryJump:boundary,checks:'passed'});
}
if(manifestName==='manifest.json') {
  assert.equal(manifest[0].frames,manifest[1].frames);
  assert.ok(Math.abs(manifest[0].lufs-manifest[1].lufs)<.5,'Matched loudness');
}
await writeFile(new URL(manifestName.replace('manifest','verification'),output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
