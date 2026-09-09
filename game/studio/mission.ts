import type { SceneDocument } from './contracts.ts';
export interface MissionState {phase:'ready'|'playing'|'paused'|'won'|'lost';elapsed:number;wave:number;cleared:number;reason:'eliminated'|'timeout'|null}
export const createMission=(_doc:SceneDocument):MissionState=>({phase:'ready',elapsed:0,wave:0,cleared:0,reason:null});
export function advanceMission(previous:MissionState,dt:number,hp:Record<string,number>,playerHp:number,doc:SceneDocument):MissionState {
  if(previous.phase!=='playing')return previous;
  const state={...previous,elapsed:previous.elapsed+Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0)),
    cleared:doc.stage.targets.filter(t=>hp[t.id]===0).length};
  if(playerHp<=0)return {...state,phase:'lost',reason:'eliminated'};
  if(state.cleared===doc.stage.targets.length)return {...state,phase:'won'};
  if(state.elapsed>=doc.mission.timeLimit)return {...state,elapsed:doc.mission.timeLimit,phase:'lost',reason:'timeout'};
  if(doc.mission.waves[state.wave].targets.every(id=>hp[id]===0)&&state.wave+1<doc.mission.waves.length)state.wave++;
  return state;
}
