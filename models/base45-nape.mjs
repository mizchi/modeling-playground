/** Rear-center landmarks [Y,Z]. Spread the turn over height instead of flaring
 * nearly horizontally at the neck rim. Front/side jaw landmarks stay untouched. */
const rear={
  neckMiddle:[1.715,-.088],neckUpper:[1.775,-.100],underJaw:[1.810,-.125],
  chin:[1.840,-.151],jaw:[1.870,-.178],lowerCheek:[1.895,-.199],
  mouth:[1.920,-.217],nose:[1.945,-.235],
};

/** Offset a row using its original rear center, fading to zero at the ears.
 * Both halves use the same cosine field; no camera-space silhouette fitting. */
export function shapeBase45Nape(role,point,column,originalRear) {
  const target=rear[role];if(!target)return point;
  const amount=Math.max(0,-Math.cos(column*Math.PI/6))**2;
  return [point[0],point[1]+(target[0]-originalRear[1])*amount,point[2]+(target[1]-originalRear[2])*amount];
}
