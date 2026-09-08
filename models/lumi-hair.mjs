import { Bone, Skeleton, SkinnedMesh, MeshStandardMaterial, Vector3 } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { LUMI_FRINGE, LUMI_TENDRIL, lumiForeheadZ } from './lumi-hair-definition.mjs';
import { createLumiHairTexture } from './lumi-hair-texture.mjs';
import { lumiCapFaces } from './lumi-cap.mjs';

const ORIGIN=1.76,local=p=>[p[0],p[1]-ORIGIN,p[2]];
const GOLD='#ffffff';

/** Independent Head-local hair: fitted scalp plus overlapping volumetric locks.
 * Bones are deformation controls, not a running physics simulation. */
export function createLumiHair(data,sourceGeometry) {
  const anchor=new Bone();anchor.name='LumiHairAnchor';const bones=[anchor],chains=[];
  for(const [i,degrees] of [85,115,145,180,215,245,275].entries()) {
    const t=degrees*Math.PI/180,x=Math.sin(t),z=Math.cos(t);
    const points=[[x*.295,2.075,z*.315],[x*.244,1.925,z*.275],[x*.19,1.765+Math.abs(x)*.025,z*.225]];
    // Preserve the existing bone rest positions. The single skin now carries
    // the outer envelope previously supplied by another overlapping lock.
    const earSide=i===0||i===6;
    chains.push({name:`LumiBack${i}`,theta:t,width:.112,depth:.025,points,
      rows:[[x*.045,2.31,z*.065],[x*.225,2.245,z*.24],
        [x*.335,2.065,z*.337],[x*.267,1.925,z*.291-(earSide?.155:0),earSide?.65:1],points[2]]});
  }
  for(const side of [1,-1]) {
    const points=[[side*.265,2.08,.142],[side*.233,1.94,.13],[side*.195,1.82,.11]];
    chains.push({name:side===1?'LumiSideLeft':'LumiSideRight',theta:side*Math.PI/2,width:.075,depth:.035,points,
      rows:[[side*.060,2.31,.028],[side*.22,2.245,.123],points[0],
        [side*.248,1.94,-.09],[side*.195,1.82,-.10]]});
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
  const cap=lumiCapFaces(data);
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

  function lock(rows,theta,width,depth,name,fitCrown=false,lift=.022,thin=false) {
    // Flatten individual locks without shrinking their coverage or the skull
    // envelope. The ahoge keeps its thin, independently controlled silhouette.
    if(name!=='LumiAhoge')depth*=.55;
    const points=[],uvs=[],links=new Map(),tangent=[Math.cos(theta),0,-Math.sin(theta)],out=[Math.sin(theta),0,Math.cos(theta)];
    const lengths=[0];
    for(let i=1;i<rows.length;i++)lengths.push(lengths[i-1]+new Vector3(...rows[i].slice(0,3)).distanceTo(new Vector3(...rows[i-1].slice(0,3))));
    // Keep the visible ridge and both silhouette edges. One inner ridge closes
    // the underside; the last guide is a single sealed tip, not a tiny ring.
    const section=thin?[[-1,0],[1,0],[0,1]]:[[-1,0],[0,-.6],[1,0],[0,1]],sides=section.length;
    rows.forEach((p,row)=>{
      const taper=p[3]??(row===rows.length-1?.035:row===0?.28:1);
      const thickness=depth*(row===rows.length-1?.10:1);
      for(const [u,v] of row===rows.length-1?[[0,0]]:section) {
        const q=local(p).map((n,k)=>n+tangent[k]*u*width*taper+out[k]*v*thickness);
        if(fitCrown&&p[1]>2.0) {
          const surface=lumiForeheadZ(q[0],p[1]);
          if(Number.isFinite(surface))q[2]=surface+lift+v*thickness;
        }
        const joint=!name||row<rows.length-2?'LumiHairAnchor':name+(row===rows.length-1?'Tip':'Mid');
        links.set(q.join(','),[[joint,1]]);points.push(q);
        uvs.push([.01+.98*(u+1)/2,.01+.98*lengths[row]/lengths.at(-1)]);
      }
    });
    const weights=p=>links.get(p.join(','));
    for(let r=1;r<rows.length;r++)for(let i=0;i<sides;i++) {
      const a=(r-1)*sides+i,b=(r-1)*sides+(i+1)%sides,c=r*sides+i,d=r*sides+(i+1)%sides;
      const faces=r===rows.length-1?[[a,b,r*sides]]:[[a,b,c],[b,d,c]];
      builder.surface(points,faces,GOLD,weights,uvs);
    }
    for(let i=1;i<sides-1;i++)builder.surface(points,[[0,i+1,i]],GOLD,weights,uvs);
  }
  for(const c of chains)lock(c.rows??c.points,c.theta,c.width,c.depth,c.name);
  // Short front locks leave room for separate ear-front, side-facing locks.
  for(const side of [-1,1])lock([
    [side*.20,2.23,.18],
    [side*.255,2.10,.18],
    [side*.207,1.98,.18,.50],
    [side*.193,1.935,.16],
  ],0,.045,.045);
  for(const side of [-1,1]) {
    const {rows,width,depth}=LUMI_TENDRIL;
    lock(rows.map(([x,...rest])=>[side*x,...rest]),side*Math.PI/2,width,depth,
      side===1?'LumiSideLeft':'LumiSideRight',false,.022,true);
  }
  // A single ear-side accent preserves the backward sweep without a second tier.
  for(const side of [-1,1])lock([
    [side*.261,2.12,.12,.60],
    [side*.307,2.025,.035,1],
    [side*.29,1.965,-.060],
  ],side*Math.PI/2,.047,.015,side===1?'LumiSideLeft':'LumiSideRight');
  for(const {rows,width,depth=.014,lift=.016} of LUMI_FRINGE)lock(rows,0,width,depth,undefined,true,lift);
  const geometry=builder.finish();geometry.computeVertexNormals();
  geometry.deleteAttribute('color');
  const mesh=new SkinnedMesh(geometry,new MeshStandardMaterial({map:createLumiHairTexture(),roughness:.85}));
  mesh.name='Hair';mesh.frustumCulled=false;
  mesh.userData={capClearance:.018,hairDynamics:{version:1,space:'Head-local',solver:false,
    chains:chains.map(c=>({joints:['Root','Mid','Tip'].map(s=>c.name+s),pinned:1}))}};
  mesh.add(anchor);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));return mesh;
}
