import { Scene, Bone, Skeleton, SkinnedMesh, Mesh, MeshStandardMaterial } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { FES256, FES256_BONES } from './fes256-definition.mjs';
import { createFes256Face } from './fes256-face.mjs';
import { FES256_HEAD, headSurfaceDepth } from './fes256-head.mjs';

/** Rings with shared corners and n-2 cap triangles; hidden caps count in the budget. */
function ringSolid(mesh,rings,color,bone,caps=[true,true]) {
  const n=rings[0].length,faces=[],points=rings.flat();
  for(let row=1;row<rings.length;row++)for(let i=0;i<n;i++) {
    const a=(row-1)*n+i,b=(row-1)*n+(i+1)%n,c=row*n+i,d=row*n+(i+1)%n;
    faces.push([a,b,c],[b,d,c]);
  }
  for(const [end,start] of [0,(rings.length-1)*n].entries())if(caps[end])for(let i=1;i<n-1;i++)faces.push([start,start+i,start+i+1]);
  mesh.convex(points,faces,color,bone);
}
const rectangle=(x,y,z,w,d)=>[[x-w,y,z-d],[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d]];

export function createFes256() {
  const root=new Scene();root.name=FES256.name;
  root.userData={modelId:FES256.id,title:'LILA-256 · little coat wanderer',groundLevel:0,rigged:true,units:'meters',version:1};
  const bones=new Map(),anchors=new Map(FES256_BONES.map(b=>[b.name,b.position]));
  for(const definition of FES256_BONES) {
    const bone=new Bone();bone.name=definition.name;
    if(bone.name==='Head')bone.userData.focusTarget=true;
    const origin=anchors.get(definition.parent)??[0,0,0];
    bone.position.set(...definition.position.map((v,i)=>v-origin[i]));
    (bones.get(definition.parent)??root).add(bone);bones.set(bone.name,bone);
  }
  const mesh=compactMesh([...bones.keys()]),p=FES256.palette;
  const head=compactMesh(['Head']),hair=compactMesh(['Head']);
  const coatOutline=[[-.55,1],[.55,1],[1,0],[.55,-1],[-.55,-1],[-1,0]];
  ringSolid(mesh,[[.48,.35,.225],[.73,.24,.155],[1.00,.26,.17]].map(([y,w,d])=>coatOutline.map(([x,z])=>[x*w,y,z*d])),
    ([x,y,z])=>y<.5?p.coat:z>.05?p.coatLight:p.coat,'Body');
  ringSolid(mesh,[rectangle(0,.95,0,.075,.07),rectangle(0,1.10,0,.075,.07)],p.skin,'Head',[false,false]);
  // Hair has its own silhouette; the skin uses anatomical front-to-side columns.
  const outline=[[-.20,.28],[.20,.28],[.32,.10],[.28,-.20],[.16,-.29],[-.16,-.29],[-.28,-.20],[-.32,.10]];
  head.convex(FES256_HEAD.points,FES256_HEAD.faces,p.skin,'Head');
  const hairBottom=outline.map(([x,z],i)=>[x*1.08,[1.435,1.435,1.13,1.07,1.06,1.06,1.07,1.13][i],z*1.08]);
  const hairTop=outline.map(([x,z])=>[x*1.15,1.46,z*1.14]);
  const hairMiddle=outline.map(([x,z],i)=>[x*1.17,i<2?1.445:1.30,z*1.16]);
  const hairCrown=outline.map(([x,z])=>[x*.78,1.59,z*.80]);
  const hairPoints=[...hairBottom,...hairMiddle,...hairTop,...hairCrown,[0,1.64,-.02]],hairFaces=[];
  for(let i=0;i<8;i++) {
    const j=(i+1)%8;
    for(const row of [0,8,16])hairFaces.push([row+i,row+j,row+i+8],[row+j,row+j+8,row+i+8]);
    hairFaces.push([i+24,j+24,32]);
  }
  hair.convex(hairPoints,hairFaces,([x,y,z])=>y>1.51?p.hairLight:p.hair,'Head');
  for(const [left,right,tip,y] of [[-.22,-.09,-.16,1.36],[-.14,.01,-.075,1.38],[-.065,.10,.015,1.315],[.04,.17,.11,1.38],[.15,.22,.20,1.35]]) {
    const front=[[left,1.47],[tip,y],[right,1.47]].map(([x,y])=>[x,y,Math.max(.332,headSurfaceDepth(x,y)+.026)]);
    hair.convex([...front,...front.map(([x,y,z])=>[x,y,Math.max(z-.02,headSurfaceDepth(x,y)+.006)])],
      [[0,1,2],[3,5,4],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]],p.hair,'Head');
  }
  for(const side of [-1,1]) {
    const name=side===1?'Left':'Right';
    ringSolid(mesh,[rectangle(side*.39,.77,0,.080,.088),rectangle(side*.26,.96,0,.095,.105)],p.coat,`${name}Arm`);
    ringSolid(mesh,[rectangle(side*.41,.69,0,.043,.045),rectangle(side*.39,.78,0,.05,.05)],p.cream,`${name}Hand`);
    ringSolid(mesh,[rectangle(side*.14,.10,0,.052,.054),rectangle(side*.14,.56,0,.080,.075)],p.boots,`${name}Leg`,[true,false]);
    ringSolid(mesh,[rectangle(side*.14,0,.035,.075,.11),rectangle(side*.14,.145,.015,.07,.08)],p.boots,`${name}Foot`);
    const ear=[[side*.292,1.19,.06],[side*.355,1.245,.03],[side*.292,1.29,.07],[side*.303,1.24,-.045]];
    head.convex(ear,[[0,1,2],[0,3,1],[1,3,2],[2,3,0]],p.skin,'Head');
    hair.convex([[side*.30,1.43,-.06],[side*.39,1.40,-.05],[side*.46,1.03,-.03],[side*.34,1.39,-.17]],
      [[0,1,2],[0,3,1],[1,3,2],[2,3,0]],p.hair,'Head');
    hair.polygon([[side*.275,1.50,.17],[side*.35,1.53,.12],[side*.40,1.28,.12],[side*.32,1.31,.17]],
      [side,0,1],p.ink,'Head');
    mesh.polygon([[side*.04,1.02,.185],[side*.145,.97,.185],[side*.08,.89,.192]],[0,0,1],p.cream,'Body');
  }
  mesh.polygon([[0,.965,.197],[-.033,.933,.197],[0,.9,.197],[.033,.933,.197]],[0,0,1],p.gold,'Body');
  const material=new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,flatShading:true});material.name='Lila palette';
  const skin=new SkinnedMesh(mesh.finish(),material);skin.name='Lila';skin.frustumCulled=false;root.add(skin);
  for(const [name,builder] of [['HeadSkin',head],['Hair',hair]]) {
    const geometry=builder.finish();geometry.translate(0,-1.05,0);
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
    const partMaterial=name==='HeadSkin'?material.clone():material;
    if(name==='HeadSkin') {partMaterial.flatShading=false;partMaterial.name='Lila soft skin';geometry.computeVertexNormals();}
    const part=new Mesh(geometry,partMaterial);part.name=name;bones.get('Head').add(part);
  }
  bones.get('Head').add(createFes256Face());
  root.updateMatrixWorld(true);skin.bind(new Skeleton([...bones.values()]));
  return root;
}
