/** Source contract: metres, Y up, Z forward; normalized phase in [0, 1).
 * Raster contract: top-down palette indices; index 0 is transparent.
 * Frame origin never changes. Coordinates are projected before quantization.
 */
export const SPEC=Object.freeze({width:32,height:48,frames:8,period:0.8,
  scale:22,anchor:[16,44],stride:0.40,travelPerCycle:0.80,
  upperLeg:0.40,lowerLeg:0.40,upperArm:0.25,lowerArm:0.24,ankleHeight:0.075});

/** Head count is neutral standing height / crown-to-chin height, before rasterization.
 * All presets share 1.76 stature and camera scale. Shorter limbs get shorter strides.
 */
export const PROPORTIONS=Object.freeze([
  {id:'8head',label:'8頭身',heads:8,bodyWidth:.96,limbWidth:.90,pixelHead:true},
  {id:'4head',label:'4頭身',heads:4,bodyWidth:1.05,limbWidth:1.04},
  {id:'3head',label:'3頭身',heads:3,bodyWidth:1.16,limbWidth:1.14},
  {id:'2head',label:'2頭身',heads:2,bodyWidth:1.24,limbWidth:1.22},
  {id:'legacy',label:'元の素体（約5頭身）',heads:1.76/.35,bodyWidth:1,limbWidth:1},
].map(Object.freeze));

export function getRig(id='legacy') {
  const profile=PROPORTIONS.find(p=>p.id===id);
  if(!profile) throw new Error(`unknown proportion: ${id}`);
  const stature=1.76,headHeight=id==='legacy'?.35:stature/profile.heads;
  const bodyScale=id==='legacy'?1:(stature-headHeight)/(stature-.35);
  return {...SPEC,...profile,stature,headHeight,headScale:headHeight/.35,bodyScale,
    headCenter:stature-headHeight/2,bounce:.018*bodyScale,sway:.009*bodyScale,lift:.07*bodyScale,
    upperLeg:SPEC.upperLeg*bodyScale,lowerLeg:SPEC.lowerLeg*bodyScale,
    upperArm:SPEC.upperArm*bodyScale,lowerArm:SPEC.lowerArm*bodyScale,
    ankleHeight:SPEC.ankleHeight*bodyScale,stride:SPEC.stride*bodyScale,
    travelPerCycle:SPEC.travelPerCycle*bodyScale};
}

export function artifactNames(id='legacy') {
  getRig(id); // Reject names that cannot correspond to a known source rig.
  const prefix=id==='legacy'?'sprite-walk':`sprite-walk-${id}`;
  return {debug:`${prefix}-debug.png`,neutral:`${prefix}-neutral.png`,metadata:`${prefix}.json`};
}

export const DIRECTIONS=Object.freeze([
  {id:'s',label:'下・正面',yaw:0}, {id:'sw',label:'左下',yaw:Math.PI/4},
  {id:'w',label:'左・側面',yaw:Math.PI/2}, {id:'nw',label:'左上',yaw:Math.PI*3/4},
  {id:'n',label:'上・背面',yaw:Math.PI}, {id:'ne',label:'右上',yaw:Math.PI*5/4},
  {id:'e',label:'右・側面',yaw:Math.PI*3/2}, {id:'se',label:'右下',yaw:Math.PI*7/4},
]);
export const PALETTE=Object.freeze([
  [0,0,0,0], [31,34,44,255],
  [82,91,109,255], [146,155,165,255], [215,216,205,255],
  [25,88,111,255], [42,158,177,255], [111,216,220,255],
  [126,49,49,255], [205,92,73,255], [248,159,114,255],
  [119,88,69,255], [189,155,115,255], [242,214,164,255],
  [47,39,36,255], [249,240,213,255],
]);
