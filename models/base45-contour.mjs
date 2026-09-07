/** Match the incoming facial slope and end with a lateral tangent. Restarting
 * a quarter ellipse at every frontal edge creates an artificial raised rim. */
export function contourTurn(previous,a,b,t) {
  if(t===0)return [...a];if(t===1)return [...b];
  const dx=b[0]-a[0],tangentX=dx*1.5;
  const slope=(a[2]-previous[2])/(a[0]-previous[0]);
  // Clamp only to prevent a very steep authored jaw segment overshooting.
  const tangentZ=Math.max(3*(b[2]-a[2]),Math.min(0,slope*tangentX));
  const t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
  return [a[0]+dx*(1.5*t-.5*t3),a[1]+(b[1]-a[1])*t,
    h00*a[2]+h10*tangentZ+h01*b[2]+h11*1.2*(b[2]-a[2])];
}

/** Two inserted columns turn the frontal cheek plane toward the side of the
 * cranium. Keep the original eye-patch boundary and maximum head width intact. */
export function appendContourColumns(builder, original) {
  const {vertex,data}=builder;
  const positive=[],negative=[];
  for(const side of [1,-1]) {
    const previous=data.positions[original[side===1?1:11]];
    const a=data.positions[original[side===1?2:10]],b=data.positions[original[side===1?3:9]];
    const added=[.32,.68].map(t=>vertex(contourTurn(previous,a,b,t),'Head'));
    (side===1?positive:negative).push(...added);
  }
  return {
    positive:[original[2],...positive,original[3]],
    negative:[original[9],...negative.toReversed(),original[10]],
    perimeter:[...original.slice(0,3),...positive,...original.slice(3,10),...negative.toReversed(),...original.slice(10)],
  };
}

export function bridgeContour(builder, previous, next, neckLoop) {
  for(const [key,name,index] of [['positive','Left',2],['negative','Right',9]]) {
    const b=next[key],region=`Head.${name}Contour`;
    if(previous) {
      const a=previous[key];
      for(let i=0;i<3;i++)builder.face([a[i],a[i+1],b[i+1],b[i]],region);
    } else {
      const a=neckLoop[index],c=neckLoop[index+1];
      builder.face([a,c,b[3],b[2]],region);
      builder.face([a,b[2],b[1],b[0]],region);
    }
  }
}
