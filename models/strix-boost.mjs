import { STRIX_BOOST as B } from './strix-definition.mjs';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const ramp=(t,a,b)=>smooth((t-a)/(b-a));

/** Task-space choreography only. IK and baked bone transforms live in strix-motion. */
export function strixBoost(time) {
  const t=Math.max(0,Math.min(B.duration,time));
  const flight=ramp(t,B.launch,.75)*(1-ramp(t,2.3,B.touchdown));
  const fold=ramp(t,.42,.95)*(1-ramp(t,2.05,2.65));
  const lean=ramp(t,.45,.90)*(1-ramp(t,1.95,2.65));
  const compression=-.12*ramp(t,0,B.launch)*(1-ramp(t,B.launch,.55))
    -.08*ramp(t,2.65,B.touchdown)*(1-ramp(t,B.touchdown,B.duration));
  const travel=B.distance*ramp(t,B.travelStart,B.travelEnd);
  const thrust=ramp(t,B.launch,.55)*(1-ramp(t,2.60,B.touchdown));
  return {position:[0,.65*flight+compression,travel],lift:.85*flight,fold,
    pitch:.13*lean-.06*ramp(t,2,2.3)*(1-ramp(t,2.3,2.7)),
    torsoPitch:.22*lean,footPitch:.24*fold,thrust,
    contact:t<=B.launch || t>=B.touchdown};
}
