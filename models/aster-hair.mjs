import { Bone, Color, Skeleton, SkinnedMesh, MeshStandardMaterial } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { ASTER } from './aster-definition.mjs';

const chains=[
  {id:'side-left',prefix:'HairSideLeft',points:[[.225,.26,.145],[.295,-.08,.20],[.31,-.51,.20]],width:.07,depth:.04},
  {id:'side-right',prefix:'HairSideRight',points:[[-.225,.26,.145],[-.295,-.08,.20],[-.31,-.51,.20]],width:.07,depth:.04},
  {id:'back-left',prefix:'HairBackLeft',points:[[.13,.20,-.23],[.16,-.10,-.29],[.17,-.55,-.32]],width:.17,depth:.045},
  {id:'back-right',prefix:'HairBackRight',points:[[-.13,.20,-.23],[-.16,-.10,-.29],[-.17,-.55,-.32]],width:.17,depth:.045},
  {id:'ahoge',prefix:'HairAhoge',points:[[0,.555,-.015],[.035,.69,-.02],[.17,.74,-.01]],width:.016,depth:.013},
];
export const ASTER_HAIR_DYNAMICS=Object.freeze({version:1,anchor:'HairAnchor',space:'anchor-local',
  chains:chains.map(c=>({id:c.id,joints:['Root','Mid','Tip'].map(s=>c.prefix+s),pinned:1,
    radius:c.id==='ahoge'?.012:.025,stiffness:c.id==='ahoge'?.8:.55,drag:.25,maxAngle:.65})),
  colliderHints:[{bone:'Head',center:[0,.20,0],radius:.21},{bone:'Chest',center:[0,-.12,0],radius:.23},
    {bone:'Chest',center:[.25,.05,0],radius:.12},{bone:'Chest',center:[-.25,.05,0],radius:.12}],
});

