import * as T from 'three';
import { group, ellipsoid, line, segment, loft, lock, patch, ovalPoints } from './geometry.mjs';

/** @typedef {{hair:string,hairLight:string,dress:string,ink:string,skin:string}} Palette */
/** Stable authoring contract; all construction is reproducible without Blender or a DOM. */
export const SUZU=Object.freeze({name:'Suzu',height:1.66,eyeStyle:'surface-fitted-almond',torsoDepthScale:1.45,
  palette:Object.freeze({hair:'#20283f',hairLight:'#35445e',dress:'#9b88bc',ink:'#292339',skin:'#ffe2ce'})});

// Chin to crown. A broad, shallow facial plane keeps eyes integrated into the head.
const FACE=[[1.205,.024,.049,.019],[1.225,.068,.083,.002],[1.26,.119,.122,-.021],
  [1.31,.155,.16,-.045],[1.38,.176,.185,-.059],[1.45,.182,.192,-.065],
  [1.52,.168,.178,-.063],[1.585,.118,.125,-.042],[1.621,.025,.03,-.011]];
const BODICE=[[.918,.108,.068],[.97,.112,.071],[1.055,.135,.081],[1.13,.155,.075],[1.18,.15,.063],[1.204,.062,.045]];
function bodiceZ(x,y) {
  let i=BODICE.findIndex(r=>r[0]>=y);i=Math.max(1,i<0?BODICE.length-1:i);
  const a=BODICE[i-1],b=BODICE[i],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  const rx=T.MathUtils.lerp(a[1],b[1],t),rz=T.MathUtils.lerp(a[2],b[2],t);
  return rz*Math.sqrt(Math.max(0,1-(x/rx)**2));
}
export function faceZ(x,y) {
  let i=FACE.findIndex(r=>r[0]>=y);i=Math.max(1,i<0?FACE.length-1:i);
  const a=FACE[i-1],b=FACE[i],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  const rx=T.MathUtils.lerp(a[1],b[1],t),rz=T.MathUtils.lerp(a[2],b[2],t),cz=T.MathUtils.lerp(a[3],b[3],t);
  return cz+rz*Math.max(0,1-(x/rx)**2)**.325;
}

