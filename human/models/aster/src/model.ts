import type { CompactMeshBuilder, SurfaceColor, Influences, Point, Weight } from '../../../../modeling/types.ts';
import { Scene, Bone, Skeleton, SkinnedMesh, Mesh, MeshBasicMaterial } from 'three';
import { compactMesh } from '../../../../modeling/compact-mesh.ts';
import { ASTER, ASTER_BONES } from './definition.ts';
import { createAsterHead } from './head.ts';
import { createAsterHair } from './hair.ts';

function rings(builder: CompactMeshBuilder,rows:number[][][],color:SurfaceColor,influences:Influences,caps=true) {
  const n=rows[0].length,points=rows.flat();
  for(let r=1;r<rows.length;r++)for(let i=0;i<n;i++) {
    const a=(r-1)*n+i,b=(r-1)*n+(i+1)%n,c=r*n+i,d=r*n+(i+1)%n;
    const center=[0,1,2].map(axis=>[a,b,c,d].reduce((sum,k)=>sum+points[k][axis],0)/4);
    builder.convex(points,[[a,b,c],[b,d,c]],typeof color==='function'?color(center):color,influences);
  }
  if(caps)for(const start of [0,(rows.length-1)*n])for(let i=1;i<n-1;i++)builder.convex(points,[[start,start+i,start+i+1]],color,influences);
}
const rect=(x: number,y: number,z: number,w: number,d: number)=>[[x-w,y,z-d],[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d]];

export function createAster() {
  const root=new Scene();root.name=ASTER.name;
  root.userData={modelId:ASTER.id,title:ASTER.name,units:'meters',groundLevel:0,rigged:true,version:1};
  const bones=new Map<string,Bone>(),anchors=new Map(ASTER_BONES.map(b=>[b.name,b.position]));
  for(const {name,parent,position} of ASTER_BONES) {
    const bone=new Bone();bone.name=name;const origin=anchors.get(parent??'')??[0,0,0];
    bone.position.fromArray(position.map((v,i)=>v-origin[i]));if(name==='Head')bone.userData.focusTarget=true;
    (bones.get(parent??'')??root).add(bone);bones.set(name,bone);
  }
  const p=ASTER.palette,body=compactMesh([...bones.keys()]);
  const torsoWeights=([,y]:Point):Weight[]=>y<1.05?[['Hips',1]]:y>1.3?[['Chest',1]]:[['Hips',.5],['Chest',.5]];
  const outline=[[-.65,1],[.65,1],[1,.15],[.80,-.8],[-.80,-.8],[-1,.15]];
  const coatRows=[[.81,.295,.19],[.88,.30,.19],[1.12,.235,.16],[1.43,.255,.16]];
  rings(body,coatRows.map(([y,w,d])=>outline.map(([x,z])=>[x*w,y,z*d])),
    ([x,y,z])=>y<.86?p.coatSide:z>.10?p.coat:p.coatSide,torsoWeights);
  // Short exposed neck; no bulky scarf or high collar substitutes for anatomy.
  body.polygon([[-.14,1.445,.168],[.14,1.445,.168],[.075,1.11,.170],[-.075,1.11,.170]],[0,0,1],p.cream,torsoWeights);
  body.polygon([[-.17,1.445,.18],[.15,1.12,.177],[.17,1.16,.18],[-.12,1.445,.18]],[0,0,1],p.sole,torsoWeights);
  body.polygon([[.02,1.255,.19],[.08,1.21,.19],[.12,1.255,.19],[.065,1.29,.19]],[0,0,1],p.gold,'Chest');
  for(const side of [-1,1]) {
    const n=side===1?'Left':'Right';
    const armWeights=([x,y]:Point):Weight[]=>y>1.22?[[n+'UpperArm',1]]:y<1.10?[[n+'Forearm',1]]:[[n+'UpperArm',.5],[n+'Forearm',.5]];
    body.loft([[side*.25,1.415,0,.105,.105],[side*.41,1.19,0,.106,.1],
      [side*.46,1.11,0,.12,.115],[side*.62,.895,0,.142,.125]],4,
      ([x,y,z])=>y<.96?p.trim:z>.02?p.coat:p.coatSide,armWeights,Math.PI/4);
    rings(body,[rect(side*.60,.925,.018,.050,.056),rect(side*.695,.765,.035,.019,.035)],p.skin,n+'Hand');
    const legWeights=([,y]:Point):Weight[]=>y>.60?[[n+'Thigh',1]]:y<.48?[[n+'Shin',1]]:[[n+'Thigh',.5],[n+'Shin',.5]];
    rings(body,[[.13,.17,.056,.065],[.48,.156,.06,.061],[.57,.155,.064,.067],[.99,.135,.085,.085]].map(([y,x,w,d])=>rect(side*x,y,0,w,d)),
      ([,y])=>y>.65?'#8f5d49':p.boot,legWeights);
    rings(body,[rect(side*.17,.02,.04,.075,.13),rect(side*.17,.09,.045,.075,.13),rect(side*.17,.31,0,.064,.070)],
      ([,y])=>y<.06?p.sole:p.boot,n+'Foot');
    body.polygon([[side*.13,.23,.082],[side*.21,.23,.082],[side*.21,.255,.075],[side*.13,.255,.075]],[0,0,1],p.trim,n+'Foot');
  }
  const material=new MeshBasicMaterial({vertexColors:true});material.name='Aster illustrated palette';
  const skin=new SkinnedMesh(body.finish(),material);skin.name='Body';skin.frustumCulled=false;root.add(skin);
  const neck=compactMesh(['Chest']);
  neck.loft([[0,1.42,.025,.048,.045],[0,1.51,.025,.04,.04]],6,p.skin,'Chest');
  const neckGeometry=neck.finish();neckGeometry.translate(0,-1.36,0);
  neckGeometry.deleteAttribute('skinIndex');neckGeometry.deleteAttribute('skinWeight');
  const neckMesh=new Mesh(neckGeometry,material);neckMesh.name='Neck';bones.get('Chest')!.add(neckMesh);
  const {face,skull}=createAsterHead();bones.get('Head')!.add(face,skull);
  // glTF skins must be scene-level nodes. Only their anchor inherits Head.
  const hair=createAsterHair();bones.get('Head')!.add(hair.getObjectByName('HairAnchor')!);
  hair.userData.focusTargetName='Head';root.add(hair);
  root.updateMatrixWorld(true);skin.bind(new Skeleton([...bones.values()]));return root;
}
