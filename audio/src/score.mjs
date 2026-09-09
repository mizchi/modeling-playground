/** @typedef {{pitch:number, start:number, duration:number, velocity:number}} Note Beats, MIDI pitch/velocity. */
/** @typedef {{name:string, voice:string, program:number, midiProgram?:number, channel?:number, gain:number, pan:number, notes:Note[]}} Track */
/** @typedef {{title:string, arrangement:string, bpm:number, beats:number, tracks:Track[]}} Score */

export function validateScore(score) {
  if (!Number.isFinite(score.bpm) || score.bpm <= 0 || !Number.isInteger(score.beats) || score.beats <= 0) throw Error('Invalid transport');
  for (const track of score.tracks) for (const n of track.notes) {
    if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127 ||
        !Number.isFinite(n.start) || n.start < 0 || !Number.isFinite(n.duration) || n.duration <= 0 ||
        n.start + n.duration > score.beats || !Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127)
      throw Error(`Invalid note: ${JSON.stringify(n)}`);
  }
}

/** Hand-composed D-major theme. Identical lead, harmony and tempo across arrangements. */
export function createScore(arrangement) {
  if (!['chip', 'acoustic'].includes(arrangement)) throw Error('Unknown arrangement');
  const acoustic = arrangement === 'acoustic';
  const track = (name, chip, sample, program, gain, pan) => ({name, voice: acoustic ? sample : chip, program, gain, pan, notes: []});
  const tracks = [
    track('Melody', 'lead', 'flute', 73, acoustic ? 0.60 : 0.24, -0.08),
    track('Arpeggio', 'pluck', 'acoustic_guitar_nylon', 24, acoustic ? 0.55 : 0.15, -0.32),
    track('Bass', 'bass', 'acoustic_bass', 32, acoustic ? 0.68 : 0.27, 0),
    track('Harmony', 'pad', 'string_ensemble_1', 48, acoustic ? 0.15 : 0.055, 0.30),
    track('Answers', 'bell', 'acoustic_grand_piano', 0, acoustic ? 0.44 : 0.10, 0.22),
  ];
  const add = (t, pitch, start, duration, velocity = 85) => tracks[t].notes.push({pitch, start, duration, velocity});
  // Each pair is pitch and notated duration; shorter gates leave space for phrasing.
  const melody = [
    [[74,.5],[78,.5],[81,1],[78,.5],[76,.5],[74,1]],
    [[73,.5],[76,.5],[81,1.5],[79,.5],[76,1]],
    [[74,.5],[78,.5],[83,1],[81,.5],[78,.5],[76,1]],
    [[78,1.5],[76,.5],[73,1],[0,1]],
    [[74,.5],[79,.5],[83,1],[81,.5],[79,.5],[78,1]],
    [[76,.5],[78,.5],[81,1.5],[78,.5],[74,1]],
    [[76,.5],[79,.5],[83,1],[81,.5],[79,.5],[76,1]],
    [[73,1],[76,1],[81,1],[0,1]],
    [[86,1],[85,.5],[83,.5],[81,1],[78,1]],
    [[83,.5],[81,.5],[78,1],[76,1],[0,1]],
    [[83,1],[81,.5],[79,.5],[78,1],[74,1]],
    [[76,.5],[78,.5],[81,1.5],[79,.5],[76,1]],
    [[74,.5],[78,.5],[81,1],[86,1],[85,.5],[83,.5]],
    [[81,1],[79,.5],[78,.5],[76,1],[74,1]],
    [[76,.5],[79,.5],[83,1],[81,.5],[79,.5],[76,1]],
    [[73,1],[76,1],[81,1],[73,.5],[0,.5]],
  ];
  const chords = [
    [50,57,62,66],[49,57,61,64],[47,54,59,62],[54,57,61,66],
    [43,55,59,62],[42,54,57,62],[40,55,59,64],[45,57,61,64],
    [47,54,59,62],[42,54,57,61],[43,55,59,62],[45,57,61,64],
    [50,57,62,66],[43,55,59,62],[40,55,59,64],[45,57,61,64],
  ];
  melody.forEach((bar, b) => {
    let start = b * 4;
    bar.forEach(([pitch, length], i) => {
      if (pitch) add(0, pitch, start, length * (length >= 1 ? .88 : .83), 88 + (i === 0 ? 8 : 0) - (b % 4 === 3 ? 5 : 0));
      start += length;
    });
    const chord = chords[b];
    [1,2,3,2,1,3,2,3].forEach((idx, step) => add(1, chord[idx], b*4 + step*.5, acoustic ? .65 : .32, step % 2 ? 66 : 79));
    add(2, chord[0], b*4, 1.65, 95);
    add(2, b === 15 ? 45 : chord[0] + 12, b*4+2, 1.6, 77);
    chord.slice(1).forEach(p => add(3, p, b*4+.03, 3.6, b >= 8 ? 66 : 54));
    if (b % 4 === 3) [0,1,2,1].forEach((x, i) => add(4, chord[x+1]+12, b*4+3+i*.25, .2, 69+i*3));
    else if (b >= 8) add(4, chord[2]+12, b*4+2.5, .7, 60);
  });
  // Last arpeggio must end within the loop's notated length.
  for (const t of tracks) for (const n of t.notes) n.duration = Math.min(n.duration, 64-n.start);
  const score = {title:'風の道 / Windward Trail', arrangement, bpm:104, beats:64, tracks};
  validateScore(score);
  return score;
}
