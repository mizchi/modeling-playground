import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SFX_PRESETS } from '../src/sfx-presets.mjs';
import { renderSfx, SFX_SAMPLE_RATE } from '../src/sfx.mjs';
import { encodeWav } from '../src/audio.mjs';

const output=new URL('../output/sfx/',import.meta.url);
await mkdir(output,{recursive:true});
async function save(name,channels,title) {
  const wav=fileURLToPath(new URL(`${name}.wav`,output));
  await writeFile(wav,encodeWav(channels,SFX_SAMPLE_RATE));
  execFileSync('ffmpeg',['-y','-v','error','-i',wav,'-c:a','libmp3lame','-b:a','192k',
    '-metadata',`title=${title}`,fileURLToPath(new URL(`${name}.mp3`,output))]);
}
const manifest=[], rendered=[];
for(const [index,preset] of SFX_PRESETS.entries()) {
  const name=`${String(index+1).padStart(2,'0')}-${preset.id}`;
  const channels=renderSfx(preset);
  await save(name,channels,preset.name);
  await writeFile(new URL(`${name}.preset.json`,output),JSON.stringify(preset,null,2)+'\n');
  manifest.push({id:preset.id,name,title:preset.name,description:preset.description,
    duration:channels[0].length/SFX_SAMPLE_RATE,frames:channels[0].length,sampleRate:SFX_SAMPLE_RATE,
    targetPeak:preset.peak,peakDb:20*Math.log10(preset.peak)});
  rendered.push(channels);
}
const gap=Math.round(.65*SFX_SAMPLE_RATE), padding=Math.round(.25*SFX_SAMPLE_RATE);
const total=rendered.reduce((sum,channels)=>sum+channels[0].length,0)+gap*(rendered.length-1)+padding*2;
const demo=[new Float32Array(total),new Float32Array(total)];
let offset=padding;
for(const [i,channels] of rendered.entries()) {
  manifest[i].demoStart=offset/SFX_SAMPLE_RATE;
  for(let c=0;c<2;c++) demo[c].set(channels[c],offset);
  offset+=channels[0].length+gap;
}
await save('00-demo',demo,'爆発 → 決定 → キャンセル → 剣ヒット → 打撲');
await writeFile(new URL('manifest.json',output),JSON.stringify({effects:manifest,demo:{name:'00-demo',frames:total,duration:total/SFX_SAMPLE_RATE}},null,2)+'\n');
console.log(manifest.map(m=>`${m.title}: ${m.duration}s (${m.name}.wav)`).join('\n'));
