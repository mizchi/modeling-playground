import { isMesh, isSkinnedMesh } from '../modeling/scene-objects.ts';
import type { Object3D, Mesh, MeshStandardMaterial } from 'three';
import { BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, Vector3 } from 'three';

function createQuadWire(mesh: Mesh) {
  const data=mesh.userData.quadTopology,position=mesh.geometry.attributes.position;
  if(data?.version!==1||data.vertexCount!==position.count||!Array.isArray(data.faces)||data.faces.length>position.count*4)return null;
  const edges=new Map<string,number[]>();
  for(const face of data.faces) {
    if(!Array.isArray(face)||![3,4].includes(face.length)||face.some(v=>!Number.isInteger(v)||v<0||v>=position.count))return null;
    face.forEach((v,k)=>{const pair=[v,face[(k+1)%face.length]].sort((a,b)=>a-b);edges.set(pair.join(':'),pair);});
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(position.count*3),3));geometry.setIndex([...edges.values()].flat());
  const wire=new LineSegments(geometry,new LineBasicMaterial({color:'#34434e',toneMapped:false}));
  wire.name='AuthoringEdges';wire.userData.authoringEdges=true;wire.frustumCulled=false;wire.raycast=()=>{};
  mesh.add(wire);return wire;
}

/** Preserve existing triangle wire behavior on assets without authoring topology. */
export function setModelWireframe(root: Object3D,enabled: boolean) {
  const meshes: Mesh[]=[];root.traverse(n=>{if(isMesh(n))meshes.push(n);});
  for(const mesh of meshes) {
    const wire=mesh.children.find(n=>n.userData.authoringEdges)??(enabled?createQuadWire(mesh):null);
    for(const material of [mesh.material].flat()) {
      (material as MeshStandardMaterial).wireframe=enabled&&!wire;
      if(wire){material.polygonOffset=enabled;material.polygonOffsetFactor=1;material.polygonOffsetUnits=1;}
    }
    if(wire)wire.visible=enabled;
  }
  updateQuadWires(root);
}

export function updateQuadWires(root: Object3D | null | undefined) {
  if(!root)return;
  const meshes: Mesh[]=[];root.traverse(n=>{if(isMesh(n)&&n.children.some(c=>c.userData.authoringEdges&&c.visible))meshes.push(n);});
  if(!meshes.length)return;
  root.updateMatrixWorld(true);const p=new Vector3();
  for(const mesh of meshes) {
    const output=(mesh.children.find(c=>c.userData.authoringEdges) as LineSegments).geometry.attributes.position,source=mesh.geometry.attributes.position;
    for(let i=0;i<source.count;i++){p.fromBufferAttribute(source,i);if(isSkinnedMesh(mesh))mesh.applyBoneTransform(i,p);output.setXYZ(i,p.x,p.y,p.z);}
    output.needsUpdate=true;
  }
}
