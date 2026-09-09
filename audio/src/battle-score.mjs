import { validateScore } from './score.mjs';

const pitches = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const pitch = name => {
  const [,letter,sharp,octave] = /^([A-G])(#?)(\d)$/.exec(name);
  return (Number(octave)+1)*12+pitches[letter]+Number(Boolean(sharp));
};

// Explicitly composed phrases; each string is one bar, durations are in beats.
const intro = [
  'E4/.5 E4/.5 B4/.5 E5/.5 E4/.5 G4/.5 B4/.5 D5/.5',
  'E4/.5 E4/.5 C5/.5 E5/.5 E4/.5 G4/.5 B4/.5 C5/.5',
  'A4/.5 E5/.5 A5/.5 G5/.5 F5/.5 E5/.5 D5/.5 C5/.5',
  'B4/.5 D#5/.5 F#5/.5 A5/.5 B5/.5 A5/.25 F#5/.25 D#5/.5 B4/.5',
];
const theme = [
  'E5/.75 B5/.25 E6/.5 D6/.5 B5/1 G5/.5 A5/.5',
  'B5/.75 G5/.25 E5/.5 G5/.5 C6/1 B5/.5 G5/.5',
  'A5/.75 E5/.25 A5/.5 B5/.5 C6/.75 B5/.25 A5/.5 G5/.5',
  'F#5/.5 A5/.5 B5/1 A5/.5 F#5/.5 D#5/.5 B4/.5',
  'E5/.75 B5/.25 E6/.5 D6/.5 B5/.5 G5/.5 E5/.5 F#5/.5',
  'G5/.75 B5/.25 D6/1 B5/.5 A5/.5 G5/.5 E5/.5',
  'F#5/.5 A5/.5 D6/.75 C6/.25 A5/.5 F#5/.5 E5/.5 D5/.5',
  'D#5/.5 F#5/.5 A5/.5 B5/.5 D#6/.75 B5/.25 F#5/.5 D#5/.5',
];
const response = [
  'E5/.5 G5/.5 B5/.5 E6/.5 D6/.5 B5/.5 A5/.5 G5/.5',
  'C6/.75 B5/.25 G5/.5 E5/.5 G5/.5 B5/.5 C6/1',
  'A5/.5 C6/.5 E6/1 D6/.5 C6/.5 B5/.5 A5/.5',
  'F#5/.5 A5/.5 B5/.5 D#6/.5 F#6/.5 D#6/.5 B5/.5 A5/.5',
  'E6/1 B5/.5 G5/.5 A5/.5 G5/.5 F#5/.5 E5/.5',
  'F5/.5 A5/.5 C6/1 B5/.5 A5/.5 G5/.5 F5/.5',
  'F#5/.5 B5/.5 D#6/.5 F#6/.5 E6/.5 D#6/.5 B5/.5 A5/.5',
  'F#5/.5 D#5/.5 B4/.5 D#5/.5 F#5/.5 A5/.5 B5/.5 D#6/.5',
];
const heroic = [
  'G5/1 D6/.5 G6/.5 F#6/1 D6/1',
  'E6/1 D6/.5 B5/.5 C6/1 G5/1',
  'A5/1 C6/.5 E6/.5 D6/1 C6/.5 A5/.5',
  'B5/1 A5/.5 F#5/.5 A5/1 D6/1',
  'G6/.75 F#6/.25 E6/.5 D6/.5 B5/1 D6/1',
  'E6/1 G6/.5 E6/.5 D6/1 C6/1',
  'A5/.5 C6/.5 E6/1 D6/.5 C6/.5 B5/.5 A5/.5',
  'B5/.5 D#6/.5 F#6/1 E6/.5 D#6/.5 B5/.5 F#5/.5',
];
const climax = [...theme];
climax[0]='E6/1 B5/.5 E6/.5 G6/.75 F#6/.25 E6/.5 D6/.5';
climax[4]='E6/.75 B5/.25 E6/.5 F#6/.5 G6/1 F#6/.5 E6/.5';
climax[7]='D#6/.5 B5/.5 F#5/.5 A5/.5 B5/.5 D#6/.5 F#6/.5 D#6/.5';
const turn = [
  'E6/1 B5/.5 G5/.5 E5/.5 G5/.5 B5/.5 E6/.5',
  'F6/.5 E6/.5 C6/.5 A5/.5 F5/.5 A5/.5 C6/.5 F6/.5',
  'F#6/.5 D#6/.5 B5/.5 A5/.5 F#5/.5 D#5/.5 B4/.5 A4/.5',
  'B4/.5 D#5/.5 F#5/.5 A5/.5 B5/.5 A5/.25 F#5/.25 D#5/.5 R/.5',
];

const chords = {
  Em:[40,[64,67,71,76]], C:[36,[64,67,72,76]], Am:[45,[64,69,72,76]],
  B7:[47,[63,66,69,71]], G:[43,[62,67,71,74]], D:[38,[62,66,69,74]], F:[41,[65,69,72,77]],
};

export function createBattleScore() {
  const bars=[...intro,...theme,...response,...heroic,...climax,...turn];
  const harmony=[
    'Em','C','Am','B7',
    'Em','C','Am','B7','Em','G','D','B7',
    'Em','C','Am','B7','Em','F','B7','B7',
    'G','C','Am','D','G','C','Am','B7',
    'Em','C','Am','B7','Em','G','D','B7',
    'Em','F','B7','B7',
  ];
  const make=(name,voice,gain,pan,midiProgram,channel)=>({name,voice,gain,pan,program:midiProgram,midiProgram,channel,notes:[]});
  const tracks=[make('Hero lead','pulse',.30,-.08,80,0),make('Countermelody','counter',.115,.24,80,1),
    make('Sixteenth arpeggio','arp',.13,-.30,81,2),make('Driving bass','triangle',.42,0,38,3),
    make('Noise drums','drums',.46,.04,0,9)];
  const add=(t,p,start,duration,velocity)=>tracks[t].notes.push({pitch:p,start,duration,velocity});
  bars.forEach((phrase,b)=>{
    let beat=b*4;
    for (const [i,token] of phrase.split(' ').entries()) {
      const [name,value]=token.split('/'), length=Number(value);
      if(name!=='R') add(0,pitch(name),beat,length*(length>=1?.93:.82),i===0?112:100);
      beat+=length;
    }
    if(beat!==(b+1)*4) throw Error(`Bar ${b+1} has ${beat-b*4} beats`);
    const [root,tones]=chords[harmony[b]], heroicSection=b>=20 && b<28;
    // A galloping bass under a rotating sixteenth-note arpeggio.
    for (let s=0;s<16;s++) {
      if(b===39 && s>=14) continue;
      add(2,tones[[0,2,1,3,0,1,2,3][s%8]]+(heroicSection?0:-12),b*4+s*.25,.19,s%4===0?83:65);
      if(s%4===0 || s%4===2 || (!heroicSection && s%4===3))
        add(3,root+(s%8===6?12:0),b*4+s*.25,s%4===0?.36:.18,s%4===0?110:86);
    }
    // Leave space around the lead; longer answers open up the heroic middle section.
    if(b>=4) {
      const order=heroicSection?[0,1,2,1]:[2,1,0,2];
      for(let s=0;s<4;s++) {
        if(b===39 && s>=3) continue;
        add(1,tones[order[s]],b*4+s+(heroicSection?0:.5),heroicSection?.85:.37,heroicSection?87:73);
      }
    }
    const kicks=heroicSection?[0,2,2.75]:[0,.75,2,2.5];
    for(const t of kicks) add(4,36,b*4+t,.18,t===0?112:98);
    for(const t of [1,3]) add(4,38,b*4+t,.32,112);
    for(let s=0;s<8;s++) add(4,42,b*4+s*.5,.12,s%2?66:82);
    if([0,4,12,20,28,36].includes(b)) add(4,49,b*4,.9,84);
    if([3,11,19,27,35,39].includes(b)) {
      for(let s=0;s<4;s++) add(4,s<2?38:45,b*4+3+s*.25,.18,86+s*9);
    }
  });
  // Shared downbeat snare and fill must be one MIDI note, with no duplicate note-ons.
  tracks[4].notes=tracks[4].notes.filter((n,i,list)=>list.findIndex(m=>m.start===n.start && m.pitch===n.pitch)===i);
  for(const t of tracks) {
    t.notes.sort((a,b)=>a.start-b.start || a.pitch-b.pitch);
    for(let i=0;i<t.notes.length;i++) {
      const n=t.notes[i],next=t.notes.slice(i+1).find(m=>m.pitch===n.pitch);
      n.duration=Math.min(n.duration,160-n.start,next?next.start-n.start:n.duration);
    }
  }
  const score={title:'閃光の誓い / Oath of the Lightning',arrangement:'chip',bpm:184,beats:160,
    sections:[{bar:1,name:'Ignition'},{bar:5,name:'Hero theme'},{bar:13,name:'Escalation'},
      {bar:21,name:'Heroic lift'},{bar:29,name:'Climax'},{bar:37,name:'Turnaround'}],tracks};
  validateScore(score);
  return score;
}
