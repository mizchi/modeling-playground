import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, AnimationClip, NumberKeyframeTrack } from 'three';
import { AnimationPlayer } from '../viewer/animation.mjs';

test('playback pauses, seeks, changes speed and loops independently of rendering', () => {
  const root = new Group();
  const clip = new AnimationClip('Walk', 1, [new NumberKeyframeTrack('.position[x]', [0,.5,1], [0,1,0])]);
  const player = new AnimationPlayer(root, [clip]);
  player.update(.25);
  assert.ok(Math.abs(root.position.x - .5)<1e-5);
  player.playing = false;
  player.update(.2);
  assert.ok(Math.abs(root.position.x - .5)<1e-5);
  player.seek(.5);
  assert.equal(player.playing, false);
  assert.ok(Math.abs(root.position.x-1)<1e-5);
  player.speed=2;
  player.playing=true;
  player.update(.125);
  assert.ok(Math.abs(root.position.x-.5)<1e-5);
  player.update(.125);
  assert.ok(Math.abs(root.position.x)<1e-5);
  player.dispose();
});

test('models without animation are supported and selecting a clip resets playback', () => {
  const root = new Group();
  const empty = new AnimationPlayer(root, []);
  assert.equal(empty.duration, 0);
  assert.equal(empty.playing, false);
  empty.seek(1);
  empty.update(1);
  empty.dispose();
  const clip=new AnimationClip('Walk',1,[new NumberKeyframeTrack('.position[x]',[0,1],[0,1])]);
  const player = new AnimationPlayer(root,[clip]);
  player.seek(.5);
  player.select(0);
  assert.equal(player.time,0);
  assert.equal(player.playing,true);
});
