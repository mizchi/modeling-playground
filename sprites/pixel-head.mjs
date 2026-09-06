/** The 8-head skull projects to fewer than 5 pixels. Re-rasterizing it at a
 * fractional position changes its footprint. Keep a direction-specific pixel
 * part instead: identical 4×5 occupancy, integer translation, no temporal repaint.
 * Values are shared palette indices. Features stay INSIDE the common silhouette.
 */
const HEADS={
  s: [0,13,13,0, 12,13,13,12, 12,14,14,12, 12,13,13,12, 0,12,12,0],
  sw:[0,13,12,0, 13,13,12,11, 14,13,14,11, 13,13,12,11, 0,12,11,0],
  w: [0,13,12,0, 13,13,12,11, 14,13,12,11, 13,12,12,11, 0,12,11,0],
  nw:[0,12,12,0, 12,12,11,11, 12,12,11,11, 12,11,11,11, 0,11,11,0],
  n: [0,12,12,0, 12,12,12,11, 12,12,11,11, 12,11,11,11, 0,11,11,0],
  ne:[0,12,12,0, 11,11,12,12, 11,11,12,12, 11,11,11,12, 0,11,11,0],
  e: [0,12,13,0, 11,12,13,13, 11,12,13,14, 11,12,12,13, 0,11,12,0],
  se:[0,12,13,0, 11,12,13,13, 11,14,13,14, 11,12,13,13, 0,11,12,0],
};

export function pixelHead(direction,center) {
  if(!HEADS[direction]) throw new Error('unknown direction');
  return {x:Math.round(center[0]-2),y:Math.round(center[1]-2.5),width:4,height:5,
    pixels:Uint8Array.from(HEADS[direction])};
}
