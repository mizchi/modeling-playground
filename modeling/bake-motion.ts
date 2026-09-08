import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { KeyframeTrack } from 'three';
import type { PoseClipOptions } from './types.ts';

/** Pure pose(time) -> portable baked clips. Optional quaternions[joint] (XYZW) override XYZ Euler rotations. */
export function bakePoseClips({clips,rootBone,joints,scaleJoints,sample,extraTimes=()=>[]}: PoseClipOptions): AnimationClip[] {
  return clips.map(({name,duration,fps})=>{
    const times=[...new Set([...Array.from({length:Math.round(duration*fps)+1},(_,i)=>i/fps),...extraTimes(name),duration])]
      .filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b);
    const poses=times.map(t=>sample(name,t));
    const tracks: KeyframeTrack[]=[new VectorKeyframeTrack(`${rootBone}.position`,times,poses.flatMap(p=>p.position))];
    for(const joint of joints)tracks.push(new QuaternionKeyframeTrack(`${joint}.quaternion`,times,
      poses.flatMap(p=>p.quaternions?.[joint] ?? new Quaternion().setFromEuler(new Euler(...p.rotations[joint])).toArray())));
    for(const joint of scaleJoints)tracks.push(new VectorKeyframeTrack(`${joint}.scale`,times,poses.flatMap(p=>{
      const scale=p.scales?.[joint];if(!scale)throw new Error(`Missing scale for ${joint}`);return scale;
    })));
    for(const track of tracks)if(!track.validate()||!Array.from(track.values).every(Number.isFinite))throw new Error(`Invalid baked track ${name}/${track.name}`);
    return new AnimationClip(name,duration,tracks);
  });
}
