import { AnimationClip, QuaternionKeyframeTrack, Quaternion, Euler } from 'three';

/** Sparse joint curves: no tracks for unmoving legs, no dense baked samples. */
export function dogClips() {
  const duration=2.4,times=Array.from({length:9},(_,i)=>i*duration/8);
  const sample=t=>{
    const phase=t/duration*Math.PI*2;
    return {Head:[.025*Math.sin(phase),.035*Math.sin(phase),.065*Math.sin(phase)],
      TailBase:[0,.20*Math.sin(2*phase),.055*Math.sin(phase)],
      TailTip:[.045*Math.sin(2*phase-.4),.10*Math.sin(2*phase-.4),0]};
  };
  const tracks=(frames,poses)=>['Head','TailBase','TailTip'].map(name=>new QuaternionKeyframeTrack(`${name}.quaternion`,frames,
    poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p[name])).toArray())));
  const zero={Head:[0,0,0],TailBase:[0,0,0],TailTip:[0,0,0]};
  return [new AnimationClip('Idle',duration,tracks(times,times.map(sample))),new AnimationClip('Rest',1,tracks([0,1],[zero,zero]))];
}
