import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import type { Object3D, AnimationClip, AnimationAction } from 'three';

/** Playback state and clip lifecycle, independent of DOM and render scheduling. */
export class AnimationPlayer {
  root: Object3D;
  clips: AnimationClip[];
  mixer: AnimationMixer;
  modes: Record<string, 'once' | 'repeat'>;
  onFinished: () => void;
  action: AnimationAction | null;
  playing: boolean;
  speed: number;
  constructor(root: Object3D, clips: AnimationClip[], { modes }: {modes?: Record<string, 'once' | 'repeat'>} = {}) {
    this.root = root;
    this.clips = clips;
    this.mixer = new AnimationMixer(root);
    this.modes = {};
    root.traverse(object => { if (object.userData.animationModes) this.modes = object.userData.animationModes; });
    if (modes) this.modes = { ...modes };
    this.onFinished = () => { this.playing = false; };
    this.mixer.addEventListener('finished', this.onFinished);
    this.action = null;
    this.playing = false;
    this.speed = 1;
    this.select(0);
  }
  get duration() { return this.action?.getClip().duration ?? 0; }
  get time() { return this.action?.time ?? 0; }
  select(index: number) {
    this.mixer.stopAllAction();
    this.action = this.clips[index] ? this.mixer.clipAction(this.clips[index]).reset().play() : null;
    if (this.action) {
      const once = this.modes[this.action.getClip().name] === 'once';
      this.action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
      this.action.clampWhenFinished = once;
    }
    this.playing = Boolean(this.action);
    this.mixer.update(0);
  }
  update(delta: number) { if (this.playing) this.mixer.update(delta * this.speed); }
  play() {
    if (!this.action) return;
    if (this.action.time >= this.duration) this.action.reset().play();
    this.action.paused = false;
    this.playing = true;
  }
  seek(time: number) {
    if (!this.action) return;
    this.playing = false;
    this.action.paused = false;
    this.action.time = Math.max(0, Math.min(time, this.duration - 1e-7));
    this.mixer.update(0);
  }
  dispose() {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.action = null;
    this.playing = false;
  }
}
