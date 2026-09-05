"""The walking contract is testable without Blender."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from gait import sample_walk, STRIDE, CYCLE_SECONDS, STANCE


class GaitTests(unittest.TestCase):
    def test_loop_closes_and_alternates(self):
        self.assertEqual(sample_walk(0), sample_walk(CYCLE_SECONDS))
        left = sample_walk(.1)['feet']['L']
        right = sample_walk(.1 + CYCLE_SECONDS / 2)['feet']['R']
        self.assertAlmostEqual(left['y'], right['y'])
        self.assertAlmostEqual(left['lift'], right['lift'])

    def test_planted_foot_matches_forward_motion_without_sliding(self):
        # Add the implied forward translation to the in-place animation.
        velocity = STRIDE / (STANCE * CYCLE_SECONDS)
        for phase in (.05, .15, .35, .50):
            t = phase * CYCLE_SECONDS
            foot = sample_walk(t)['feet']['L']
            self.assertEqual(foot['lift'], 0)
            self.assertAlmostEqual(foot['y'] - velocity * t, -STRIDE / 2)

    def test_feet_clear_ground_and_never_both_leave_it(self):
        max_lift = 0
        for i in range(241):
            pose = sample_walk(CYCLE_SECONDS * i / 240)
            feet = pose['feet'].values()
            self.assertTrue(any(f['lift'] == 0 for f in feet))
            self.assertTrue(all(f['lift'] >= 0 for f in feet))
            max_lift = max(max_lift, *(f['lift'] for f in feet))
            self.assertTrue(math.isfinite(pose['hips_z']))
        self.assertGreater(max_lift, .08)


if __name__ == '__main__':
    unittest.main()
