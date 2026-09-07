import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Group } from 'three';
import { createBase45, createBase45Topology } from './base45.mjs';
import { pixelPainter } from '../modeling/pixel-atlas.mjs';

const SIZE=256,SPAN=.64,TOP=2.23,NEUTRAL='#ded5c5';
/** Diagnostic frontal projection only, not a production unwrap of the body. */
export const faceCheckUV=([x,y])=>[.5+x/SPAN,(TOP-y)/SPAN];

export function createFaceCheckTexture(surface) {
  if(!['eyes','grid'].includes(surface))throw new Error('Invalid inspection surface');
  const p=pixelPainter(SIZE);p.rect(0,0,SIZE,SIZE,NEUTRAL);
  for(let v=8;v<SIZE-8;v++)for(let u=8;u<SIZE-8;u++) {
    const x=((u+.5)/SIZE-.5)*SPAN,y=TOP-(v+.5)/SIZE*SPAN;
    if(surface==='grid') {
      p.dot(u,v,(Math.floor(u/8)+Math.floor(v/8))%2?'#c8bca8':'#e8dfd0');
      if(u===128)p.dot(u,v,'#b1514b');
      continue;
    }
    const dx=Math.abs(x)-.102,dy=y-1.932,w=.055;
    const half=.031*Math.max(0,1-(Math.abs(dx)/w)**1.7);
    if(Math.abs(dx)<w&&Math.abs(dy)<half+.0015) {
      let color='#fffaf0';
      if((dx/.017)**2+(dy/.034)**2<1)color=dy>0?'#304e57':'#58858a';
      if((dx/.007)**2+(dy/.029)**2<1)color='#26313a';
      if(((dx+.006)/.005)**2+((dy-.012)/.006)**2<1)color='#fffdf2';
      if(dy>half-.004||dy< -half+.0005)color='#34353c';
      p.dot(u,v,color);
    }
    const brow=1.978+.004*(1-(dx/.05)**2);
    if(Math.abs(dx)<.047&&Math.abs(y-brow)<.0015)p.dot(u,v,'#66635d');
    // A small neutral smile is an orientation/UV check, not an expression rig.
    if(Math.abs(x)<.023&&Math.abs(y-(1.814+5*x*x))<.0014)p.dot(u,v,'#92786e');
  }
  return p.texture(`BASE-45 ${surface} diagnostic 256`);
}

/** Exact source faces/normals, cropped at the neck. UV seam duplicates retain
 * source indices; no vertices are displaced to make the texture look better. */
export function createBase45Inspection({surface='clay'}={}) {
  if(!['clay','eyes','grid'].includes(surface))throw new Error('Invalid inspection surface');
  const data=createBase45Topology(),original=createBase45(),sourceGeometry=original.getObjectByName('BaseBody').geometry;
  const selected=data.faces.map((face,i)=>({face,region:data.regions[i]}))
    .filter(({region})=>region.startsWith('Head')||region==='Neck');
  const positions=[],normals=[],uv=[],faces=[],sourceVertices=[],paintedFaces=[],mapping=new Map();
  for(const {face,region} of selected) {
    const paint=surface!=='clay'&&( /Head\.(Left|Right)(Orbit|Lid|Eye)$/.test(region)
      ||(region==='Head'&&face.every(i=>data.positions[i][2]>.1&&data.positions[i][1]<1.99)) );
    paintedFaces.push(paint);
    faces.push(face.map(v=>{
      const key=`${v}:${paint}`;
      if(!mapping.has(key)) {
        mapping.set(key,sourceVertices.length);sourceVertices.push(v);
        positions.push(...sourceGeometry.attributes.position.array.slice(v*3,v*3+3));
        normals.push(...sourceGeometry.attributes.normal.array.slice(v*3,v*3+3));
        uv.push(...(paint?faceCheckUV(data.positions[v]):[.01,.01]));
      }
      return mapping.get(key);
    }));
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  geometry.setIndex(faces.flatMap(([a,b,c,d])=>[a,b,c,a,c,d]));
  const material=new MeshStandardMaterial({color:surface==='clay'?'#b9c5ca':'#ffffff',roughness:.86});
  if(surface!=='clay') {
    geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));material.map=createFaceCheckTexture(surface);
  }
  const mesh=new Mesh(geometry,material);mesh.name='HeadInspection';
  mesh.userData={quadTopology:{version:1,vertexCount:sourceVertices.length,faces},sourceVertices,paintedFaces};
  const root=new Group();root.name='BASE-45 face check';
  root.userData={diagnostic:true,surface,source:'base45',note:'Unchanged head crop; planar diagnostic UV, not a production unwrap'};
  root.add(mesh);
  original.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return root;
}
