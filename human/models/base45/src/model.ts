import type { Weight } from '../../../../modeling/types.ts';
import { Scene, Bone, Object3D, Skeleton, SkinnedMesh, MeshStandardMaterial, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { BASE45, BASE45_BONES } from './definition.ts';
import { createTopologyBuilder, orientTopology } from '../../../../modeling/quad-topology.ts';
import { validateBaseTopology } from '../../../../contracts/base-topology.ts';
import { appendBase45Head } from './head.ts';
import { computeQuadNormals } from '../../../../modeling/quad-normals.ts';

const mix=(a: string,b: string,t: number): Weight[]=>t<=0?[[a,1]]:t>=1?[[b,1]]:[[a,1-t],[b,t]];
const outline=Array.from({length:12},(_,i)=>[Math.sin(i*Math.PI/6),Math.cos(i*Math.PI/6)]);
const section=Array.from({length:8},(_,i)=>[-Math.cos((i-1)*Math.PI/4),-Math.sin((i-1)*Math.PI/4)]);

export function createBase45Topology() {
  const b=createTopologyBuilder(),{vertex,bridge,cap}=b;
  const ring=(points: number[][],weights: string | Weight[] | ((p: number[])=>Weight[]))=>points.map(p=>vertex(p,typeof weights==='function'?weights(p):weights));
  const torsoWeights=([,y]: number[]): Weight[]=>y<1.13?[['Hips',1]]:y<1.31?mix('Hips','Spine',(y-1.13)/.18):mix('Spine','Chest',(y-1.31)/.10);
  // The middle two upper rows leave a shared-index opening for each shoulder.
  const torso=[
    [1.025,.205,.13,.15],[1.115,.19,.125,.14],[1.24,.155,.115,.12],
    [1.40,.20,.155,.12],[1.46,.245,.145,.12],[1.535,.265,.13,.12],
    [1.61,.235,.11,.11],
  ].map(([y,w,front,back],r)=>ring(outline.map(([x,z],i)=>[x*w,y+(r===0&&[0,6].includes(i)?-.035:0),z*(z>0?front:back)]),torsoWeights));
  for(let r=1;r<torso.length;r++)bridge(torso[r-1],torso[r],'Torso',[5,6].includes(r)?[2,3,8,9]:[]);

  appendBase45Head(b,torso.at(-1)!);

  // A single crotch bridge splits the pelvis into two eight-vertex leg openings.
  const crotch=vertex([0,.975,0],'Hips');
  for(const s of [1,-1]) {
    const n=s===1?'Left':'Right';
    let leg=(s===1?[0,1,2,3,4,5,6]:[0,11,10,9,8,7,6]).map(i=>torso[0][i]);leg.push(crotch);
    const rows=[
      [.90,.125,.092,.107,.112,0],
      [.625,.15,.075,.076,.085,.025],[.585,.15,.076,.077,.077,.025],
      [.545,.152,.076,.076,.078,.02],[.43,.163,.085,.087,.09,0],
      [.16,.17,.064,.065,.07,-.015],
      [.09,.17,.085,.20,.095,.015],[.025,.17,.09,.215,.10,.015],
      [0,.17,.085,.21,.095,.015],
    ];
    for(const [y,x,w,front,back,z] of rows) {
      let weights: Weight[]=y>.625?mix('Hips',n+'Thigh',(1.015-y)/.1):y>.545?mix(n+'Thigh',n+'Shin',(.625-y)/.08):y>.16?[[n+'Shin',1]]:y>.09?mix(n+'Shin',n+'Foot',(.16-y)/.07):[[n+'Foot',1]];
      const current=ring(Array.from({length:8},(_,i)=>{
        const angle=(i-1)*Math.PI/4,c=Math.cos(angle);
        return [s*(x+Math.sin(angle)*w),y,z+c*(c>0?front:back)];
      }),(p: number[])=>p[1]<=.09&&p[2]>.13?mix(n+'Foot',n+'Toe',.5):weights);
      bridge(leg,current,n+'Leg');leg=current;
    }
    cap(leg,n+'Sole',n+'Foot');

    // Shared 2x2-panel shoulder opening: bottom-front -> back -> top -> front.
    const indices=s===1?[2,3,4]:[10,9,8];
    let arm=[torso[4][indices[0]],torso[4][indices[1]],torso[4][indices[2]],torso[5][indices[2]],torso[6][indices[2]],torso[6][indices[1]],torso[6][indices[0]],torso[5][indices[0]]];
    for(const [x,h,d] of [[.315,.078,.095],[.56,.061,.062],[.60,.06,.06],[.64,.063,.063],[.76,.06,.056]]) {
      const weights: Weight[]=x<.4?mix(n+'Clavicle',n+'UpperArm',(x-.265)/.135):x<.56?[[n+'UpperArm',1]]:x<.64?mix(n+'UpperArm',n+'Forearm',(x-.56)/.08):[[n+'Forearm',1]];
      const current=ring(section.map(([y,z])=>[s*x,1.535+y*h,z*d]),weights);
      bridge(arm,current,n+'Arm');arm=current;
    }
    const palms=[];
    for(const [x,h,d] of [[.89,.034,.038],[.945,.035,.064],[1.005,.029,.067],[1.095,.019,.05]]) {
      const current=ring(section.map(([y,z])=>[s*x,1.535+y*h,z*d]),n+'Hand');
      bridge(arm,current,n+'Hand',palms.length===2?[6,7]:[]);palms.push(current);arm=current;
    }
    cap(arm,n+'Hand',n+'Hand');
    // Separate thumb silhouette without disconnected primitive intersections.
    const a=palms[1],c=palms[2];let thumb=[a[6],a[7],a[0],c[0],c[7],c[6]];
    const center=[0,1,2].map(k=>thumb.reduce((sum,i)=>sum+b.data.positions[i][k],0)/6);
    const source=thumb.map(i=>b.data.positions[i]);
    for(const [scale,dx,dy,dz] of [[.45,.025,-.03,.083]]) {
      const current=ring(source.map(p=>p.map((v,k)=>center[k]+(v-center[k])*scale+[s*dx,dy,dz][k])),n+'Hand');
      bridge(thumb,current,n+'Thumb');thumb=current;
    }
    cap(thumb,n+'Thumb',n+'Hand');
  }
  return validateBaseTopology(orientTopology(b.data));
}

export function createBase45() {
  const data=createBase45Topology(),root=new Scene();root.name='BASE-45';
  root.userData={modelId:'base45',groundLevel:0,units:'meters',headHeight:BASE45.headHeight,headCount:BASE45.height/BASE45.headHeight};
  const bones=new Map<string,Bone>(),anchors=new Map(BASE45_BONES.map(b=>[b.name,b.position]));
  for(const {name,parent,position} of BASE45_BONES) {
    const bone=new Bone();bone.name=name;bone.position.fromArray(position.map((v,i)=>v-(anchors.get(parent ?? '')?.[i]??0)));
    (bones.get(parent??'')??root).add(bone);bones.set(name,bone);
  }
  for(const name of ['FaceSocket','HairSocket']){const socket=new Object3D();socket.name=name;socket.userData={units:'meters',forward:'+Z',origin:'Head rest anchor (0, 1.76, 0)'};bones.get('Head')!.add(socket);}
  const geometry=new BufferGeometry(),indices=[];
  for(const f of data.faces)for(let i=1;i<f.length-1;i++)indices.push(f[0],f[i],f[i+1]);
  geometry.setAttribute('position',new Float32BufferAttribute(data.positions.flat(),3));geometry.setIndex(indices);
  const names=[...bones.keys()],skinIndices=[],skinWeights=[];
  for(const weights of data.weights){for(let i=0;i<4;i++){skinIndices.push(weights[i]?names.indexOf(weights[i][0]):0);skinWeights.push(weights[i]?.[1]??0);}}
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(skinWeights,4));computeQuadNormals(geometry,data.faces);
  const material=new MeshStandardMaterial({color:'#b9c5ca',roughness:.86});material.name='Neutral clay';
  const skin=new SkinnedMesh(geometry,material);skin.name='BaseBody';skin.frustumCulled=false;
  // Runtime wire rendering uses authoring edges, never the triangle diagonals.
  skin.userData.quadTopology={version:1,vertexCount:data.positions.length,faces:data.faces};
  root.add(skin);root.updateMatrixWorld(true);skin.bind(new Skeleton([...bones.values()]));return root;
}
