/** Broad gently curved front surface, shared by cheek boundary and texture beds. */
export const base45FaceDepth=(x,y)=>.184-.95*x*x+.018*(y-1.932);

/** Local ten-sided loops remain editable guides for painted eyes. No modeled
 * eyeball bulge or deep socket: all rings follow one continuous face surface. */
export function appendBase45Eyes(builder, eyeRows) {
  const {vertex,bridge,cap}=builder;
  const k=Math.SQRT1_2;
  const circle=[[-k,-k],[0,-1],[k,-k],[1,-1/3],[1,1/3],[k,k],[0,1],[-k,k],[-1,1/3],[-1,-1/3]];
  for(const side of [1,-1]) {
    const name=side===1?'Left':'Right';
    const cols=side===1?[0,1,2]:[0,11,10];
    const [lower,middleLow,middleHigh,upper]=eyeRows;
    const boundary=[lower[cols[0]],lower[cols[1]],lower[cols[2]],middleLow[cols[2]],middleHigh[cols[2]],upper[cols[2]],upper[cols[1]],upper[cols[0]],middleHigh[cols[0]],middleLow[cols[0]]];
    const loop=(width,height,inset)=>circle.map(([u,v])=>{
      const x=side*(.102+u*width),y=1.932+v*height;
      return vertex([x,y,base45FaceDepth(x,y)-inset],'Head');
    });
    const orbit=loop(.070,.050,0),lid=loop(.056,.040,.001);
    bridge(boundary,orbit,`Head.${name}Orbit`);
    bridge(orbit,lid,`Head.${name}Lid`);
    cap(lid,`Head.${name}Eye`,'Head',[side*.102,1.932,base45FaceDepth(.102,1.932)-.001]);
  }
}
