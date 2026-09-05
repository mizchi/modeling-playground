import * as T from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { ravenClips, RAVEN_MOTION } from './raven-motion.mjs';

/** Hard-surface armor is 100% weighted to its joint: metal never bends like skin. */
export function createRaven() {
  const root=new T.Group();root.name='Raven';
  root.userData={title:'RAVEN-03 / vector interceptor',generator:'Three.js',units:'meters',rigged:true,
    groundLevel:0,animationModes:{Hover:'repeat',Boost:'once',BladeSlash:'once'}};
  const bones=Object.create(null);
  const bone=(name,parent,position)=>{
    const b=new T.Bone();b.name=name;b.position.set(...position);(parent?bones[parent]:root).add(b);bones[name]=b;return b;
  };
  bone('Motion',null,[0,RAVEN_MOTION.hoverHeight,0]);bone('Hips','Motion',[0,1.78,0]);
  bone('Spine','Hips',[0,.42,0]);bone('Neck','Spine',[0,.65,0]);bone('Head','Neck',[0,.17,0]);
  for(const [label,s] of [['Left',-1],['Right',1]]) {
    bone(label+'Shoulder','Spine',[s*.54,.43,0]);bone(label+'UpperArm',label+'Shoulder',[s*.12,-.08,0]);
    bone(label+'Forearm',label+'UpperArm',[0,-.50,0]);bone(label+'Hand',label+'Forearm',[0,-.51,0]);
    bone(label+'Thigh','Hips',[s*.21,-.06,0]);bone(label+'Shin',label+'Thigh',[0,-.78,0]);
    bone(label+'Foot',label+'Shin',[0,-.69,0]);
    bone(label+'Booster','Spine',[s*.3,.24,-.39]);bone(label+'BackJet',label+'Booster',[0,-.40,-.03]);
    bone(label+'FootJet',label+'Foot',[0,-.18,-.035]);
  }
  bone('BladeTip','RightForearm',[.15,-1.62,.12]);

  const mat=(name,color,metalness=.3,emissive=null)=>{
    const m=new T.MeshStandardMaterial({color,metalness,roughness:.43,flatShading:true});m.name=name;
    if(emissive){m.emissive.set(emissive);m.emissiveIntensity=2;}return m;
  };
  const armor=mat('Ceramic silver','#c2d1d8'),dark=mat('Graphite frame','#152331',.6),navy=mat('Blue titanium','#40566b',.65);
  const edge=mat('Blade polished edge','#e4f5f5',.8),orange=mat('Safety vermilion','#e75a31');
  const light=mat('Ion cyan','#46d8ef',.2,'#1bcde5'),core=mat('Reactor ember','#ffb268',.1,'#f86220');
  const jetMat=new T.MeshBasicMaterial({color:'#119ad9'});jetMat.name='Blue exhaust';
  const jetCore=new T.MeshBasicMaterial({color:'#c7fbff'});jetCore.name='White hot exhaust';
  const add=(parent,name,geometry,material,at=[0,0,0])=>{
    const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(...at);bones[parent].add(mesh);return mesh;
  };
  const box=(parent,name,at,size,material)=>add(parent,name,new T.BoxGeometry(...size),material,at);
  const hull=(parent,name,points,material)=>add(parent,name,new ConvexGeometry(points.map(p=>new T.Vector3(...p))),material);
  const plate=(parent,name,points,depth,z,material)=>{
    const shape=new T.Shape(points.map(p=>new T.Vector2(...p)));
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.009,bevelThickness:.008});
    g.translate(0,0,z-depth/2);return add(parent,name,g,material);
  };
  const joint=(parent,name,at,radius,axis='x')=>{
    const mesh=add(parent,name,new T.CylinderGeometry(radius,radius,.14,12),dark,at);
    if(axis==='x')mesh.rotation.z=Math.PI/2;
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    return mesh;
  };
  const fin=(parent,name,points,material)=>plate(parent,name,points,.045,-.09,material);

  box('Hips','Pelvis actuator',[0,0,0],[.39,.24,.32],dark);
  plate('Hips','Pelvis prow',[[-.24,.12],[.24,.12],[.15,-.20],[0,-.28],[-.15,-.2]],.16,.19,armor);
  box('Spine','Torso core',[0,.20,-.01],[.49,.55,.38],dark);
  plate('Spine','Thorax shield',[[-.43,.43],[-.25,.59],[.25,.59],[.43,.43],[.28,.03],[0,-.11],[-.28,.03]],.28,.18,navy);
  for(const s of [-1,1]) {
    plate('Spine',`${s}Chest laminate`,[[s*.025,.47],[s*.37,.49],[s*.45,.34],[s*.25,.14],[s*.055,.22]],.10,.35,armor);
    plate('Spine',`${s}Collar facet`,[[s*.045,.51],[s*.20,.65],[s*.4,.51],[s*.24,.44]],.16,.04,armor);
    for(let i=0;i<3;i++)box('Spine',`${s}Chest vent ${i}`,[s*(.19+i*.055),.30,.414],[.025,.075,.012],dark).rotation.z=s*-.32;
    fin('Hips',`${s}Hip skirt`,[[s*.19,.10],[s*.39,.06],[s*.5,-.29],[s*.26,-.23]],armor);
  }
  plate('Spine','Reactor aperture',[[-.084,.27],[.084,.27],[0,.12]],.014,.433,core);
  for(let i=0;i<3;i++)plate('Hips',`Abdominal segment ${i}`,[[-.19,.18+i*.07],[.19,.18+i*.07],[.16,.23+i*.07],[-.16,.23+i*.07]],.14,.16,navy);
  joint('Neck','Neck gimbal',[0,0,0],.10,'y');
  hull('Head','Angular helmet',[
    [-.17,-.13,-.16],[.17,-.13,-.16],[-.23,.13,-.15],[.23,.13,-.15],[-.13,.30,-.05],[.13,.30,-.05],
    [-.18,-.1,.12],[.18,-.1,.12],[-.18,.14,.17],[.18,.14,.17],[0,.24,.21],[0,-.17,.17]],armor);
  plate('Head','Black visor',[[-.177,.105],[0,.068],[.177,.105],[.137,-.01],[0,-.052],[-.137,-.01]],.025,.192,dark);
  plate('Head','Optic slit',[[-.145,.059],[0,.031],[.145,.059],[.10,.024],[0,.001],[-.10,.024]],.008,.212,light);
  plate('Head','Chin blade',[[-.055,-.02],[.055,-.02],[.039,-.135],[0,-.18],[-.039,-.135]],.055,.22,navy);
  for(const s of [-1,1]) {
    fin('Head',`${s}Antenna`,[[s*.14,.18],[s*.33,.46],[s*.22,.10]],navy);
    box('Head',`${s}Temple sensor`,[s*.214,.06,-.04],[.047,.10,.12],orange);
  }

  for(const [label,s] of [['Left',-1],['Right',1]]) {
    joint(label+'Shoulder',label+'Shoulder bearing',[0,0,0],.16);
    plate(label+'Shoulder',label+'Pauldron',[[s*-.14,.12],[s*.17,.24],[s*.44,.08],[s*.31,-.26],[s*-.13,-.17]],.40,0,armor);
    fin(label+'Shoulder',label+'Shoulder spike',[[s*.10,.17],[s*.49,.38],[s*.37,-.05]],navy);
    plate(label+'UpperArm',label+'Upper arm plate',[[-.12,-.04],[.12,-.04],[.105,-.39],[0,-.45],[-.105,-.39]],.24,.015,navy);
    box(label+'UpperArm',label+'Arm stripe',[s*.114,-.20,.085],[.025,.20,.09],orange);
    joint(label+'Forearm',label+'Elbow bearing',[0,.025,0],.115);
    plate(label+'Forearm',label+'Forearm vambrace',[[-.13,-.075],[.13,-.075],[.19,-.28],[.105,-.48],[-.105,-.48],[-.19,-.28]],.29,.025,armor);
    plate(label+'Forearm',label+'Forearm inset',[[-.065,-.14],[.065,-.14],[.045,-.39],[-.045,-.39]],.022,.189,navy);
    box(label+'Forearm',label+'Arm emitter',[0,-.28,.212],[.025,.15,.016],light);
    box(label+'Hand',label+'Fist',[0,-.095,.016],[.16,.19,.17],dark);
    for(let i=0;i<3;i++)box(label+'Hand',`${label}Knuckle ${i}`,[-.05+i*.05,-.13,.113],[.039,.078,.044],navy);
    joint(label+'Thigh',label+'Hip bearing',[0,0,0],.15);
    plate(label+'Thigh',label+'Thigh armor',[[-.13,-.09],[.13,-.09],[.17,-.32],[.12,-.64],[0,-.72],[-.12,-.64],[-.17,-.32]],.29,.03,armor);
    box(label+'Thigh',label+'Thigh rail',[s*.157,-.35,-.02],[.043,.32,.19],navy);
    joint(label+'Shin',label+'Knee bearing',[0,.015,0],.125);
    plate(label+'Shin',label+'Knee prow',[[-.145,.075],[.145,.075],[.17,-.09],[0,-.25],[-.17,-.09]],.12,.20,navy);
    plate(label+'Shin',label+'Knee glow',[[-.064,.03],[.064,.03],[0,-.07]],.01,.278,light);
    plate(label+'Shin',label+'Shin armor',[[-.13,-.16],[.13,-.16],[.10,-.57],[.06,-.68],[-.06,-.68],[-.10,-.57]],.28,.015,armor);
    fin(label+'Shin',label+'Calf fin',[[s*.09,-.20],[s*.25,-.34],[s*.20,-.70],[s*.08,-.60]],navy);
    joint(label+'Foot',label+'Ankle bearing',[0,0,0],.085);
    hull(label+'Foot',label+'Split toe',[
      [-.105,-.14,-.13],[.105,-.14,-.13],[-.11,-.14,.32],[.11,-.14,.32],
      [-.085,.045,-.08],[.085,.045,-.08],[-.085,-.055,.28],[.085,-.055,.28]],navy);
    box(label+'Foot',label+'Toe accent',[0,-.075,.25],[.055,.025,.12],orange);

    plate(label+'Booster',label+'Engine housing',[[-.14,.31],[.14,.31],[.17,-.24],[.11,-.40],[-.11,-.40],[-.17,-.24]],.31,-.02,navy);
    plate(label+'Booster',label+'Engine fairing',[[-.1,.34],[.1,.34],[.10,-.10],[0,-.20],[-.10,-.10]],.06,-.20,armor);
    fin(label+'Booster',label+'Swept stabilizer',[[s*.07,.22],[s*.49,.60],[s*.35,-.28],[s*.10,-.4]],navy);
    fin(label+'Booster',label+'Fin leading edge',[[s*.42,.48],[s*.49,.6],[s*.38,-.07],[s*.34,-.13]],orange);
    add(label+'Booster',label+'Nozzle',new T.CylinderGeometry(.10,.15,.13,8,1,true),dark,[0,-.37,-.03]);
    add(label+'Booster',label+'Ion ring',new T.TorusGeometry(.116,.016,6,12),light,[0,-.435,-.03]).rotation.x=Math.PI/2;
    add(label+'Foot',label+'Sole nozzle',new T.CylinderGeometry(.066,.075,.04,8),dark,[0,-.155,-.035]);
    for(const [jet,length,radius] of [[label+'BackJet',.59,.113],[label+'FootJet',.30,.060]]) {
      for(const [suffix,factor,m] of [['Plume',1,jetMat],['HotCore',.72,jetCore]]) {
        const flame=add(jet,jet+suffix,new T.ConeGeometry(radius*factor,length*factor,6),m,[0,-length*factor/2,0]);
        flame.rotation.z=Math.PI;flame.userData.effect=true;
      }
    }
  }
  box('RightForearm','Blade rail',[.16,-.31,.04],[.11,.49,.20],dark);
  plate('RightForearm','Blade spine',[[.13,-.23],[.24,-.31],[.245,-1.34],[.15,-1.62],[.095,-.54]],.067,.12,navy);
  plate('RightForearm','Blade cutting facet',[[.245,-.35],[.285,-.49],[.15,-1.62],[.202,-1.17]],.025,.16,edge);
  plate('RightForearm','Blade energy edge',[[.282,-.49],[.292,-.50],[.15,-1.62],[.165,-1.49]],.008,.176,light);
  box('RightForearm','Blade guard',[.16,-.42,.12],[.27,.055,.18],orange);
  plate('LeftForearm','Buckler',[[-.17,-.04],[.17,-.04],[.24,-.3],[0,-.62],[-.24,-.3]],.08,.23,navy);

  // Bake each rigid armor part into bind-space and assign its nearest ancestor
  // bone. The exported GLB contains actual skin attributes, not just node motion.
  root.updateMatrixWorld(true);
  const ordered=Object.values(bones),skeleton=new T.Skeleton(ordered),parts=[];
  root.traverse(o=>{if(o.isMesh)parts.push(o);});
  for(const part of parts) {
    let owner=part.parent;while(!owner.isBone)owner=owner.parent;
    const index=ordered.indexOf(owner),g=part.geometry.clone().applyMatrix4(part.matrixWorld);
    const count=g.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const skin=new T.SkinnedMesh(g,part.material);skin.name=part.name;skin.userData={...part.userData,joint:owner.name};
    root.add(skin);skin.bind(skeleton);skin.frustumCulled=false;
    part.removeFromParent();part.geometry.dispose();
  }
  return {root,bones,clips:ravenClips()};
}
