import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, MeshStandardMaterial } from 'three';
import { createBase45, createBase45Topology } from './base45.mjs';
import { createLumiTexture, lumiFaceUV } from './lumi-texture.mjs';
import { createLumiHair } from './lumi-hair.mjs';

/** A separate instance of the accepted base. Reindex for UV seams only:
 * positions, normals, rest bones and skin weights are never reshaped here. */
export function createLumi() {
  const root=createBase45(),data=createBase45Topology(),body=root.getObjectByName('BaseBody'),source=body.geometry;
  root.name='LUMI';root.userData={...root.userData,modelId:'lumi',base:'base45',baseCheckpoint:'29e4571'};
  const mapping=new Map(),sourceVertices=[],faces=[],uv=[];
  for(const [i,face] of data.faces.entries()) {
    const region=data.regions[i];
    const painted=/Head\.(Left|Right)(Orbit|Lid|Eye)$/.test(region)||(region==='Head'&&face.every(v=>data.positions[v][2]>.1&&data.positions[v][1]<1.99));
    const center=face.reduce((a,v)=>a.map((n,k)=>n+data.positions[v][k]/face.length),[0,0,0]);
    const tile=region.endsWith('Ear.Bowl')?'ear':painted?'face':center[1]>1.62||Math.abs(center[0])>.89?'skin':center[1]<.16?'boots':'suit';
    faces.push(face.map(v=>{
      const key=`${v}:${tile}`;
      if(!mapping.has(key)) {
        mapping.set(key,sourceVertices.length);sourceVertices.push(v);
        uv.push(...(painted?lumiFaceUV(data.positions[v]):tile==='ear'?[.215,.02]:tile==='skin'?[.15,.02]:tile==='boots'?[.09,.02]:[.025,.02]));
      }
      return mapping.get(key);
    }));
  }
  const geometry=new BufferGeometry();
  for(const name of ['position','normal','skinIndex','skinWeight']) {
    const a=source.attributes[name],values=sourceVertices.flatMap(v=>[...a.array.slice(v*a.itemSize,(v+1)*a.itemSize)]);
    geometry.setAttribute(name,name==='skinIndex'?new Uint16BufferAttribute(values,a.itemSize):new Float32BufferAttribute(values,a.itemSize));
  }
  geometry.setIndex(faces.flatMap(([a,b,c,d])=>[a,b,c,a,c,d]));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  const hair=createLumiHair(data,source);
  root.getObjectByName('HairSocket').add(hair.getObjectByName('LumiHairAnchor'));
  // glTF skins belong at the scene root. Attach their bones to the socket and
  // bake the rest offset into geometry; do not rely on a skinned mesh parent.
  hair.geometry.translate(0,1.76,0);root.add(hair);root.updateMatrixWorld(true);hair.bind(hair.skeleton);
  body.geometry=geometry;body.material.dispose();body.material=new MeshStandardMaterial({map:createLumiTexture(),roughness:.9});
  body.userData={quadTopology:{version:1,vertexCount:sourceVertices.length,faces},sourceVertices};source.dispose();
  root.updateMatrixWorld(true);return root;
}
