import * as T from 'three';
import { createRig, skinRigidParts } from '../modeling/rig.mjs';
import { rigidPrimitives } from '../modeling/primitives.mjs';
import { STRIX_GAIT as G, STRIX_LEGS, STRIX_SPEC, STRIX_RIGHT_ELBOW } from './strix-definition.mjs';
import { limbFrame, strixClips } from './strix-motion.mjs';

export function createStrix() {
  const {root,bones}=createRig(STRIX_SPEC,'STRIX-04');
  root.userData={title:'STRIX-04 / quadruped siege platform',assetId:'strix',assetVersion:1,groundLevel:0,
    rigged:true,animationModes:{Idle:'repeat',Walk:'repeat',Advance:'once'}};
  const mat=(name,color,metalness=.55,roughness=.48)=>Object.assign(new T.MeshStandardMaterial({color,metalness,roughness}),{name});
  const blue=mat('Slate blue armor','#536998'),edge=mat('Light armor bevel','#91a4c4'),navy=mat('Secondary armor','#35445e');
  const frame=mat('Gunmetal skeleton','#252e39',.74,.42),steel=mat('Actuator steel','#889299',.8,.31);
  const black=mat('Bore and vents','#0e151c',.25,.78),white=mat('Identification','#bdc7d3',.3,.55);
  const optic=mat('Crimson optic','#f14e46',.3,.25);optic.emissive.set('#d62d24');optic.emissiveIntensity=1.3;
  const {add,box,hull,plate}=rigidPrimitives(bones,{bevelSize:.016,bevelThickness:.010});
  const rod=(parent,name,a,b,r,m=steel,r2=r,sides=12)=>{
    const av=new T.Vector3(...a),bv=new T.Vector3(...b);
    const part=add(parent,name,new T.CylinderGeometry(r2,r,av.distanceTo(bv),sides),m,av.clone().add(bv).multiplyScalar(.5).toArray());
    part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return part;
  };
  const vent=(parent,name,at,w,h)=>{
    box(parent,name+'Recess',at,[w,h,.03],black);
    for(let i=0;i<5;i++)box(parent,name+'Slat'+i,[at[0],at[1]+(i-2)*h/6,at[2]+.025],[w*.92,.018,.04],steel);
  };
  // A long, thick cruciform chassis supports four distinct diagonal leg roots.
  hull('Hull','Armored chassis',[
    [-.63,-.22,-.92],[.63,-.22,-.92],[-.80,-.12,-.55],[.80,-.12,-.55],[-.78,-.14,.70],[.78,-.14,.70],
    [-.45,-.18,1.02],[.45,-.18,1.02],[-.58,.27,-.73],[.58,.27,-.73],[-.65,.24,.65],[.65,.24,.65],[0,.10,1.22]],navy);
  box('Hull','Turntable base',[0,.31,-.09],[.91,.20,1.0],frame);
  rod('Hull','Turret slew ring',[0,.29,-.10],[0,.44,-.10],.53,steel,.53,24);
  for(const s of [-1,1]) {
    hull('Hull',s+'Forward skirt',[[s*.08,.23,.54],[s*.70,.24,.37],[s*.82,.05,.91],[s*.22,-.17,1.10],[s*.08,.05,1.19]],blue);
    hull('Hull',s+'Rear fender',[[s*.53,.26,-.49],[s*1.14,.19,-.67],[s*1.20,.09,-1.01],[s*.66,.02,-1.12],[s*.42,.11,-.86]],blue);
    box('Hull',s+'Flank actuator',[s*.78,.06,-.06],[.22,.23,.68],steel);
  }
  // Chest is a split prow with a narrow central aperture, not a human-shaped face.
  box('Torso','Torso cage',[0,.20,-.10],[.87,.71,.65],frame);
  hull('Torso','Thorax keel',[[-.42,-.12,.16],[.42,-.12,.16],[-.57,.48,-.19],[.57,.48,-.19],
    [-.24,.59,.24],[.24,.59,.24],[0,.22,.87],[0,-.25,.58]],navy);
  for(const s of [-1,1]) {
    hull('Torso',s+'Chest blade',[[s*.08,.46,.37],[s*.55,.57,.06],[s*.83,.22,.19],[s*.34,-.06,.67],[s*.12,.06,.76]],blue);
    hull('Torso',s+'Collar facet',[[s*.13,.62,.03],[s*.53,.57,-.25],[s*.63,.41,.05],[s*.23,.42,.35]],edge);
    plate('Torso',s+'Chest intake',[[s*.15,.35],[s*.43,.40],[s*.42,.28],[s*.20,.20]],.025,.57,black);
    box('Torso',s+'Back engine',[s*.42,.13,-.56],[.32,.64,.37],navy);
    rod('Torso',s+'Exhaust pipe',[s*.43,.34,-.66],[s*.43,.04,-.87],.10,steel,.14);
    box('Torso',s+'Rear cooling fin',[s*.45,.54,-.48],[.38,.07,.54],blue);
  }
  vent('Torso','Back radiator',[0,.18,-.466],.37,.43);
  rod('Head','Neck bearing',[0,-.04,-.02],[0,.06,-.02],.13,frame);
  hull('Head','Spearhead helmet',[[0,.30,.12],[-.29,.13,-.19],[.29,.13,-.19],[-.30,.02,.16],[.30,.02,.16],
    [-.15,-.15,.22],[.15,-.15,.22],[0,-.075,.65],[0,.14,.47],[0,-.20,-.10]],blue);
  hull('Head','Crown ridge',[[0,.34,-.02],[-.08,.21,.25],[.08,.21,.25],[0,.15,.57],[0,.24,-.22]],edge);
  for(const s of [-1,1]) {
    hull('Head',s+'Black optic recess',[[s*.025,.052,.50],[s*.23,.055,.22],[s*.20,-.034,.26],[s*.045,-.027,.51]],black);
    rod('Head',s+'Optic strip',[s*.064,.02,.501],[s*.181,.025,.333],.013,optic,.013,6);
    hull('Head',s+'Swept temple fin',[[s*.23,.06,.02],[s*.35,.13,-.43],[s*.29,-.13,-.19],[s*.20,-.09,.16]],navy);
  }

  for(const leg of STRIX_LEGS) {
    const upper=leg.id+'Upper',lower=leg.id+'Lower',foot=leg.id+'Foot';
    // Author plates in a straight limb frame, then bake their rest-frame transform
    // into geometry. Bone rest rotations remain identity for the asset contract.
    const limb=(parent,start,end,build,facing)=>{
      const existing=new Set(bones[parent].children),q=limbFrame(new T.Vector3(...end).sub(new T.Vector3(...start)),facing);
      build();
      for(const object of [...bones[parent].children])if(!existing.has(object)) {
        object.position.applyQuaternion(q);object.quaternion.premultiply(q);
      }
    };
    limb(upper,leg.hip,leg.knee,()=>{
      rod(upper,leg.id+'Hip drum',[-.25,0,0],[.25,0,0],.21,frame);
      box(upper,leg.id+'Upper spar',[0,-G.upper/2,0],[.24,G.upper-.10,.27],frame);
      hull(upper,leg.id+'Long thigh blade',[
        [-.25,-.13,-.09],[.25,-.13,-.09],[-.38,-.47,.03],[.38,-.47,.03],[-.26,-1.20,.03],[.26,-1.20,.03],
        [0,-1.42,.13],[-.26,-.28,.29],[.26,-.28,.29],[0,-1.16,.33]],blue);
      plate(upper,leg.id+'Thigh inset',[[-.14,-.35],[.14,-.35],[.13,-1.01],[0,-1.20],[-.13,-1.01]],.035,.318,navy);
      box(upper,leg.id+'Thigh white marker',[.17,-.46,.335],[.055,.19,.020],white);
      for(const s of [-1,1]) {
        rod(upper,leg.id+s+'Hydraulic body',[s*.24,-.19,-.12],[s*.24,-.80,-.12],.067,navy);
        rod(upper,leg.id+s+'Hydraulic rod',[s*.24,-.79,-.12],[s*.24,-1.34,-.12],.033,steel);
      }
    });
    limb(lower,leg.knee,leg.ankle,()=>{
      rod(lower,leg.id+'Knee drum',[-.30,0,0],[.30,0,0],.205,frame,.205,16);
      for(const s of [-1,1])rod(lower,leg.id+s+'Knee collar',[s*.23,0,0],[s*.28,0,0],.218,steel,.218,16);
      for(const s of [-1,1])rod(lower,leg.id+s+'Knee hub',[s*.30,0,0],[s*.325,0,0],.11,black);
      box(lower,leg.id+'Lower spar',[0,-G.lower/2,0],[.22,G.lower-.06,.25],frame);
      hull(lower,leg.id+'Shin lance',[
        [-.29,-.11,.02],[.29,-.11,.02],[-.32,-.34,.13],[.32,-.34,.13],[-.14,-1.15,.04],[.14,-1.15,.04],
        [0,-1.35,.10],[-.19,-.22,.34],[.19,-.22,.34],[0,-1.10,.30]],blue);
      plate(lower,leg.id+'Shin facet',[[-.12,-.29],[.12,-.29],[.08,-.80],[0,-1.09],[-.08,-.80]],.025,.325,navy);
      plate(lower,leg.id+'Knee cap',[[-.23,.12],[.23,.12],[.28,-.12],[0,-.34],[-.28,-.12]],.14,.205,navy);
      rod(lower,leg.id+'Ankle ram',[0,-.88,-.13],[0,-1.57,-.13],.047,steel);
    },new T.Vector3(leg.side,0,leg.fore));
    rod(foot,leg.id+'Ankle pin',[-.16,0,0],[.16,0,0],.11,steel);
    const shoe=hull(foot,leg.id+'Pointed foot',[
      [-.19,-.16,-.19],[.19,-.16,-.19],[-.12,-.16,.43],[.12,-.16,.43],
      [-.17,.07,-.15],[.17,.07,-.15],[-.10,-.07,.43],[.10,-.07,.43]],blue);
    const yaw=Math.atan2(leg.side,leg.fore);shoe.rotation.y=yaw;
    const sole=box(foot,leg.id+'Sole',[0,-.14,.10],[.26,.04,.57],black);sole.position.applyAxisAngle(new T.Vector3(0,1,0),yaw);sole.rotation.y=yaw;
  }
  for(const [label,s] of [['Left',1],['Right',-1]]) {
    const arm=label+'Arm',forearm=label+'Forearm',hand=label+'Hand',cannon=label+'Cannon';
    rod(arm,label+'Shoulder joint',[-.18,0,0],[.18,0,0],.21,frame);
    hull(arm,label+'Shoulder shield',[
      [-.32,-.14,-.25],[.32,-.14,-.25],[-.33,.19,-.21],[.33,.19,-.21],
      [-.22,.39,.06],[.22,.39,.06],[-.32,-.07,.35],[.32,-.07,.35],[s*.47,-.35,.17]],blue);
    rod(arm,label+'Arm spar',[0,-.14,0],[s*.14,-.49,.12],.115,frame);
    box(arm,label+'Upper arm plate',[s*.07,-.30,.15],[.30,.37,.18],navy).rotation.z=s*.15;
    rod(forearm,label+'Elbow',[-.20,0,0],[.20,0,0],.15,steel);
    hull(forearm,label+'Forearm armor',[[-.22,-.02,.06],[.22,-.02,.06],[-.26,-.28,.14],[.26,-.28,.14],
      [-.13,-.50,.27],[.13,-.50,.27],[-.17,-.17,.34],[.17,-.17,.34]],blue);
    box(hand,label+'Gripper shell',[0,-.06,.04],[.22,.21,.25],frame);
    if(label==='Right') {
      box(hand,'Rifle receiver',[0,-.07,.49],[.30,.28,.88],navy);
      hull(hand,'Rifle long jacket',[[-.14,-.21,.78],[.14,-.21,.78],[-.15,.08,.78],[.15,.08,.78],
        [-.12,-.20,2.02],[.12,-.20,2.02],[-.08,.015,2.16],[.08,.015,2.16]],frame);
      box(hand,'Rifle muzzle',[0,-.08,2.162],[.13,.095,.014],black);
      box(hand,'Rifle rail',[0,.11,.66],[.07,.055,1.02],steel);
      box(hand,'Rifle magazine',[0,-.33,.44],[.22,.31,.34],frame);
    } else {
      plate(forearm,'Left elongated shield',[[-.17,.13],[.25,.10],[.37,-.28],[.10,-.89],[-.24,-.34]],.12,.40,navy);
      plate(forearm,'Left shield face',[[-.12,.02],[.17,.02],[.25,-.26],[.08,-.70],[-.15,-.28]],.05,.485,blue);
    }
    box(cannon,label+'Cannon saddle',[0,0,0],[.38,.28,.38],frame);
    box(cannon,label+'Cannon breech',[0,.20,.05],[.46,.44,.70],navy);
    rod(cannon,label+'Rotary jacket',[0,.20,.36],[0,.20,1.70],.24,frame,.22,16);
    for(const z of [.48,.93,1.46,1.72])rod(cannon,label+'Barrel band'+z,[0,.20,z],[0,.20,z+.07],.26,steel,.26,16);
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+Math.PI/4,x=Math.cos(a)*.13,y=.20+Math.sin(a)*.13;
      rod(cannon,label+'Inner barrel'+i,[x,y,1.53],[x,y,1.91],.067,steel);
      add(cannon,label+'Bore'+i,new T.CircleGeometry(.045,10),black,[x,y,1.912]);
    }
    for(let i=0;i<4;i++)box(cannon,label+'Cooling slot'+i,[0,.435,.62+i*.22],[.09,.014,.10],black);
    hull(cannon,label+'Ammunition pod',[[-.28,-.03,-.19],[.28,-.03,-.19],[-.30,.43,-.21],[.30,.43,-.21],
      [-.24,.35,-.76],[.24,.35,-.76],[-.24,.02,-.78],[.24,.02,-.78]],blue);
  }
  // Bent right elbow keeps the horizontal rifle above the front leg. Bake this
  // into the rest geometry/hand offset while preserving identity rest rotations.
  for(const part of bones.RightForearm.children)if(part.isMesh) {
    part.position.applyAxisAngle(new T.Vector3(1,0,0),STRIX_RIGHT_ELBOW);
    part.rotateX(STRIX_RIGHT_ELBOW);
  }
  skinRigidParts(root,bones);
  return {root,bones,clips:strixClips(),definition:STRIX_SPEC};
}