export function createSuzu() {
  const root=group(null,'Suzu');
  root.userData={title:'Suzu — violet afternoon',generator:'Three.js',units:'meters',rigged:false,version:2};
  const p=SUZU.palette;
  const material=(name,color,unlit=false)=>{const m=unlit?new T.MeshBasicMaterial({color,side:T.DoubleSide}):new T.MeshStandardMaterial({color,roughness:.82,metalness:0,side:T.DoubleSide});m.name=name;return m;};
  const skin=material('Peach skin',p.skin),hair=material('Midnight ink hair',p.hair),hairLight=material('Slate hair ribbons',p.hairLight);
  const dress=material('Wisteria cloth',p.dress),dressShade=material('Violet seams','#756391');
  const cream=material('Warm ivory','#fff4dc'),shoe=material('Plum leather','#44394f'),sole=material('Dark soles','#292634');
  const ink=material('Drawn eyelid',p.ink,true),white=material('Eye ivory','#fff9f0',true),gold=material('Brass details','#d8b66b');
  const ribbon=material('Mulberry ribbon','#775278'),blush=material('Painted blush','#f6b9b5',true);
  const head=group(root,'Head');
  loft(head,'Face',FACE,skin,{frontPower:.65});
  segment(head,'Neck',[0,1.15,-.018],[0,1.255,-.018],.052,.047,skin);
  for(const side of [-1,1]) {
    ellipsoid(head,`${side<0?'Left':'Right'}Ear`,[side*.174,1.346,-.003],[.022,.039,.021],skin);
    ellipsoid(head,`${side}EarFold`,[side*.183,1.346,.01],[.008,.023,.006],material(`${side}Ear tint`,'#eab6a7'));
    makeEye(head,side,{ink,white,material});
    patch(head,`${side}Blush`,ovalPoints(side*.125,1.333,.025,.009),blush,(x,y)=>faceZ(x,y)+.0015,{subdivisions:2});
    // Delicate eyebrows sit above the eye; no raised brow ridge.
    const brow=Array.from({length:25},(_,i)=>{const t=i/24;return [side*(.034+.105*t),1.461+.008*Math.sin(t*Math.PI)-.005*t];});
    patch(head,`${side}Brow`,[...brow,...brow.map(([x,y])=>[x,y+.003]).reverse()],ink,(x,y)=>faceZ(x,y)+.002,{subdivisions:2});
  }
  patch(head,'Small nose',[[-.013,1.337],[0,1.363],[.013,1.337],[0,1.328]],skin,
    (x,y)=>faceZ(x,y)+.0003+.014*Math.exp(-((x/.007)**2+((y-1.34)/.01)**2)),{subdivisions:3});
  line(head,'Mouth',[[-.021,1.291,faceZ(-.021,1.291)+.002],[0,1.288,faceZ(0,1.288)+.002],[.017,1.291,faceZ(.017,1.291)+.002]],.0015,material('Lip line','#af6c78',true));
  makeHair(root,{hair,hairLight,gold,ribbon,cream});

  const outfit=group(root,'Dress');
  // Keep the frontal outline while giving the ribcage and draped skirt real depth.
  outfit.scale.z=SUZU.torsoDepthScale;
  loft(outfit,'Fitted bodice',BODICE,dress);
  loft(outfit,'Pleated skirt',[[.605,.268,.173],[.62,.273,.177],[.70,.244,.158],[.81,.181,.12],[.925,.113,.071]],dress,{pleats:16,amplitude:.035});
  loft(outfit,'Ivory hem',[[.601,.269,.174],[.622,.276,.179]],cream,{pleats:16,amplitude:.035});
  loft(outfit,'Hem piping',[[.636,.269,.174],[.642,.267,.173]],dressShade,{pleats:16,amplitude:.035});
  loft(outfit,'Waist ribbon',[[.92,.115,.074],[.947,.113,.074]],ribbon);
  for(const side of [-1,1]) {
    patch(outfit,`${side}Collar`,[[side*.008,1.172],[side*.04,1.219],[side*.131,1.166],[side*.081,1.105]],cream,(x,y)=>bodiceZ(x,y)+.008,{subdivisions:3});
    patch(outfit,`${side}BowLoop`,[[0,1.132],[side*.058,1.156],[side*.066,1.119],[side*.019,1.11]],ribbon,(x,y)=>bodiceZ(x,y)+.016,{subdivisions:2});
    patch(outfit,`${side}BowTail`,[[side*.009,1.121],[side*.019,1.06],[side*.035,1.071],[side*.021,1.126]],ribbon,(x,y)=>bodiceZ(x,y)+.012,{subdivisions:2});
  }
  ellipsoid(outfit,'Brooch',[0,1.127,bodiceZ(0,1.127)+.02],[.012,.015,.008],gold);
  for(const y of [1.045,1.0,.966])ellipsoid(outfit,`Pearl button ${y}`,[0,y,bodiceZ(0,y)+.003],[.004,.004,.003],cream);
  // Fine, evenly spaced skirt seams follow the drape rather than straight cylinders.
  for(let i=0;i<16;i++) {
    const a=i/16*Math.PI*2;
    line(outfit,`Pleat ${i}`,[[.126*Math.cos(a),.912,.081*Math.sin(a)],[.19*Math.cos(a),.81,.127*Math.sin(a)],[.265*Math.cos(a),.68,.172*Math.sin(a)]],.001,dressShade);
  }
  for(const side of [-1,1]) {
    const label=side<0?'Left':'Right',arm=group(root,label+'Arm'),leg=group(root,label+'Leg');
    ellipsoid(arm,label+'PuffSleeve',[side*.18,1.122,0],[.075,.087,.077],dress);
    segment(arm,label+'SleeveCuff',[side*.214,1.064,.002],[side*.226,1.043,.005],.044,.039,cream);
    segment(arm,label+'UpperArm',[side*.218,1.06,.002],[side*.256,.94,.016],.032,.027,skin);
    ellipsoid(arm,label+'Elbow',[side*.256,.94,.016],[.028,.029,.028],skin);
    segment(arm,label+'Forearm',[side*.256,.94,.016],[side*.281,.819,.039],.028,.019,skin);
    ellipsoid(arm,label+'Palm',[side*.285,.796,.042],[.023,.033,.014],skin);
    for(let finger=0;finger<4;finger++) {
      const x=side*(.269+finger*.010),length=[.03,.038,.035,.026][finger];
      line(arm,`${label}Finger${finger}`,[[x,.782,.047],[x+side*.002,.764,.05],[x+side*.003,.782-length,.055]],.005,skin);
    }
    line(arm,label+'Thumb',[[side*.266,.809,.05],[side*.257,.791,.063],[side*.26,.78,.068]],.007,skin);
    segment(leg,label+'LegSkin',[side*.094,.66,0],[side*.093,.36,.005],.051,.038,skin);
    segment(leg,label+'Sock',[side*.093,.382,.005],[side*.095,.087,.004],.039,.027,cream);
    loft(leg,label+'SockTop',[[.374,.041,.041],[.397,.042,.042]],cream).position.x=side*.093;
    for(const y of [.377,.387]) {const cuff=loft(leg,`${label}Sock rib ${y}`,[[y,.042,.042],[y+.002,.042,.042]],dressShade);cuff.position.x=side*.093;}
    ellipsoid(leg,label+'Sole',[side*.095,.024,.04],[.05,.024,.098],sole);
    ellipsoid(leg,label+'MaryJane',[side*.095,.052,.042],[.048,.034,.093],shoe);
    segment(leg,label+'Strap',[side*.095-.042,.076,.027],[side*.095+.042,.076,.027],.009,.009,ribbon);
    ellipsoid(leg,label+'Buckle',[side*.095+side*.038,.082,.031],[.009,.009,.006],gold);
  }
  root.updateMatrixWorld(true);return root;
}

