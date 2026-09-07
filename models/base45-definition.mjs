/** Body anchors are unchanged; the texture-friendly head is shortened to .45 m.
 * BASE-45 is the study id, not a strict current head-count constraint. */
export const BASE45=Object.freeze({id:'base45',height:2.20,headHeight:.45,headBase:1.75});
export const BASE45_BONES=[
  ['Root',null,[0,0,0]],['Hips','Root',[0,1.02,0]],['Spine','Hips',[0,1.22,0]],
  ['Chest','Spine',[0,1.46,0]],['Neck','Chest',[0,1.65,-.015]],['Head','Neck',[0,1.76,0]],
  ...[1,-1].flatMap(s=>{const n=s===1?'Left':'Right';return [
    [n+'Clavicle','Chest',[s*.09,1.56,0]],[n+'UpperArm',n+'Clavicle',[s*.29,1.535,0]],
    [n+'Forearm',n+'UpperArm',[s*.60,1.535,0]],[n+'Hand',n+'Forearm',[s*.89,1.535,0]],
    [n+'Thigh','Hips',[s*.12,1.025,0]],[n+'Shin',n+'Thigh',[s*.15,.585,.025]],
    [n+'Foot',n+'Shin',[s*.17,.16,-.015]],[n+'Toe',n+'Foot',[s*.17,.06,.13]],
  ];}),
].map(([name,parent,position])=>({name,parent,position}));
