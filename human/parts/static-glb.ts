import {Matrix3,Matrix4,Quaternion,Vector3} from 'three';
import {GlbEditor} from '../../modeling/glb-editor.ts';
import type {MeshData,Vertex} from './head-swap.ts';

interface Material {
  name?:string;
  pbrMetallicRoughness:{baseColorTexture:{index:number};baseColorFactor?:number[];metallicFactor?:number;roughnessFactor?:number};
  doubleSided?:boolean;
}
interface StaticDocument {
  nodes:{mesh?:number;children?:number[];matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]}[];
  scenes:{nodes:number[]}[];scene?:number;
  meshes:{primitives:{attributes:Record<string,number>;indices:number;material:number;mode?:number;targets?:unknown}[]}[];
  materials:Material[];
  textures:{source:number;sampler?:number}[];
  images:{bufferView:number;mimeType:string;uri?:string}[];
  samplers?:Record<string,number>[];
  skins?:unknown[];animations?:unknown[];extensionsUsed?:string[];
}
export interface TexturedMesh {mesh:MeshData;material:Material;image:Uint8Array;mimeType:string;sampler?:Record<string,number>}

/** Deliberately narrow adapter for the inspected static, single-material Tripo outputs. */
export function readStaticGlb(bytes:Uint8Array):TexturedMesh {
  const editor=new GlbEditor(bytes),doc=editor.doc as unknown as StaticDocument;
  if(doc.skins?.length||doc.animations?.length||doc.extensionsUsed?.length)throw Error('Only plain static GLB supported');
  const instances:{mesh:number;matrix:Matrix4}[]=[];
  const visit=(id:number,parent:Matrix4,ancestors:Set<number>)=>{
    if(ancestors.has(id))throw Error('Cyclic scene');
    const node=doc.nodes[id];if(!node)throw Error('Missing node');
    const matrix=parent.clone().multiply(editor.nodeMatrix(id)),seen=new Set(ancestors).add(id);
    if(node.mesh!==undefined)instances.push({mesh:node.mesh,matrix});
    for(const child of node.children??[])visit(child,matrix,seen);
  };
  for(const root of doc.scenes[doc.scene??0].nodes)visit(root,new Matrix4(),new Set());
  if(instances.length!==1)throw Error('Expected one mesh instance');
  const instance=instances[0],primitives=doc.meshes[instance.mesh].primitives;
  if(primitives.length!==1)throw Error('Expected one material primitive');
  const primitive=primitives[0];
  if((primitive.mode??4)!==4||primitive.targets||Object.keys(primitive.attributes).some(k=>!['POSITION','NORMAL','TEXCOORD_0'].includes(k)))throw Error('Unsupported primitive attributes');
  const position=editor.read(primitive.attributes.POSITION),normal=editor.read(primitive.attributes.NORMAL),uv=editor.read(primitive.attributes.TEXCOORD_0);
  const normalMatrix=new Matrix3().getNormalMatrix(instance.matrix);
  const vertices:Vertex[]=position.map((p,i)=>({position:new Vector3(...p).applyMatrix4(instance.matrix).toArray(),
    normal:new Vector3(...normal[i]).applyMatrix3(normalMatrix).normalize().toArray(),uv:uv[i] as [number,number]}));
  const material=doc.materials[primitive.material],texture=doc.textures[material.pbrMetallicRoughness.baseColorTexture.index],image=doc.images[texture.source];
  if(image.uri||!['image/jpeg','image/png'].includes(image.mimeType))throw Error('Expected embedded PNG/JPEG texture');
  const view=editor.doc.bufferViews[image.bufferView];
  return {mesh:{vertices,indices:editor.read(primitive.indices).flat()},material:structuredClone(material),
    image:editor.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),mimeType:image.mimeType,sampler:doc.samplers?.[texture.sampler??0]};
}

export function transformMesh(mesh:MeshData,scale:number,yaw:number,offset:[number,number,number]):MeshData {
  if(!Number.isFinite(scale)||scale<=0||![yaw,...offset].every(Number.isFinite))throw Error('Invalid head transform');
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
  return {indices:mesh.indices,vertices:mesh.vertices.map(v=>({uv:v.uv,
    position:new Vector3(...v.position).applyQuaternion(rotation).multiplyScalar(scale).add(new Vector3(...offset)).toArray(),
    normal:new Vector3(...v.normal).applyQuaternion(rotation).toArray()}))};
}

export function writeStaticGlb(parts:{name:string;mesh:MeshData;texture:number}[],textures:TexturedMesh[],extras:Record<string,unknown>={}):Buffer {
  const binary:Buffer[]=[],bufferViews:Record<string,number>[]=[],accessors:Record<string,unknown>[]=[];
  let length=0;
  const addBuffer=(bytes:Uint8Array,target?:number)=>{
    const result=bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,...(target?{target}:{})})-1;
    const padded=Buffer.alloc(Math.ceil(bytes.length/4)*4);padded.set(bytes);binary.push(padded);length+=padded.length;return result;
  };
  const attribute=(rows:number[][],type:'VEC2'|'VEC3'|'SCALAR',componentType:5126|5125)=>{
    const width=type==='VEC2'?2:type==='VEC3'?3:1;
    if(!rows.length||rows.some(row=>row.length!==width||row.some(n=>!Number.isFinite(n))))throw Error('Invalid output attribute');
    const bytes=Buffer.alloc(rows.length*width*4);
    rows.forEach((row,i)=>row.forEach((n,j)=>componentType===5126?bytes.writeFloatLE(n,(i*width+j)*4):bytes.writeUInt32LE(n,(i*width+j)*4)));
    const bufferView=addBuffer(bytes,componentType===5125?34963:34962);
    const bounds=type==='VEC3'?{min:[0,1,2].map(i=>Math.min(...rows.map(r=>r[i]))),max:[0,1,2].map(i=>Math.max(...rows.map(r=>r[i])))}:{};
    return accessors.push({bufferView,componentType,count:rows.length,type,...bounds})-1;
  };
  const meshes=parts.map(part=>({name:part.name,primitives:[{mode:4,material:part.texture,
    attributes:{POSITION:attribute(part.mesh.vertices.map(v=>v.position),'VEC3',5126),NORMAL:attribute(part.mesh.vertices.map(v=>v.normal),'VEC3',5126),TEXCOORD_0:attribute(part.mesh.vertices.map(v=>v.uv),'VEC2',5126)},
    indices:attribute(part.mesh.indices.map(i=>[i]),'SCALAR',5125)}]}));
  const images=textures.map(t=>({bufferView:addBuffer(t.image),mimeType:t.mimeType}));
  const materials=textures.map((t,i)=>{const material=structuredClone(t.material);material.pbrMetallicRoughness.baseColorTexture.index=i;return material;});
  const doc={asset:{version:'2.0',generator:'modeling-playground / local modular head proof of concept'},scene:0,
    scenes:[{nodes:parts.map((_,i)=>i)}],nodes:parts.map((p,i)=>({name:p.name,mesh:i})),meshes,materials,images,
    samplers:textures.map(t=>t.sampler??{}),textures:textures.map((_,i)=>({source:i,sampler:i})),accessors,bufferViews,buffers:[{byteLength:length}],extras};
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
  const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  binHeader.writeUInt32LE(length,0);binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,json,binHeader,...binary]);
}
