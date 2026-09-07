import { Bone, Skeleton, SkinnedMesh, MeshStandardMaterial, Vector3 } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { LUMI_FRINGE, lumiForeheadZ } from './lumi-hair-definition.mjs';

const ORIGIN=1.76,local=p=>[p[0],p[1]-ORIGIN,p[2]];
const GOLD='#c9a653',LIGHT='#e6c776',DARK='#ae8740';

/** Independent Head-local hair: fitted scalp plus overlapping volumetric locks.
 * Bones are deformation controls, not a running physics simulation. */
export function createLumiHair(data,sourceGeometry) {
  const anchor=new Bone();anchor.name='LumiHairAnchor';const bones=[anchor],chains=[];
  for(const [i,degrees] of [85,115,145,180,215,245,275].entries()) {
    const t=degrees*Math.PI/180,x=Math.sin(t),z=Math.cos(t);
    const points=[[x*.295,2.075,z*.315],[x*.244,1.925,z*.275],[x*.19,1.765+Math.abs(x)*.025,z*.225]];
    chains.push({name:`LumiBack${i}`,theta:t,width:.102,depth:.030,points,
      rows:[[x*.045,2.31,z*.065],[x*.215,2.245,z*.23],...points]});
  }
  for(const side of [1,-1]) {
    const points=[[side*.265,2.08,.142],[side*.233,1.94,.13],[side*.195,1.82,.11]];
    chains.push({name:side===1?'LumiSideLeft':'LumiSideRight',theta:side*Math.PI/2,width:.075,depth:.035,points,
      rows:[[side*.060,2.31,.028],[side*.22,2.245,.123],...points]});
  }
  chains.push({name:'LumiAhoge',theta:0,width:.018,depth:.010,points:[[.015,2.31,-.025],[.035,2.445,-.008],[.135,2.485,.022]]});
  for(const c of chains) {
    let parent=anchor,origin=[0,0,0];
    c.points.map(local).forEach((p,i)=>{
      const bone=new Bone();bone.name=c.name+['Root','Mid','Tip'][i];
      bone.position.set(...p.map((v,k)=>v-origin[k]));parent.add(bone);parent=bone;origin=p;bones.push(bone);
    });
  }
  const builder=compactMesh(bones.map(b=>b.name));
  // Preserve the skull's curvature but build a larger hair envelope in all axes.
  // Locks run from the crown over this underlayer, hiding a horizontal cap rim.
  const cap=data.faces.filter((f,i)=>{
    if(!data.regions[i].startsWith('Head')||!f.every(v=>data.positions[v][1]>=1.985))return false;
    const front=f.reduce((sum,v)=>sum+data.positions[v][2],0)/f.length>.10;
    // The cap ends behind the fringe roots, never across the visible forehead.
    return !front||f.every(v=>data.positions[v][1]>=2.045);
  });
  const capPoints=data.positions.map((p,i)=>{
    const q=new Vector3(...p).addScaledVector(new Vector3().fromBufferAttribute(sourceGeometry.attributes.normal,i),.018);
    // At the forehead the underlayer returns to the skin. Raising its open
    // lower rim made a visible floating visor when viewed from below.
    const blend=q.z>.10?Math.max(0,Math.min(1,(p[1]-1.985)/.19)):1;
    const envelope=[q.x*1.22,1.99+(q.y-1.99)*1.25+.025,q.z*1.12-.01];
    const point=envelope.map((v,k)=>q.getComponent(k)+(v-q.getComponent(k))*blend);
    const forehead=lumiForeheadZ(point[0],point[1]);
    if(p[2]>.08&&point[1]>2.11&&forehead!==undefined)point[2]=Math.max(point[2],forehead-.014);
    return local(point);
  });
  for(const f of cap)builder.surface(capPoints,[[f[0],f[1],f[2]],[f[0],f[2],f[3]]],GOLD,'LumiHairAnchor');

  // Sparse skull quads cannot support the round fringe between its guide rows.
  // A small matching underlayer closes those root gaps without covering the
  // forehead windows or changing the side/back silhouette.
  const frontSupport=[];
  for(const y of [2.105,2.15,2.20,2.25,2.28,2.30,2.31]) {
    const halfWidth=.315*Math.sqrt(Math.max(0,1-((y-2.04)/.275)**2))*.98;
    for(const u of [-1,-.5,0,.5,1]) {
      const x=u*halfWidth;
      frontSupport.push(local([x,y,lumiForeheadZ(x,y)-.006]));
    }
  }
  for(let row=0;row<6;row++)for(let col=0;col<4;col++) {
    const a=row*5+col,b=a+1,c=a+5,d=c+1;
    builder.surface(frontSupport,[[a,b,c],[b,d,c]],GOLD,'LumiHairAnchor');
  }

  function lock(rows,theta,width,depth,name,fitCrown=false,lift=.022) {
    const points=[],links=new Map(),tangent=[Math.cos(theta),0,-Math.sin(theta)],out=[Math.sin(theta),0,Math.cos(theta)];
    rows.forEach((p,row)=>{
      const taper=p[3]??(row===rows.length-1?.035:row===0?.28:1);
      const thickness=depth*(row===rows.length-1?.10:1);
      for(const [u,v] of [[-1,0],[-.75,-.6],[.75,-.6],[1,0],[0,1]]) {
        const q=local(p).map((n,k)=>n+tangent[k]*u*width*taper+out[k]*v*thickness);
        if(fitCrown&&p[1]>2.08) {
          const surface=lumiForeheadZ(q[0],p[1]);
          if(Number.isFinite(surface))q[2]=surface+lift+v*thickness;
        }
        const joint=!name||row<rows.length-2?'LumiHairAnchor':name+(row===rows.length-1?'Tip':'Mid');
        links.set(q.join(','),[[joint,1]]);points.push(q);
      }
    });
    const weights=p=>links.get(p.join(','));
    for(let r=1;r<rows.length;r++)for(let i=0;i<5;i++) {
      const a=(r-1)*5+i,b=(r-1)*5+(i+1)%5,c=r*5+i,d=r*5+(i+1)%5;
      builder.surface(points,[[a,b,c],[b,d,c]],i===3?LIGHT:i===1?DARK:GOLD,weights);
    }
    for(const start of [0,(rows.length-1)*5])for(let i=1;i<4;i++)builder.surface(points,[start===0?[start,start+i+1,start+i]:[start,start+i,start+i+1]],GOLD,weights);
  }
  for(const c of chains)lock(c.rows??c.points,c.theta,c.width,c.depth,c.name);
  // Face framing stops above the jaw: silhouette must work without long hair.
  for(const side of [-1,1])lock([
    [side*.20,2.23,.18],
    [side*.255,2.10,.18],
    [side*.232,1.98,.18],
    [side*.206,1.87,.175],
    [side*.180,1.86,.16,.70],
    [side*.155,1.81,.14],
  ],0,.045,.045);
  // Two shingled layers around the occiput. Each short solid blade sweeps
  // around the head rather than hanging straight down like a curtain.
  for(const c of chains.filter(c=>c.name.startsWith('LumiBack')))for(const tier of [0,1]) {
    const t=c.theta;
    const polar=(angle,radius,y)=>[Math.sin(angle)*radius,y,Math.cos(angle)*radius];
    lock([
      [...polar(t-.10,tier===0?.283:.309,2.16-tier*.14),.65],
      [...polar(t+.015,tier===0?.337:.291,2.055-tier*.14),1],
      polar(t+.15,tier===0?.316:.267,1.985-tier*.14),
    ],t,.065,.017,c.name);
  }
  // Ear-side blades travel diagonally backwards in profile, at two heights.
  for(const side of [-1,1])for(const tier of [0,1])lock([
    [side*.261,2.12-tier*.11,.12,.60],
    [side*(tier===0?.307:.273),2.025-tier*.11,.035,1],
    [side*(tier===0?.29:.243),1.965-tier*.11,-.060],
  ],side*Math.PI/2,.047,.015,side===1?'LumiSideLeft':'LumiSideRight');
  for(const {rows,width,depth=.022,lift=.022} of LUMI_FRINGE)lock(rows,0,width,depth,undefined,true,lift);
  const geometry=builder.finish();geometry.computeVertexNormals();
  const mesh=new SkinnedMesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:.9}));
  mesh.name='Hair';mesh.frustumCulled=false;
  mesh.userData={capClearance:.018,hairDynamics:{version:1,space:'Head-local',solver:false,
    chains:chains.map(c=>({joints:['Root','Mid','Tip'].map(s=>c.name+s),pinned:1}))}};
  mesh.add(anchor);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));return mesh;
}
