import type { Impact } from '../combat.ts';
import type { Vec3 } from '../types.ts';
/** Deterministic spark positions, shared by preview and runtime; no random state to serialize. */
export function impactSparks(hit:Impact):{position:Vec3;scale:number}[] {
  const life=hit.kind==='kill'?1.2:.45,age=hit.age;
  if(age<0||age>=life)return [];
  const speed=hit.kind==='kill'?16:9;
  return Array.from({length:12},(_,i)=>({position:[
    hit.position[0]+Math.sin(i*2.4)*age*speed,
    hit.position[1]+Math.cos(i*1.8)*age*speed-age*age*10,
    hit.position[2]+Math.cos(i*2.4)*age*speed,
  ],scale:.11*(1-age/life)}));
}
