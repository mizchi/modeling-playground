const ANKLE=.16,HIP=1.025;
export const heightScale=bodyShape=>1+.25*bodyShape.height;

/** Last rest-space layer: local body/face shaping uses original coordinates.
 * Soles stay at zero; the torso translates, and even waist-length hair translates
 * with the head rather than inheriting the legs' stretch field. */
export function applyProportions(point,bodyShape,kind) {
  const {legLength,height}=bodyShape;if(!legLength&&!height)return point;
  const [x,y,z]=point,scale=heightScale(bodyShape);
  const span=kind==='hair'?HIP-ANKLE:Math.max(0,Math.min(HIP-ANKLE,y-ANKLE));
  return [x*scale,(y+span*.30*legLength)*scale,z*scale];
}
