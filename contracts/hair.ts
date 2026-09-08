import type { HairDynamics } from './hair.types.ts';
export type { HairChain, HairDynamics } from './hair.types.ts';
export function validateHairDynamics(input: unknown): HairDynamics {
  const value=input as HairDynamics;
  const fail=()=>{throw new Error('Invalid hair dynamics contract');};
  const finite=(n: number,min: number,max: number)=>Number.isFinite(n)&&n>=min&&n<=max;
  if(!value||value.version!==1||value.space!=='anchor-local'||typeof value.anchor!=='string'||!value.anchor||
    !Array.isArray(value.chains)||!value.chains.length||!Array.isArray(value.colliderHints))fail();
  const ids=new Set<string>(),joints=new Set([value.anchor]);
  for(const c of value.chains) {
    if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||c.pinned!==1||!Array.isArray(c.joints)||c.joints.length!==3||
      !finite(c.radius,.001,1)||!finite(c.stiffness,0,1)||!finite(c.drag,0,1)||!finite(c.maxAngle,.01,Math.PI))fail();
    ids.add(c.id);
    for(const name of c.joints){if(typeof name!=='string'||!name||joints.has(name))fail();joints.add(name);}
  }
  for(const c of value.colliderHints)if(!c||typeof c.bone!=='string'||!c.bone||!Array.isArray(c.center)||
    c.center.length!==3||!c.center.every(Number.isFinite)||!finite(c.radius,.001,10))fail();
  return value;
}
