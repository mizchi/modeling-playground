import { AnimationMixer, Box3 } from 'three';

/** Playback state and clip lifecycle, independent of DOM and render scheduling. */
export class AnimationPlayer {
  constructor(root, clips) {
    this.root = root;
    this.clips = clips;
    this.mixer = new AnimationMixer(root);
    this.action = null;
    this.playing = false;
    this.speed = 1;
    this.select(0);
  }
  get duration() { return this.action?.getClip().duration ?? 0; }
  get time() { return this.action?.time ?? 0; }
  select(index) {
    this.mixer.stopAllAction();
    this.action = this.clips[index] ? this.mixer.clipAction(this.clips[index]).reset().play() : null;
    this.playing = Boolean(this.action);
    this.mixer.update(0);
  }
  update(delta) { if (this.playing) this.mixer.update(delta * this.speed); }
  seek(time) {
    if (!this.action) return;
    this.playing = false;
    this.action.time = Math.max(0, Math.min(time, this.duration - 1e-7));
    this.mixer.update(0);
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.action = null;
    this.playing = false;
  }
}

export function updateSkinBounds(root) {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (object.isSkinnedMesh) { object.computeBoundingBox(); object.computeBoundingSphere(); }
  });
}

/** Include the full cycle in camera framing, preserving playback state. */
export function animationBounds(player, samples = 36) {
  const bounds = new Box3();
  const { time, playing } = player;
  if (!player.duration) return bounds.setFromObject(player.root);
  for (let i=0;i<=samples;i++) {
    player.seek(player.duration*i/samples);
    updateSkinBounds(player.root);
    bounds.union(new Box3().setFromObject(player.root));
  }
  player.seek(time);
  player.playing = playing;
  updateSkinBounds(player.root);
  return bounds;
}
