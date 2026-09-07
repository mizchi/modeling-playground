/** Independent design; no LILA geometry or proportions are reused. +Z is forward. */
export const ASTER=Object.freeze({
  id:'aster',name:'ASTER · short-coat courier',headHeight:.53,triangleBudget:896,byteBudget:64*1024,
  faceScale:Object.freeze([.78,.86,.90]),
  palette:Object.freeze({skin:'#f4cbae',hair:'#d6ad59',hairLight:'#efd082',hairDark:'#ae8039',
    coat:'#293f49',coatSide:'#23353f',trim:'#78a7aa',cream:'#eee2c4',boot:'#26313c',sole:'#b77549',gold:'#dbb365'}),
});
export const ASTER_BONES=Object.freeze([
  ['Root',null,[0,0,0]],['Hips','Root',[0,.98,0]],['Chest','Hips',[0,1.36,0]],['Head','Chest',[0,1.48,0]],
  ...[1,-1].flatMap(side=>{
    const n=side===1?'Left':'Right';
    return [[n+'UpperArm','Chest',[side*.25,1.43,0]],[n+'Forearm',n+'UpperArm',[side*.44,1.15,0]],
      [n+'Hand',n+'Forearm',[side*.62,.88,0]],
      [n+'Thigh','Hips',[side*.135,.98,0]],[n+'Shin',n+'Thigh',[side*.155,.53,.016]],
      [n+'Foot',n+'Shin',[side*.17,.13,0]]];
  }),
].map(([name,parent,position])=>Object.freeze({name,parent,position:Object.freeze(position)})));
