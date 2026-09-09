import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBattleScore } from '../src/battle-score.mjs';
import { renderBattleVoice } from '../src/battle-synth.mjs';
import { SAMPLE_RATE, mixNote, addRoom, encodeWav, encodeMidi } from '../src/audio.mjs';

const output=new URL('../output/',import.meta.url);
await mkdir(output,{recursive:true});
const score=createBattleScore(), beatSeconds=60/score.bpm;
const frames=Math.round(score.beats*beatSeconds*SAMPLE_RATE);
const channels=[new Float32Array(frames),new Float32Array(frames)];
for(const track of score.tracks) for(const note of track.notes) {
  const signal=renderBattleVoice({...note,duration:note.duration*beatSeconds},track.voice);
  const offset=Math.round(note.start*beatSeconds*SAMPLE_RATE);
  mixNote(channels,signal,offset,track.gain,track.pan);
  if(track.voice==='pulse') {
    mixNote(channels,signal,offset+Math.round(beatSeconds*.75*SAMPLE_RATE),track.gain*.13,.40);
    mixNote(channels,signal,offset+Math.round(beatSeconds*1.5*SAMPLE_RATE),track.gain*.045,-.40);
  }
}
addRoom(channels,.035);
let peak=0;
for(const channel of channels) for(const sample of channel) peak=Math.max(peak,Math.abs(sample));
for(const channel of channels) for(let i=0;i<channel.length;i++) channel[i]*=.80/peak;
const name='03-oath-of-the-lightning-battle';
const wavPath=fileURLToPath(new URL(`${name}.wav`,output));
await writeFile(wavPath,encodeWav(channels));
const analysis=spawnSync('ffmpeg',['-hide_banner','-i',wavPath,'-af',
  'loudnorm=I=-16:TP=-1:LRA=11:print_format=json','-f','null','-'],{encoding:'utf8'});
if(analysis.status!==0) throw Error(analysis.stderr);
const loudness=JSON.parse(analysis.stderr.slice(analysis.stderr.lastIndexOf('{'),analysis.stderr.lastIndexOf('}')+1));
const adjustmentDb=Math.min(-16-Number(loudness.input_i),-1-Number(loudness.input_tp));
const gain=10**(adjustmentDb/20);
for(const channel of channels) for(let i=0;i<channel.length;i++) channel[i]*=gain;
await writeFile(wavPath,encodeWav(channels));
await writeFile(new URL(`${name}.mid`,output),encodeMidi(score));
await writeFile(new URL(`${name}.score.json`,output),JSON.stringify(score,null,2)+'\n');
execFileSync('ffmpeg',['-y','-v','error','-i',wavPath,'-c:a','libmp3lame','-b:a','256k',
  '-metadata',`title=${score.title}`,fileURLToPath(new URL(`${name}.mp3`,output))]);
const manifest=[{name,title:score.title,arrangement:score.arrangement,bpm:score.bpm,bars:score.beats/4,
  frames,sampleRate:SAMPLE_RATE,duration:frames/SAMPLE_RATE,lufs:Number(loudness.input_i)+adjustmentDb,
  sections:score.sections.map(s=>({...s,seconds:(s.bar-1)*4*beatSeconds}))}];
await writeFile(new URL('battle-manifest.json',output),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
