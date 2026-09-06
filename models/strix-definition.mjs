import { Vector3 } from 'three';
import { solveTwoBone } from '../runtime/solvers.mjs';
import { validateAssetSpec } from '../contracts/asset.mjs';

const freeze=v=>{if(v && typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const STRIX_RIGHT_ELBOW=-1.4;
export const STRIX_GAIT=freeze({duration:2.4,duty:.62,stride:.72,lift:.26,upper:1.62,lower:1.62,footHeight:.16,speed:.72/(.62*2.4)});
export const STRIX_STANCE=freeze({hullHeight:1.58,hipDrop:.06,footX:2.0,footZ:1.65});
export const STRIX_BOOST=freeze({duration:3.2,distance:4.8,launch:.25,travelStart:.55,travelEnd:2.55,touchdown:2.85});
export const STRIX_JETS=freeze(['Left','Right'].flatMap((label,i)=>{
  const side=i===0?1:-1;
  return [
    {name:label+'MainJet',bone:'Torso',position:[side*.42,.24,-.82],direction:[0,-.5,-1],length:1.9,radius:.16},
    {name:label+'LiftJet',bone:'Hull',position:[side*.57,-.23,.05],direction:[0,-1,-.18],length:.65,radius:.12},
  ];
}));
export const STRIX_LEGS=freeze([
  {id:'FrontLeft',side:1,fore:1,phase:0},
  {id:'RearRight',side:-1,fore:-1,phase:0},
  {id:'FrontRight',side:-1,fore:1,phase:.5},
  {id:'RearLeft',side:1,fore:-1,phase:.5},
].map(leg=>{
  const hip=[leg.side*.65,STRIX_STANCE.hullHeight-STRIX_STANCE.hipDrop,leg.fore*.66];
  const ankle=[leg.side*STRIX_STANCE.footX,STRIX_GAIT.footHeight,leg.fore*STRIX_STANCE.footZ];
  const pole=[leg.side*3.8,1.7,leg.fore*2.9];
  const knee=solveTwoBone(new Vector3(...hip),new Vector3(...ankle),new Vector3(...pole),STRIX_GAIT.upper,STRIX_GAIT.lower).joint.toArray();
  return {...leg,hip,knee,ankle,pole};
}));
const bones=[{name:'Motion',parent:null,position:[0,0,0]},
  {name:'Hull',parent:'Motion',position:[0,STRIX_STANCE.hullHeight,0]},
  {name:'Torso',parent:'Hull',position:[0,.56,-.10]},
  {name:'Head',parent:'Torso',position:[0,.73,.29]}];
for(const jet of STRIX_JETS)bones.push({name:jet.name,parent:jet.bone,position:jet.position});
for(const leg of STRIX_LEGS) {
    bones.push({name:leg.id+'Upper',parent:'Hull',position:[leg.hip[0],-STRIX_STANCE.hipDrop,leg.hip[2]]},
    {name:leg.id+'Lower',parent:leg.id+'Upper',position:leg.knee.map((v,i)=>v-leg.hip[i])},
    {name:leg.id+'Foot',parent:leg.id+'Lower',position:leg.ankle.map((v,i)=>v-leg.knee[i])});
}
for(const [label,s] of [['Left',1],['Right',-1]])bones.push(
  {name:label+'Arm',parent:'Torso',position:[s*.98,.35,.06]},
  {name:label+'Forearm',parent:label+'Arm',position:[s*.15,-.54,.13]},
  {name:label+'Hand',parent:label+'Forearm',position:new Vector3(0,-.43,.20).applyAxisAngle(new Vector3(1,0,0),label==='Right'?STRIX_RIGHT_ELBOW:0).toArray()},
  {name:label+'Cannon',parent:'Torso',position:[s*.84,.86,-.48]});

export const STRIX_SPEC=freeze(validateAssetSpec({version:1,id:'strix',units:'meters',coordinateSystem:'gltf-y-up',forward:'+Z',groundLevel:0,
  rig:{bones},
  sockets:[...STRIX_LEGS.map(leg=>({id:leg.id+'Contact',node:leg.id+'ContactSocket',bone:leg.id+'Foot',position:[0,-STRIX_GAIT.footHeight,0]})),
    ...STRIX_JETS.map(jet=>({id:jet.name+'Nozzle',node:jet.name+'Socket',bone:jet.bone,position:jet.position}))],
  colliders:[{id:'hull',bone:'Hull',shape:'box',center:[0,0,0],halfExtents:[.73,.28,.90]},
    {id:'torso',bone:'Torso',shape:'box',center:[0,.20,0],halfExtents:[.62,.43,.45]}],
  attacks:[],emitters:STRIX_JETS.map(jet=>({id:jet.name,socket:jet.name+'Nozzle',direction:new Vector3(...jet.direction).normalize().toArray(),preset:'ion',rate:90,lifetime:.18,speed:8})),
  clips:[...['Idle','Walk','Advance'].map(name=>({name,duration:STRIX_GAIT.duration,fps:60,mode:name==='Advance'?'once':'repeat',windows:[]})),
    {name:'Boost',duration:STRIX_BOOST.duration,fps:60,mode:'once',
      windows:STRIX_JETS.map(jet=>({kind:'emitter',id:jet.name,start:STRIX_BOOST.launch,end:STRIX_BOOST.touchdown}))}],
}));

export const STRIX_IK=freeze({version:1,coordinateSystem:'gltf-y-up',hips:'Hull',chains:STRIX_LEGS.map(leg=>({
  id:leg.id,label:(leg.fore>0?'前':'後')+(leg.side>0?'左':'右')+'足',upper:leg.id+'Upper',lower:leg.id+'Lower',end:leg.id+'Foot',pole:leg.pole,
}))});
