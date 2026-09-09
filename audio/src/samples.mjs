import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { SAMPLE_RATE } from './audio.mjs';

const root = new URL('../.cache/samples/', import.meta.url);
const base = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/';
const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteName = pitch => names[pitch%12] + (Math.floor(pitch/12)-1);

export async function loadSamples(score) {
  await mkdir(root,{recursive:true});
  const samples = new Map();
  for (const track of score.tracks) {
    const cache=new URL(`${track.voice}.json`,root);
    let bank;
    try {bank=JSON.parse(await readFile(cache,'utf8'));}
    catch {
      console.log(`Fetching sample instrument: ${track.voice}`);
      const response=await fetch(`${base}${track.voice}-mp3.js`);
      if (!response.ok) throw Error(`Sample download failed: ${response.status}`);
      const source=await response.text();
      // Parse data entries only; never execute downloaded JavaScript.
      bank=Object.fromEntries([...source.matchAll(/"([A-G](?:b|#)?\d+)"\s*:\s*"data:audio\/mp3;base64,([A-Za-z0-9+/=]+)"/g)].map(m=>[m[1],m[2]]));
      if (Object.keys(bank).length<50) throw Error('Incomplete sample bank');
      await writeFile(cache,JSON.stringify(bank));
    }
    for (const pitch of new Set(track.notes.map(n=>n.pitch))) {
      const encoded=bank[noteName(pitch)];
      if (!encoded) throw Error(`Missing sample ${track.voice}/${noteName(pitch)}`);
      const decoded=execFileSync('ffmpeg',['-v','error','-i','pipe:0','-f','f32le','-ac','1','-ar',String(SAMPLE_RATE),'pipe:1'],
        {input:Buffer.from(encoded,'base64'),maxBuffer:16*1024*1024});
      const pcm=new Float32Array(decoded.length/4);
      let peak=0;
      for (let i=0;i<pcm.length;i++) {pcm[i]=decoded.readFloatLE(i*4); peak=Math.max(peak,Math.abs(pcm[i]));}
      if (peak<.0001) throw Error(`Silent sample: ${track.voice}/${pitch}`);
      for (let i=0;i<pcm.length;i++) pcm[i]*=.8/peak;
      samples.set(`${track.voice}/${pitch}`,pcm);
    }
  }
  return samples;
}

export function renderSample(note, voice, samples) {
  const sample=samples.get(`${voice}/${note.pitch}`);
  const release=voice==='string_ensemble_1' ? .32 : voice==='flute' ? .09 : .18;
  const out=new Float32Array(Math.ceil((note.duration+release)*SAMPLE_RATE));
  for (let i=0;i<Math.min(out.length,sample.length);i++) {
    const t=i/SAMPLE_RATE;
    const envelope=Math.min(1,t/.004)*Math.min(1,(sample.length-i)/(SAMPLE_RATE*.015))*
      (t>note.duration ? Math.max(0,1-(t-note.duration)/release) : 1);
    out[i]=sample[i]*envelope*(note.velocity/127)**1.3;
  }
  return out;
}
