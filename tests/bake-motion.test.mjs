import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from 'three';
import { bakePoseClips } from '../modeling/bake-motion.mjs';

test('baking preserves authored quaternions and falls back to XYZ Euler rotations per joint', () => {
  const rotation = [.2, .3, .4];
  const quaternion = new Quaternion().setFromAxisAngle(new Vector3(.35, 0, 1).normalize(), .48).toArray();
  const [clip] = bakePoseClips({
    clips: [{ name: 'Pose', duration: 1, fps: 1 }],
    rootBone: 'Root', joints: ['Fan', 'Chest'], scaleJoints: [],
    sample: () => ({
      position: [0, 0, 0], rotations: { Chest: rotation }, quaternions: { Fan: quaternion },
    }),
  });
  assert.deepEqual(clip.tracks[1].values, new Float32Array([...quaternion, ...quaternion]));
  const fallback = new Quaternion().setFromEuler(new Euler(...rotation)).toArray();
  assert.deepEqual(clip.tracks[2].values, new Float32Array([...fallback, ...fallback]));
});
