import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattleScore } from '../src/battle-score.mjs';
import { renderBattleVoice } from '../src/battle-synth.mjs';
import { validateScore } from '../src/score.mjs';
import { encodeMidi } from '../src/audio.mjs';

test('battle score is a complete fast loop with melodic development and playable monophonic parts', () => {
  const score = createBattleScore();
  assert.equal(score.bpm, 184);
  assert.equal(score.beats, 160);
  assert.doesNotThrow(() => validateScore(score));
  assert.ok(score.tracks[0].notes.some(n => n.pitch === 75), 'D sharp dominant tension');
  assert.ok(Math.max(...score.tracks[0].notes.map(n => n.pitch)) >= 88, 'Upper register climax');
  for (const track of score.tracks.filter(t => t.channel !== 9)) {
    const notes = [...track.notes].sort((a, b) => a.start - b.start);
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i-1].start + notes[i-1].duration <= notes[i].start + 1e-9, track.name);
  }
  assert.throws(() => validateScore({...score, beats: 0}));
});

test('battle instruments and drums are deterministic, finite, audible and release to zero', () => {
  const voices = [['pulse',76],['counter',71],['arp',64],['triangle',40],['drums',36],['drums',38],['drums',42],['drums',49]];
  for (const [voice,pitch] of voices) {
    const note = {pitch, duration:.14, velocity:100};
    const pcm = renderBattleVoice(note,voice,8000);
    assert.deepEqual(pcm, renderBattleVoice(note,voice,8000));
    assert.ok(pcm.every(Number.isFinite));
    assert.ok(pcm.some(v => Math.abs(v) > .03), voice);
    assert.equal(pcm[0],0);
    assert.ok(Math.abs(pcm.at(-1)) < .002, voice);
  }
});

test('MIDI puts drums on channel ten and keeps percussion out of melodic channels', () => {
  const midi = encodeMidi(createBattleScore());
  assert.ok(midi.includes(Buffer.from([0x99,36,112])));
  assert.ok(midi.includes(Buffer.from([0x89,36,0])));
  assert.ok(midi.includes(Buffer.from([0xc0,80])));
});
