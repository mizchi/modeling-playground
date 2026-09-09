import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, validateScore } from '../src/score.mjs';
import { encodeWav, encodeMidi, renderChip, wrapTail } from '../src/audio.mjs';

test('both arrangements share a 16-bar, 104 BPM melody with valid MIDI notes', () => {
  const chip = createScore('chip');
  const acoustic = createScore('acoustic');
  assert.equal(chip.beats, 64);
  assert.equal(chip.bpm, 104);
  assert.deepEqual(chip.tracks[0].notes, acoustic.tracks[0].notes);
  for (const score of [chip, acoustic]) {
    assert.doesNotThrow(() => validateScore(score));
    assert.ok(score.tracks.every(t => t.notes.length > 0));
  }
  const bad = structuredClone(chip);
  bad.tracks[0].notes[0].pitch = 128;
  assert.throws(() => validateScore(bad));
});

test('loop folds the release tail into the start without changing length', () => {
  assert.deepEqual([...wrapTail(Float32Array.from([1, 2, 3, 4, 5, 6]), 4)], [6, 8, 3, 4]);
});

test('chip synthesis is deterministic, audible and finite', () => {
  const note = { pitch: 69, duration: 0.2, velocity: 90 };
  const a = renderChip(note, 'lead', 8000);
  const b = renderChip(note, 'lead', 8000);
  assert.deepEqual(a, b);
  assert.ok(a.some(v => Math.abs(v) > 0.05));
  assert.ok(a.every(Number.isFinite));
  assert.equal(a[0], 0);
  assert.ok(Math.abs(a.at(-1)) < 0.001);
});

test('WAV carries stereo PCM metadata and clamps amplitudes', () => {
  const wav = encodeWav([Float32Array.from([2, -2]), Float32Array.from([0.5, -0.5])], 44100);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), 44100);
  assert.equal(wav.readUInt32LE(40), 8);
  assert.equal(wav.readInt16LE(44), 32767);
  assert.equal(wav.readInt16LE(48), -32768);
});

test('MIDI exports a tempo track plus every instrumental track', () => {
  const score = createScore('acoustic');
  const midi = encodeMidi(score);
  assert.equal(midi.toString('ascii', 0, 4), 'MThd');
  assert.equal(midi.readUInt16BE(8), 1);
  assert.equal(midi.readUInt16BE(10), score.tracks.length + 1);
  assert.equal(midi.readUInt16BE(12), 480);
  assert.ok(midi.includes(Buffer.from([0xff, 0x51, 3])));
});
