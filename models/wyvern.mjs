import { Group, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, Vector3 } from 'three';
import { WYVERN } from './wyvern-definition.mjs';
import { sweep, triangles, part, plate } from './wyvern-geometry.mjs';
export { WYVERN } from './wyvern-definition.mjs';

export function createWyvern() {
  const root=new Group();root.name=WYVERN.name;
  root.userData={modelId:'wyvern',title:'CINDERWING · Ash-cliff wyvern',generator:'Three.js',units:'meters',limbs:4,rigged:false,groundLevel:0,version:1};
  const p=WYVERN.palette;
  const hide=new MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0,flatShading:true});hide.name='Faceted scales';
  const membrane=new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:DoubleSide,flatShading:true});membrane.name='Ochre flight membrane';
  const glow=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});glow.name='Amber eyes';
  const materials={hide,membrane,glow};
  const body=part(root,'Body',materials);
  body.add(sweep(WYVERN.body,10),p.skin,'hide',([x,y,z])=>z>.14&&Math.abs(x)<.39?p.belly:p.skin);
  // Overlapping angular scutes run over the keel; belly is narrow, chest has real depth.
  for(let i=0;i<6;i++) {
    const y=2.15+i*.235,w=.25+Math.sin(i/5*Math.PI)*.11,z=.12+i*.065;
    body.add(plate([[-w,y+.15,z],[0,y+.22,z+.08],[w,y+.15,z],[0,y-.07,z+.03]],.035),i%2?p.belly:'#a49473','membrane');
  }
  body.finish();
  const neck=part(root,'Neck',materials);
  neck.add(sweep(WYVERN.neck,8),p.skin,'hide',([x,y,z])=>z>.20&&y<4.5?p.belly:p.skin);
  neck.finish();
  const tail=part(root,'Tail',materials);
  tail.add(sweep(WYVERN.tail,7),p.skin);
  for(let i=1;i<5;i++) {
    const [x,y,z]=WYVERN.tail[i],h=.32-i*.035;
    tail.add(sweep([[x,y+.09,z,.10,.13],[x,y+h,z-.13,.07,.09],[x,y+h+.1,z-.28,.008,.012]],5),p.ridge);
  }
  tail.add(plate([[.65,2.33,-5.08],[.37,2.75,-5.53],[.87,3.27,-5.69],[1.03,2.65,-5.29]],.045),p.membrane,'membrane');
  tail.finish();
  makeHead(root,materials,p);
  for(const side of [1,-1]) {makeWing(root,side,materials,p);makeLeg(root,side,materials,p);}
  const crest=part(root,'DorsalSpines',materials);
  for(const [y,z,h] of [[2.2,-.70,.33],[2.65,-.74,.35],[3.05,-.77,.42],[3.43,-.68,.43],[3.85,-.38,.29],[4.16,-.31,.25]])
    crest.add(sweep([[0,y,z,.13,.13],[0,y+h*.6,z-.18,.10,.06],[0,y+h,z-.39,.008,.01]],5),p.ridge);
  crest.finish();
  root.updateMatrixWorld(true);return root;
}

function makeHead(root,materials,p) {
  const head=part(root,'Head',materials);
  // Broad angular brow tapering to a beak, with a separate dark mouth and lower jaw.
  head.add(sweep([[0,4.73,.40,.26,.29],[0,4.86,.73,.41,.35],[0,4.83,1.06,.32,.24],[0,4.69,1.52,.19,.13],[0,4.62,1.77,.03,.055]],6),p.skin);
  head.add(sweep([[0,4.60,.74,.25,.14],[0,4.53,1.12,.26,.09],[0,4.51,1.51,.15,.045]],6),p.mouth);
  head.add(sweep([[0,4.47,.74,.21,.115],[0,4.39,1.04,.23,.085],[0,4.43,1.48,.12,.04]],6),p.ridge);
  head.add(plate([[-.39,4.94,.63],[0,5.21,.78],[.39,4.94,.63],[0,4.88,1.31]],.12),p.ridge,'membrane');
  for(const s of [1,-1]) {
    head.add(sweep([[s*.27,4.99,.59,.15,.15],[s*.44,5.22,.34,.12,.11],[s*.60,5.45,-.13,.07,.06],[s*.59,5.58,-.56,.008,.012]],6),p.horn);
    head.add(sweep([[s*.32,4.70,.66,.14,.13],[s*.58,4.69,.21,.07,.06],[s*.72,4.82,-.17,.008,.008]],5),p.ridge);
    // Recessed black slit plus amber eye: both lie on the sloping side plane.
    const eye=[[s*.322,4.83,1.04],[s*.393,4.83,.76],[s*.362,4.72,.83],[s*.295,4.75,1.08]];
    head.add(plate(s===1?eye:eye.toReversed(),.01),p.dark,'membrane');
    const iris=[[s*.345,4.80,.96],[s*.378,4.80,.83],[s*.356,4.745,.875],[s*.332,4.76,.98]];
    head.add(plate(s===1?iris:iris.toReversed(),.012),p.eye,'glow');
    for(let i=0;i<4;i++) {
      const z=.98+i*.13,x=s*(.22-i*.025);
      head.add(sweep([[x,4.58,z,.032,.033],[x,4.45+(i%2)*.025,z+.028,.004,.006]],4),p.horn);
    }
    head.add(sweep([[s*.15,4.39,.85,.048,.05],[s*.23,4.15,.70,.02,.025],[s*.20,4.07,.62,.004,.005]],5),p.horn);
  }
  head.finish();
}

