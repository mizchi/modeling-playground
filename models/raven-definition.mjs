import { validateAssetSpec } from '../contracts/asset.mjs';

const bones=[];
const bone=(name,parent,position)=>bones.push({name,parent,position});
bone('Motion',null,[0,.8,0]);bone('Hips','Motion',[0,1.78,0]);
bone('Spine','Hips',[0,.42,0]);bone('Neck','Spine',[0,.65,0]);bone('Head','Neck',[0,.17,0]);
for(const [label,s] of [['Left',-1],['Right',1]]) {
  bone(label+'Shoulder','Spine',[s*.54,.43,0]);bone(label+'UpperArm',label+'Shoulder',[s*.12,-.08,0]);
  bone(label+'Forearm',label+'UpperArm',[0,-.50,0]);bone(label+'Hand',label+'Forearm',[0,-.51,0]);
  bone(label+'Thigh','Hips',[s*.21,-.06,0]);bone(label+'Shin',label+'Thigh',[0,-.78,0]);
  bone(label+'Foot',label+'Shin',[0,-.69,0]);
  bone(label+'Booster','Spine',[s*.3,.24,-.39]);bone(label+'BackJet',label+'Booster',[0,-.40,-.03]);
  bone(label+'FootJet',label+'Foot',[0,-.18,-.035]);
}
// Preserve the existing exported rig contract; sockets are separate plain nodes.
bone('BladeTip','RightForearm',[.15,-1.62,.12]);
const sockets=[
  {id:'blade-root',node:'SocketBladeRoot',bone:'RightForearm',position:[.16,-.42,.12]},
  {id:'blade-tip',node:'SocketBladeTip',bone:'BladeTip',position:[0,0,0]},
];
const emitters=[];
for(const label of ['Left','Right'])for(const site of ['Back','Foot']) {
  const id=label.toLowerCase()+'-'+site.toLowerCase();
  // Attach to the nozzle, NOT the animated exhaust-scale bone.
  sockets.push({id,node:`Socket${label}${site}Exhaust`,bone:label+(site==='Back'?'Booster':'Foot'),
    position:site==='Back'?[0,-.435,-.03]:[0,-.175,-.035]});
  emitters.push({id,socket:id,direction:[0,-1,0],preset:'ion',rate:site==='Back'?60:30,lifetime:.2,speed:site==='Back'?5:3});
}
const collider=(id,bone,center,halfExtents)=>({id,bone,shape:'box',center,halfExtents});
const colliders=[collider('torso','Spine',[0,.25,.1],[.43,.35,.32]),collider('pelvis','Hips',[0,0,0],[.24,.24,.2]),
  collider('head','Head',[0,.06,0],[.23,.24,.23])];
for(const label of ['Left','Right']) {
  colliders.push(collider(label+'-arm',label+'Forearm',[0,-.27,.02],[.19,.24,.18]),
    collider(label+'-thigh',label+'Thigh',[0,-.39,0],[.17,.35,.18]),
    collider(label+'-shin',label+'Shin',[0,-.34,.02],[.17,.35,.2]));
}
const windows=(start,end)=>emitters.map(e=>({kind:'emitter',id:e.id,start,end}));
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

/** @type {import('../contracts/asset.mjs').AssetSpec} */
export const RAVEN_SPEC=deepFreeze(validateAssetSpec({
  version:1,id:'raven',units:'meters',coordinateSystem:'gltf-y-up',forward:'+Z',groundLevel:0,
  rig:{bones},sockets,colliders,attacks:[{id:'blade-slash',from:'blade-root',to:'blade-tip',radius:.08}],emitters,
  clips:[
    {name:'Hover',duration:2,fps:30,mode:'repeat',windows:windows(0,2)},
    {name:'Boost',duration:2.4,fps:30,mode:'once',windows:windows(0,2.4)},
    {name:'BladeSlash',duration:2.1,fps:60,mode:'once',windows:[{kind:'attack',id:'blade-slash',start:.6,end:.94},...windows(0,2.1)]},
  ],
}));
