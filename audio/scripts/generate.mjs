import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createScore } from '../src/score.mjs';
import { SAMPLE_RATE, renderChip, mixNote, addRoom, encodeWav, encodeMidi } from '../src/audio.mjs';
import { loadSamples, renderSample } from '../src/samples.mjs';

const output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
const acoustic=createScore('acoustic');
const samples=await loadSamples(acoustic);
const manifest=[];
for (const arrangement of ['chip','acoustic']) {
  const score=createScore(arrangement), secondsPerBeat=60/score.bpm;
  const frames=Math.round(score.beats*secondsPerBeat*SAMPLE_RATE);
  const channels=[new Float32Array(frames),new Float32Array(frames)];
  for (const track of score.tracks) for (const note of track.notes) {
    const timed={...note,duration:note.duration*secondsPerBeat};
    const pcm=arrangement==='chip' ? renderChip(timed,track.voice) : renderSample(timed,track.voice,samples);
    mixNote(channels,pcm,Math.round(note.start*secondsPerBeat*SAMPLE_RATE),track.gain,track.pan);
  }
  // Short periodic reflections keep the tail at the start of the loop.
  addRoom(channels,arrangement==='chip'?.08:.33);
  let peak=0, power=0;
  for (const ch of channels) for (const v of ch) {peak=Math.max(peak,Math.abs(v)); power+=v*v;}
  const rms=Math.sqrt(power/(2*frames));
  const gain=Math.min(.84/peak,.135/rms);
  for (const ch of channels) for (let i=0;i<ch.length;i++) ch[i]*=gain;
  const name=arrangement==='chip'?'01-windward-trail-chip':'02-windward-trail-acoustic';
  await writeFile(new URL(`${name}.wav`,output),encodeWav(channels));
  await writeFile(new URL(`${name}.mid`,output),encodeMidi(score));
  await writeFile(new URL(`${name}.score.json`,output),JSON.stringify(score,null,2)+'\n');
  // Constant gain loudness matching, preserving exact WAV loop length. No dynamic processing.
  const analysis=spawnSync('ffmpeg',['-hide_banner','-i',fileURLToPath(new URL(`${name}.wav`,output)),
    '-af','loudnorm=I=-20:TP=-1:LRA=11:print_format=json','-f','null','-'],{encoding:'utf8'});
  if (analysis.status!==0) throw Error(analysis.stderr);
  const loudness=JSON.parse(analysis.stderr.slice(analysis.stderr.lastIndexOf('{'),analysis.stderr.lastIndexOf('}')+1));
  const adjustmentDb=Math.min(-20-Number(loudness.input_i), -1-Number(loudness.input_tp));
  const adjustment=10**(adjustmentDb/20);
  for (const ch of channels) for (let i=0;i<ch.length;i++) ch[i]*=adjustment;
  await writeFile(new URL(`${name}.wav`,output),encodeWav(channels));
  execFileSync('ffmpeg',['-y','-v','error','-i',fileURLToPath(new URL(`${name}.wav`,output)),
    '-c:a','libmp3lame','-b:a','192k','-metadata',`title=Windward Trail (${arrangement})`,
    fileURLToPath(new URL(`${name}.mp3`,output))]);
  manifest.push({name,arrangement,bpm:score.bpm,bars:16,frames,sampleRate:SAMPLE_RATE,duration:frames/SAMPLE_RATE,
    peak:peak*gain*adjustment,rms:rms*gain*adjustment,lufs:Number(loudness.input_i)+adjustmentDb,melodyNotes:score.tracks[0].notes.length});
  console.log(`Rendered ${name}: ${(frames/SAMPLE_RATE).toFixed(3)}s`);
}
await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2)+'\n');
