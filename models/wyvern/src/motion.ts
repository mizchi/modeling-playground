import type { Pose } from '../../../modeling/types.ts';
import { bakePoseClips } from '../../../modeling/bake-motion.ts';
import { WYVERN_BONES } from './rig.ts';
import { WYVERN } from './definition.ts';
import { Euler, Quaternion, Vector3 } from 'three';

export const WYVERN_FLIGHT = Object.freeze({ duration: 1.8, fps: 60, height: 3.1 });
const joints = WYVERN_BONES.filter(b => b.name !== 'FlightRoot').map(b => b.name);

/** Pure time -> local rotations (XYZ radians) and hover root translation (meters). */
export function wyvernPose(clip: string, time: number): Pose {
  const rotations = Object.fromEntries(joints.map(name => [name, [0, 0, 0]]));
  if (clip === 'Rest') return { position: [0, 0, 0], rotations };
  if (clip !== 'Hover') throw new Error(`Unknown wyvern clip: ${clip}`);
  const quaternions: Record<string,number[]> = {};
  const hinge = (name: string, axis: Vector3, angle: number) => {
    const quaternion = new Quaternion().setFromAxisAngle(axis, angle);
    // Preserve authored axes when baking: an Euler round trip leaves platform-dependent
    // cancellation noise in the zero Y component. Keep Euler poses for live consumers.
    quaternions[name] = quaternion.toArray();
    rotations[name] = new Euler().setFromQuaternion(quaternion).toArray().slice(0, 3) as number[];
  };
  const phase = time / WYVERN_FLIGHT.duration * Math.PI * 2;
  // A second harmonic gives a sharper powered downstroke and a softer recovery.
  const stroke = Math.cos(phase) + .12 * Math.sin(2 * phase);
  rotations.Chest = [.27 + .035 * Math.sin(phase - .5), 0, 0];
  rotations.NeckJoint = [-.16 - .025 * Math.sin(phase - .7), 0, 0];
  rotations.HeadJoint = [-.11, 0, 0];
  rotations.TailBase = [.10 + .07 * Math.sin(phase - .8), 0, 0];
  rotations.TailMiddle = [.06 * Math.sin(phase - 1.3), 0, 0];
  rotations.TailTip = [.09 * Math.sin(phase - 1.9), .025 * Math.sin(phase - 1.4), 0];
  for (const [side, sign] of [['Left', 1], ['Right', -1]] satisfies [string, number][]) {
    // Share the stroke: shoulder leads, elbow follows, then the claw-side fan.
    // Neither a shoulder-only plank nor a stationary arm with flapping tips.
    rotations[`${side}Shoulder`] = [0, 0, sign * (.34 * stroke - .10)];
    rotations[`${side}Elbow`] = [0, 0, sign * .065 * Math.cos(phase - .18)];
    rotations[`${side}Wrist`] = [.025 * Math.sin(phase - .65), 0, 0];
    const fanStroke = .52 * Math.cos(phase - .38) + .04 * Math.sin(2 * phase - .76);
    const fanAxis = new Vector3(.35, 0, sign).normalize();
    hinge(`${side}Fan`, fanAxis, fanStroke);
    for (let rib = 0; rib < 4; rib++) {
      const curl = Math.pow((1 + Math.cos(phase - (1.50 + rib * .045) * Math.PI)) / 2, 2);
      const direction = new Vector3(...WYVERN.fingers[rib]).sub(new Vector3(...WYVERN.wrist));
      direction.x *= sign;
      // Bend the outer rib toward the underside, perpendicular to its own ray.
      const axis = direction.cross(new Vector3(0, -1, 0)).normalize();
      const angle = (.26 + rib * .035) * curl;
      hinge(`${side}Rib${rib}`, axis, angle);
    }
    rotations[`${side}Hip`] = [.63 + .035 * Math.sin(phase - .6), 0, -sign * .09];
    rotations[`${side}Knee`] = [-.88, 0, 0];
    rotations[`${side}Ankle`] = [.50 + .025 * Math.sin(phase - .9), 0, 0];
  }
  return { position: [0, WYVERN_FLIGHT.height + .13 * Math.sin(phase - .65), 0], rotations, quaternions };
}

export function wyvernClips() {
  return bakePoseClips({
    clips: [{ name: 'Hover', duration: WYVERN_FLIGHT.duration, fps: WYVERN_FLIGHT.fps },
      { name: 'Rest', duration: 1, fps: 1 }],
    rootBone: 'FlightRoot', joints, scaleJoints: [], sample: wyvernPose,
  });
}
