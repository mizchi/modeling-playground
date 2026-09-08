import { Vector3 } from 'three';
import { heightScale } from './proportions.mjs';

/** Measure the rest mesh, never animated bounds (which would make playback zoom).
 * Camera scale is display state; the exported model remains in world units. */
export function humanFraming(root) {
  const geometry=root.getObjectByName('BaseBody').geometry;geometry.computeBoundingBox();
  const box=geometry.boundingBox,height=box.max.y-box.min.y;
  const scale=heightScale(root.userData.humanRecipe.bodyShape);
  const head=root.getObjectByName('Head').getWorldPosition(new Vector3());
  return {
    body:{target:[(box.min.x+box.max.x)/2,box.min.y+height*1.23/2.2,0],distance:4.8*height/2.2},
    face:{target:[head.x,head.y+.21*scale,head.z],distance:1.9*scale},
  };
}