/** Self-contained skinned hair; its coordinates are Head-local. */
export function createAsterHair() {
  const anchor=new Bone();anchor.name='HairAnchor';const bones=[anchor];
  for(const chain of chains) {
    let parent=anchor,origin=[0,0,0];
    chain.points.forEach((p,i)=>{
      const b=new Bone();b.name=chain.prefix+['Root','Mid','Tip'][i];
      b.position.set(...p.map((v,k)=>v-origin[k]));parent.add(b);bones.push(b);parent=b;origin=p;
    });
  }
  const hair=compactMesh(bones.map(b=>b.name)),p=ASTER.palette;
  // One continuous fringe, temples and crown, not hovering forelock plates.
  const rim=[[.275,.12,.10],[.285,.10,-.08],[.20,.09,-.235],[.075,.08,-.26],
    [-.075,.08,-.26],[-.20,.09,-.235],[-.285,.10,-.08],[-.275,.12,.10]];
  const backRoot=[];
  rim.forEach((v,i)=>{backRoot.push(v);if(i<rim.length-1)backRoot.push(v.map((n,k)=>(n+rim[i+1][k])/2));});
  const crests=new Set([3,5,7,9,11]);
  // Sculpted valleys and crests run through the scalp-to-length boundary.
  for(const i of crests)backRoot[i][2]-=.025;
  const lower=[[-.205,.30,.235],[-.175,.21,.25],[-.12,.29,.28],[.01,.22,.295],
    [.06,.30,.28],[.20,.24,.25],[.205,.30,.235],...backRoot];
  const isCrest=i=>i<7?i%2===1:crests.has(i-7);
  // Front columns sweep sideways from an off-center part. The rear ridges
  // taper into the crown instead of starting below a smooth helmet.
  const mid=lower.map(([x,,z],i)=>[i<7?x*.94+.025:x*1.10,.34,
    i<7?z+(isCrest(i)?.032:0):z*1.02-(isCrest(i)?.020:0)]);
  const shoulder=lower.map(([x,,z],i)=>[x*.82+(i<7?.055:0),.45,
    z*.80+(isCrest(i)?(i<7?.025:-.025):0)]);
  const upper=lower.map(([x,,z],i)=>[x*.45+(i<7?.035:0),.53,
    z*.45+(isCrest(i)?(i<7?.012:-.012):0)]);
  const top=lower.map(([x,,z])=>[x*.10,.56,z*.10]);
  const points=[...lower,...mid,...shoulder,...upper,...top],n=lower.length;
  for(let r=1;r<5;r++)for(let i=0;i<n;i++) {
    const a=(r-1)*n+i,b=(r-1)*n+(i+1)%n,c=r*n+i,d=r*n+(i+1)%n;
    hair.surface(points,[[a,b,c],[b,d,c]],p.hair,'HairAnchor');
  }
  hair.polygon(top,[0,1,0],p.hair,'HairAnchor');
  const inner=lower.map(([x,y,z],i)=>i<7?[x*.91,.2938,z-.045]:[x*.73,y+.03,z*.72]);
  for(let i=0;i<n;i++)hair.polygon([lower[i],inner[i],inner[(i+1)%n],lower[(i+1)%n]],
    [lower[i][0],-.5,lower[i][2]],p.hairDark,'HairAnchor');
  hair.polygon([[-.25,.41,-.13],[-.26,.09,-.13],[.26,.09,-.13],[.25,.41,-.13]],[0,0,1],p.hairDark,'HairAnchor');
  // A connected back with five shallow ridges. Roots follow the exact cap edge;
  // shared center vertices blend left/right controls instead of splitting apart.
  const rearRows=[backRoot,
    backRoot.map(([x,,z],i)=>[x*1.03,-.14,z-.025-(crests.has(i)?.060:0)]),
    backRoot.map(([x,,z],i)=>[x*.86,-.50-(crests.has(i)?.065:0),z-.035-(crests.has(i)?.040:0)]),
  ];
  const outer=rearRows.flat(),innerBack=outer.map(([x,y,z])=>[x*.97,y,z+.025]);
  const rearPoints=[...outer,...innerBack],cols=backRoot.length,count=outer.length,links=new Map();
  rearPoints.forEach((v,i)=>{
    const row=Math.floor((i%count)/cols),left=Math.max(0,Math.min(1,.5+v[0]/.18));
    links.set(v.join(','),row===0?[['HairAnchor',1]]:
      left===1?[[`HairBackLeft${row===1?'Mid':'Tip'}`,1]]:
      left===0?[[`HairBackRight${row===1?'Mid':'Tip'}`,1]]:
      [[`HairBackLeft${row===1?'Mid':'Tip'}`,left],[`HairBackRight${row===1?'Mid':'Tip'}`,1-left]]);
  });
  const rearWeights=v=>links.get(v.join(','));
  for(let r=1;r<3;r++)for(let i=0;i<cols-1;i++) {
    const a=(r-1)*cols+i,b=a+1,c=r*cols+i,d=c+1;
    hair.surface(rearPoints,[[a,c,b],[b,c,d]],p.hair,rearWeights);
    hair.surface(rearPoints,[[a+count,b+count,c+count],[b+count,d+count,c+count]],p.hairDark,rearWeights);
  }
  for(const edge of [0,cols-1])for(let r=1;r<3;r++) {
    const a=(r-1)*cols+edge,b=r*cols+edge;
    hair.convex(rearPoints,[[a,b,a+count],[b,b+count,a+count]],p.hair,rearWeights);
  }
  for(let i=0;i<cols-1;i++) {
    const a=2*cols+i,b=a+1;
    hair.convex(rearPoints,[[a,a+count,b],[b,a+count,b+count]],p.hair,rearWeights);
  }
  for(const chain of chains.filter(c=>!c.id.startsWith('back-'))) {
    const [a,b,c]=chain.points;
    const rows=chain.id==='ahoge'
      ?[[...a,.023,.016],[.004,.61,-.015,.022,.015],[...b,.018,.012],[.12,.775,-.015,.013,.009],[...c,.002,.002]]
      :[[a[0]*.91,a[1]+.09,a[2]+.02,chain.width*.7,chain.depth],[...a,chain.width,chain.depth],
        [...b,chain.width*.92,chain.depth],[...c,chain.width*.20,.015]];
    const sides=chain.id==='ahoge'?4:5;
    const vertices=rows.flatMap(([x,y,z,w,d])=>sides===4
      ?[[x-w,y,z-d],[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d]]
      :[[x-w,y,z],[x-w*.65,y,z-d],[x+w*.65,y,z-d],[x+w,y,z],[x,y,z+d]]);
    const links=new Map();vertices.forEach((v,i)=>{
      const row=Math.floor(i/sides),joint=row<2?0:row===rows.length-1?2:1;
      links.set(v.join(','),[[chain.prefix+['Root','Mid','Tip'][joint],1]]);
    });
    const weights=point=>links.get(point.join(','));
    for(let r=1;r<rows.length;r++)for(let i=0;i<sides;i++) {
      const a=(r-1)*sides+i,b=(r-1)*sides+(i+1)%sides,c=r*sides+i,d=r*sides+(i+1)%sides;
      hair.surface(vertices,[[a,b,c],[b,d,c]],i===3?p.hairLight:i===1?p.hairDark:p.hair,weights);
    }
    for(const start of [0,(rows.length-1)*sides])for(let i=1;i<sides-1;i++)
      hair.surface(vertices,[start===0?[start,start+i+1,start+i]:[start,start+i,start+i+1]],p.hair,weights);
  }
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0});
  material.name='Aster honey-blonde hair';
  const geometry=hair.finish();geometry.computeVertexNormals();
  // Soft color along each sculpted ridge follows the strand direction, not
  // horizontal rows; it makes the clumps legible without drawing dark outlines.
  const key=p=>p.map(v=>v.toFixed(5)).join(','),tints=new Map(),base=new Color(p.hair);
  points.forEach((v,i)=>{
    const row=Math.floor(i/n),crest=isCrest(i%n);
    tints.set(key(v),base.clone().lerp(new Color(crest?'#e9c878':'#bc9446'),row===4?0:.38).toArray());
  });
  outer.forEach((v,i)=>{
    const row=Math.floor(i/cols),crest=crests.has(i%cols);
    tints.set(key(v),base.clone().lerp(new Color(crest?'#e9c878':'#bc9446'),row===0?.38:.65).toArray());
  });
  const position=geometry.attributes.position,color=geometry.attributes.color;
  for(let i=0;i<position.count;i++) {
    const tint=tints.get(key([position.getX(i),position.getY(i),position.getZ(i)]));
    if(tint)for(let k=0;k<3;k++)color.array[i*3+k]=Math.round(tint[k]*255);
  }
  const mesh=new SkinnedMesh(geometry,material);mesh.name='Hair';mesh.frustumCulled=false;
  mesh.userData.hairDynamics=structuredClone(ASTER_HAIR_DYNAMICS);
  mesh.add(anchor);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));return mesh;
}
