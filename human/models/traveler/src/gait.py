"""Deterministic in-place gait, independent of Blender and mesh generation."""
import math

CYCLE_SECONDS = 1.2
FPS = 30
STRIDE = .32
STANCE = .60
FOOT_LIFT = .115


def sample_walk(seconds):
    phase = (seconds / CYCLE_SECONDS) % 1
    feet = {}
    for name, offset in [('L', 0), ('R', .5)]:
        p = (phase + offset) % 1
        if p < STANCE:
            y = -STRIDE / 2 + STRIDE * p / STANCE
            lift = 0.0
        else:
            s = (p - STANCE) / (1 - STANCE)
            # Hermite curve preserves the planted foot's velocity at both joins.
            tangent = STRIDE * (1 - STANCE) / STANCE
            y = (2*s**3-3*s**2+1)*STRIDE/2 + (s**3-2*s**2+s)*tangent
            y += (-2*s**3+3*s**2)*(-STRIDE/2) + (s**3-s**2)*tangent
            lift = FOOT_LIFT * math.sin(math.pi * s)**2
        feet[name] = {'y': y, 'lift': lift}
    return {
        'feet': feet,
        'hips_z': .865 + .012 * math.cos(phase * math.tau * 2),
        'sway': .012 * math.sin(phase * math.tau),
        'yaw': .035 * math.sin(phase * math.tau),
        'arm_swing': .35 * math.cos(phase * math.tau),
    }
