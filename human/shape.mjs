const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const bell=(x,center,radius)=>Math.exp(-(((x-center)/radius)**2));

/** Continuous rest-space deformation, not a camera-dependent silhouette edit.
 * UVs remain attached to their vertices. Hair shares the broad head envelope,
 * while the local nose/eye fields affect only skin. Neutral is exact identity. */
export function shapePoint([x,y,z],shape,kind='body') {
  const head=smooth(1.63,1.79,y),front=smooth(.035,.14,z);
  const width=1+shape.faceWidth*.12*head;
  let px=x*width,py=y+(y-1.985)*shape.faceLength*.16*head,pz=z;
  if(kind==='body') {
    pz+=shape.noseHeight*.030*bell(x,0,.034)*bell(y,1.89,.04)*front;
    px+=Math.sign(x)*shape.eyeSpacing*.013*bell(Math.abs(x),.092,.060)*bell(y,1.936,.065)*front;
  }
  return [px,py,pz];
}