function makeEye(head,side,{ink,white,material}) {
  const label=side<0?'Left':'Right',eye=group(head,label+'Eye');
  eye.userData.style='surface-fitted-almond';
  const cx=side*.084,cy=1.398,rx=.063;
  const limits=x=>{const u=(x-cx)/rx,bulge=Math.max(0,1-u*u);return [cy-.025*bulge**.7+side*u*.005,cy+.037*bulge**.6+side*u*.005];};
  const top=[],bottom=[];
  for(let i=0;i<=40;i++){const x=cx-rx+2*rx*i/40,[lo,hi]=limits(x);top.push([x,hi]);bottom.push([x,lo]);}
  patch(eye,label+'Sclera',[...bottom,...top.reverse()],white,(x,y)=>faceZ(x,y)+.002,{subdivisions:3});
  const irisPoints=ovalPoints(cx,cy+.003,.028,.041).map(([x,y])=>{const [lo,hi]=limits(x);return [x,T.MathUtils.clamp(y,lo+.0006,hi-.0006)];});
  const irisMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});irisMaterial.name=label+'Violet iris gradient';
  const iris=patch(eye,label+'Iris',irisPoints,irisMaterial,(x,y)=>faceZ(x,y)+.003,{subdivisions:3});
  const colors=[],pos=iris.geometry.attributes.position,dark=new T.Color('#302849'),light=new T.Color('#ab8bda');
  for(let i=0;i<pos.count;i++){const t=T.MathUtils.clamp((cy+.029-pos.getY(i))/.058,0,1),c=dark.clone().lerp(light,t);colors.push(c.r,c.g,c.b);}
  iris.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const pupil=ovalPoints(cx,cy+.008,.011,.025).map(([x,y])=>[x,Math.min(y,limits(x)[1]-.001)]);
  patch(eye,label+'Pupil',pupil,ink,(x,y)=>faceZ(x,y)+.004,{subdivisions:2});
  for(const [dx,dy,r] of [[-.011,.02,.006],[.011,-.011,.0025]])
    patch(eye,`${label}Catchlight${dx}`,ovalPoints(cx+dx,cy+dy,r,r*1.25),white,(x,y)=>faceZ(x,y)+.005,{subdivisions:1});
  // Graphic upper-lid silhouette, with tapered outer corner; no spherical eyeball.
  const upper=top.slice().reverse();
  const band=upper.map(([x,y],i)=>[x,y+.001+.004*Math.sin(i/40*Math.PI)]);
  patch(eye,label+'UpperLash',[...upper,...band.reverse()],ink,(x,y)=>faceZ(x,y)+.006);
  const outer=cx+side*rx;
  patch(eye,label+'LashWing',[[outer-side*.021,cy+.024],[outer+side*.012,cy+.013],[outer-side*.001,cy+.002]],ink,(x,y)=>faceZ(x,y)+.0055);
  const lower=bottom.slice(7,34);
  line(eye,label+'LowerLid',lower.map(([x,y])=>[x,y,faceZ(x,y)+.0035]),.0008,material(label+'Lower ink','#886376',true));
}

