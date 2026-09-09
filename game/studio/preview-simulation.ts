import { advanceCombat, createCombat, type CombatFrame, type CombatWorld } from '../combat.ts';
import type { ActionDocument, GameEvent } from './contracts.ts';
export const PREVIEW_WORLD:CombatWorld={solids:[],targets:[{id:'preview',position:[0,0,16],yaw:Math.PI}]};
const FRAME:CombatFrame={eye:[0,3,0],forward:[0,0,1],aim:[0,3,16],mounts:{rifle:[0,3,2],missiles:[[-1,4,0],[1,4,0]]}};
/** Reconstruct a short attack from time zero. Pure replay supports backward seeks without side effects. */
export function replayAttack(action:ActionDocument,time:number) {
  let state=createCombat(PREVIEW_WORLD);
  const events:GameEvent[]=[],duration=Math.max(0,Math.min(1.5,Number.isFinite(time)?time:0));
  for(let elapsed=0;elapsed<duration-1e-9;elapsed+=1/120) {
    state=advanceCombat(state,{fire:elapsed===0,lock:false},FRAME,Math.min(1/120,duration-elapsed),PREVIEW_WORLD,action);
    events.push(...state.events);
  }
  return {...state,events};
}