function makeWing(root,side,materials,p) {
  const wing=part(root,side===1?'LeftWing':'RightWing',materials),mirror=point=>[point[0]*side,point[1],point[2]];
  const [shoulder,elbow,wrist]=[WYVERN.shoulder,WYVERN.elbow,WYVERN.wrist].map(mirror),fingers=WYVERN.fingers.map(mirror);
  wing.group.userData={...wing.group.userData,shoulder,wrist,fingers,membraneArea:0};
  wing.add(sweep([[...shoulder,.28,.30],[...mirror([1.10,3.66,-.05]),.24,.24],[...elbow,.18,.20],
    [...mirror([2.85,4.33,-.03]),.14,.17],[...wrist,.19,.21]],7),p.skin);
  // Pronounced armor ridge along the leading edge, not a round cartoon arm.
  wing.add(sweep([[...mirror([.69,3.69,.02]),.13,.13],[...mirror([1.38,3.94,-.15]),.14,.10],[...mirror([2.02,3.98,-.37]),.025,.045]],5),p.ridge);
  const hub=new Vector3(...wrist);
  const addSurface=(geometry,...args)=>{geometry.userData.wingSurface=true;wing.add(geometry,...args);};
  for(let f=0;f<fingers.length;f++) {
    const tip=new Vector3(...fingers[f]),mid=hub.clone().lerp(tip,.52);mid.y+=.14;
    addSurface(sweep([[...wrist,.10,.115],[...mid,.062,.08],[...tip,.012,.016]],5),p.ridge);
  }
  // Convex tension panels with concave trailing scallops. Four radial bands preserve camber.
  for(let f=0;f<fingers.length-1;f++) {
    const a=new Vector3(...fingers[f]),b=new Vector3(...fingers[f+1]),vertices=[wrist],indices=[],steps=5,bands=4;
    for(let band=1;band<=bands;band++)for(let i=0;i<=steps;i++) {
      const u=i/steps,r=band/bands,edge=a.clone().lerp(b,u);
      edge.lerp(hub,Math.sin(Math.PI*u)*.19);
      const point=hub.clone().lerp(edge,r);point.y+=Math.sin(Math.PI*r)*Math.sin(Math.PI*u)*.27;
      vertices.push(point.toArray());
    }
    for(let i=0;i<steps;i++)indices.push(0,1+i,2+i);
    for(let band=1;band<bands;band++)for(let i=0;i<steps;i++) {
      const a=1+(band-1)*(steps+1)+i,b=a+steps+1;indices.push(a,b,a+1,a+1,b,b+1);
    }
    let area=0;
    for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(i=>new Vector3(...vertices[i]));area+=b.sub(a).cross(c.sub(a)).length()/2;}
    // Store unsigned area identically for mirrored wings.
    wing.group.userData.membraneArea+=Math.round(area*1e6)/1e6;
    addSurface(triangles(vertices,indices),p.membrane,'membrane',point=>{
      const dist=new Vector3(...point).distanceTo(hub);
      return dist<1.1?p.dark:dist<1.9?'#886d48':f===0?p.membraneLight:p.membrane;
    });
    const edge=[];
    for(let i=0;i<=steps;i++) {
      const u=i/steps,point=a.clone().lerp(b,u).lerp(hub,Math.sin(Math.PI*u)*.19);
      edge.push([...point,.03,.034]);
    }
    addSurface(sweep(edge,4),p.dark);
    // Faint tension veins describe the membrane without a dense texture or extra polygons.
    for(const u of [.33,.67]) {
      const edge=a.clone().lerp(b,u).lerp(hub,Math.sin(Math.PI*u)*.19),middle=hub.clone().lerp(edge,.60);middle.y+=.075;
      addSurface(sweep([[...hub.clone().lerp(edge,.25),.022,.022],[...middle,.014,.014],[...edge,.004,.006]],4),'#8e7048');
    }
  }
  // A short hooked thumb at the carpal joint, distinct from the long flight fingers.
  wing.add(sweep([[...wrist,.13,.14],[...mirror([3.74,5.20,.44]),.105,.10],[...mirror([3.90,5.47,.74]),.058,.065],[...mirror([4.19,5.36,.98]),.006,.01]],6),p.horn);
  wing.finish();
}

function makeLeg(root,side,materials,p) {
  const leg=part(root,side===1?'LeftLeg':'RightLeg',materials),m=point=>[point[0]*side,point[1],point[2]];
  leg.add(sweep([[...m([.29,2.08,-.38]),.30,.34],[...m([.68,1.66,.05]),.36,.39],[...m([.93,1.22,.30]),.27,.29],
    [...m([.99,.82,-.18]),.16,.17],[...m([.98,.36,-.26]),.115,.12],[...m([1.02,.16,.09]),.18,.16]],7),p.skin);
  leg.add(plate([m([.70,1.71,.35]),m([1.00,1.31,.56]),m([1.15,1.19,.28]),m([.90,1.57,.05])],.10),p.ridge,'membrane');
  for(let i=0;i<3;i++) {
    const x=1.02+(i-1)*.18,tipZ=i===1?.90:.71;
    leg.add(sweep([[...m([1.02,.17,.06]),.095,.09],[...m([x,.12,.35]),.07,.075],[...m([x+(i-1)*.1,.075,tipZ-.19]),.04,.045]],5),p.ridge);
    leg.add(sweep([[...m([x+(i-1)*.1,.075,tipZ-.20]),.055,.05],[...m([x+(i-1)*.13,.045,tipZ-.06]),.025,.027],
      [...m([x+(i-1)*.14,.012,tipZ]),.006,.008]],5),p.claw);
  }
  leg.add(sweep([[...m([.99,.22,-.16]),.075,.08],[...m([.82,.10,-.51]),.052,.04],[...m([.69,.025,-.64]),.007,.008]],5),p.claw);
  leg.finish();
}
