import { Box3 } from 'three';
export { AnimationPlayer } from '../runtime/animation-player.mjs';

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
