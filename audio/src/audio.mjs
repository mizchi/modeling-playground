export const SAMPLE_RATE = 44100;

export function renderChip(note, voice, rate = SAMPLE_RATE) {
  const release = voice === 'pad' ? .18 : .04;
  const out = new Float32Array(Math.ceil((note.duration + release)*rate));
  const f = 440 * 2 ** ((note.pitch-69)/12);
  for (let i=0; i<out.length; i++) {
    const t=i/rate, phase = t*f;
    const attack = Math.min(1, t/(voice==='pad' ? .08 : .005));
    const tail = t > note.duration ? Math.max(0, 1-(t-note.duration)/release) : 1;
    let value;
    // Finite additive harmonics avoid aliasing from discontinuous square waves.
    if (voice==='lead' || voice==='pad') {
      value = 0;
      for (let h=1; h<=13 && h*f<rate*.45; h+=2) value += Math.sin(2*Math.PI*phase*h)/h;
      value *= .65 * (voice==='lead' ? .78+.22*Math.exp(-t*12) : 1);
    } else if (voice==='bass') value = Math.sin(2*Math.PI*phase) + .10*Math.sin(6*Math.PI*phase);
    else value = (Math.sin(2*Math.PI*phase)+.25*Math.sin(4*Math.PI*phase)) * Math.exp(-t*(voice==='bell'?5:9));
    out[i] = value * attack * tail * note.velocity/127;
  }
  return out;
}

export function wrapTail(signal, length) {
  const out = new Float32Array(length);
  for (let i=0; i<signal.length; i++) out[i % length] += signal[i];
  return out;
}

export function mixNote(channels, signal, offset, gain, pan) {
  const gains = [Math.cos((pan+1)*Math.PI/4)*gain, Math.sin((pan+1)*Math.PI/4)*gain];
  for (let c=0;c<2;c++) for (let i=0;i<signal.length;i++) {
    const j = (offset+i) % channels[c].length;
    channels[c][j] += signal[i] * gains[c];
  }
}

export function addRoom(channels, amount) {
  const dry = channels.map(c => c.slice());
  for (const [seconds, gain] of [[.043,.36],[.079,.28],[.127,.23],[.193,.17],[.293,.11],[.419,.07]]) {
    const delay = Math.round(seconds*SAMPLE_RATE);
    for (let c=0;c<2;c++) for (let i=0;i<dry[c].length;i++) channels[c][(i+delay)%dry[c].length] += dry[1-c][i]*gain*amount;
  }
}

export function encodeWav(channels, rate=SAMPLE_RATE) {
  const length=channels[0].length, dataBytes=length*4;
  const out=Buffer.alloc(44+dataBytes);
  out.write('RIFF'); out.writeUInt32LE(36+dataBytes,4); out.write('WAVE',8); out.write('fmt ',12);
  out.writeUInt32LE(16,16); out.writeUInt16LE(1,20); out.writeUInt16LE(2,22);
  out.writeUInt32LE(rate,24); out.writeUInt32LE(rate*4,28); out.writeUInt16LE(4,32); out.writeUInt16LE(16,34);
  out.write('data',36); out.writeUInt32LE(dataBytes,40);
  for (let i=0;i<length;i++) for (let c=0;c<2;c++) {
    const v=Math.max(-1,Math.min(1,channels[c][i]));
    out.writeInt16LE(Math.round(v*(v<0?32768:32767)),44+i*4+c*2);
  }
  return out;
}

const vlq = value => {
  const bytes=[value & 127];
  while ((value >>>= 7)) bytes.unshift((value & 127)|128);
  return bytes;
};
const chunk = (name, bytes) => {
  const header=Buffer.alloc(8); header.write(name); header.writeUInt32BE(bytes.length,4);
  return Buffer.concat([header,Buffer.from(bytes)]);
};

export function encodeMidi(score) {
  const tempo=Math.round(60000000/score.bpm), end=score.beats*480;
  const title=Buffer.from(score.title);
  const tempoTrack=chunk('MTrk',[0,255,3,...vlq(title.length),...title,0,255,81,3,tempo>>16,(tempo>>8)&255,tempo&255,
    0,255,88,4,4,2,24,8,...vlq(end),255,47,0]);
  const tracks=score.tracks.map((track,index) => {
    const c=track.channel ?? index;
    const name=Buffer.from(track.name);
    const events=[{tick:0,priority:0,bytes:[255,3,...vlq(name.length),...name]}];
    if(c!==9) events.push({tick:0,priority:1,bytes:[192+c,track.midiProgram ?? (score.arrangement==='chip' ? (c===2?38:80) : track.program)]});
    for (const n of track.notes) {
      events.push({tick:Math.round(n.start*480),priority:3,bytes:[144+c,n.pitch,n.velocity]});
      events.push({tick:Math.round((n.start+n.duration)*480),priority:2,bytes:[128+c,n.pitch,0]});
    }
    events.sort((a,b)=>a.tick-b.tick||a.priority-b.priority);
    let previous=0; const bytes=[];
    for (const e of events) {bytes.push(...vlq(e.tick-previous),...e.bytes); previous=e.tick;}
    bytes.push(...vlq(end-previous),255,47,0);
    return chunk('MTrk',bytes);
  });
  const header=Buffer.alloc(6); header.writeUInt16BE(1,0); header.writeUInt16BE(tracks.length+1,2); header.writeUInt16BE(480,4);
  return Buffer.concat([chunk('MThd',header),tempoTrack,...tracks]);
}