function makeHair(root,{hair,hairLight,gold,ribbon,cream}) {
  const parent=group(root,'Hair');
  // The scalp follows the asymmetric skull, rather than intersecting a spherical
  // cap with it. Only the face opening is removed; the back is a continuous shell.
  const capRings=[[1.23,.172,.17,-.055],[1.31,.202,.201,-.047],[1.38,.202,.213,-.059],
    [1.45,.207,.219,-.065],[1.52,.193,.205,-.063],[1.585,.145,.153,-.042],
    [1.63,.085,.082,-.025],[1.657,.009,.01,-.012]];
  const cap=loft(parent,'Bob silhouette',capRings,hair,{segments:80,frontPower:.65}).geometry;
  const positions=cap.attributes.position,kept=[];
  for(let i=0;i<cap.index.count;i+=3) {
    const ids=[cap.index.getX(i),cap.index.getX(i+1),cap.index.getX(i+2)];
    const y=ids.reduce((sum,id)=>sum+positions.getY(id),0)/3;
    const z=ids.reduce((sum,id)=>sum+positions.getZ(id),0)/3;
    if(y<1.52 && z>.039)continue;
    kept.push(...ids);
  }
  cap.setIndex(kept);cap.computeVertexNormals();
  parent.getObjectByName('Bob silhouette').geometry=cap.toNonIndexed();
  cap.dispose();
  // Overlapping swept fringe locks: deliberate flat shapes with pointed tips.
  const bangs=[
    {p:[[-.095,1.629,.058],[-.119,1.567,.123],[-.146,1.486,.119],[-.151,1.454,.112]],w:[.024,.042,.027,.001]},
    {p:[[-.056,1.65,.044],[-.052,1.591,.132],[-.079,1.519,.145],[-.115,1.478,.132]],w:[.021,.049,.038,.001]},
    {p:[[-.015,1.652,.036],[.018,1.59,.139],[-.006,1.513,.157],[-.043,1.476,.148]],w:[.022,.052,.039,.001]},
    {p:[[.023,1.644,.034],[.079,1.585,.125],[.093,1.522,.145],[.076,1.493,.149]],w:[.022,.047,.035,.001]},
    {p:[[.072,1.628,.039],[.138,1.568,.102],[.151,1.49,.108],[.149,1.445,.102]],w:[.017,.041,.027,.001]},
  ];
  bangs.forEach((b,i)=>lock(parent,`Fringe ${i}`,b.p,b.w,.017,i===1||i===3?hairLight:hair));
  for(const side of [-1,1]) {
    for(let i=0;i<4;i++) {
      const angle=.96+i*.46,x=side*.211*Math.sin(angle),z=(Math.cos(angle)>=0?.163:.276)*Math.cos(angle)-.006;
      lock(parent,`${side}Bob lock ${i}`,[[x*.7,1.596,z*.65],[x,1.46,z],[x,1.319,z*.91],[x*.83,1.226+i*.009,z*.82]],
        [.018,.038,.035,.001],.026,i===0?hairLight:hair);
    }
    line(parent,`${side}Hair sheen`,[[side*.159,1.53,.098],[side*.18,1.46,.10],[side*.185,1.39,.097]],.002, hairLight);
  }
  // Two ivory clips and a tiny star distinguish this silhouette from Milo.
  for(const y of [1.49,1.515])line(parent,`Ivory hairpin ${y}`,[[.128,y,.148],[.163,y-.014,.143]],.0028,cream);
  const star=[];
  for(let i=0;i<10;i++){const t=Math.PI/2+i*Math.PI/5,r=i%2?.009:.019;star.push([.177+r*Math.cos(t),1.459+r*Math.sin(t)]);}
  patch(parent,'Star hairpin',star,gold,()=>.097);
  // Small back bow: visible when orbiting, not just a front-facing cutout character.
  for(const side of [-1,1])ellipsoid(parent,`${side}Back ribbon`,[side*.063,1.30,-.227],[.059,.033,.013],ribbon);
  ellipsoid(parent,'Back ribbon knot',[0,1.30,-.244],[.016,.018,.01],ribbon);
}
