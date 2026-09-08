import type { BoneRow } from '../../../../modeling/types.ts';
export const EXPRESSION_NAMES=Object.freeze(['Happy','Angry','Surprised','Blink','Wink']);
export const FES256=Object.freeze({
  // 256 is now a study target, not an event-compliance limit (user relaxed it).
  id:'fes256',name:'LILA-256',headHeight:.57,triangleTarget:256,triangleBudget:512,byteBudget:32*1024,
  palette:Object.freeze({skin:'#f2cda8',hair:'#728c9b',hairLight:'#9bb0b8',coat:'#263b49',
    coatLight:'#385564',cream:'#eee3cf',white:'#fff8eb',boots:'#30303a',ink:'#292735',gold:'#d3a556'}),
});
export const FES256_BONES=Object.freeze(([
  ['Root',null,[0,0,0]],['Body','Root',[0,.73,0]],['Head','Body',[0,1.05,0]],
  ...[1,-1].flatMap<BoneRow>(side=>{
    const name=side===1?'Left':'Right';
    return [[`${name}Arm`,'Body',[side*.25,.96,0]],[`${name}Hand`,`${name}Arm`,[side*.39,.76,0]],
      [`${name}Leg`,'Body',[side*.14,.48,0]],[`${name}Foot`,`${name}Leg`,[side*.14,.12,0]]];
  }),
] satisfies BoneRow[]).map(([name,parent,position])=>Object.freeze({name,parent,position:Object.freeze(position)})));
