import { Bone, Group, Skeleton, SkinnedMesh, Uint16BufferAttribute, Float32BufferAttribute } from 'three';
import { validateAssetSpec } from '../contracts/asset.mjs';

export function createRig(spec,name=spec.id) {
  validateAssetSpec(spec);
  const root=new Group();root.name=name;
  const bones=Object.create(null);
  for(const definition of spec.rig.bones) {
    const bone=new Bone();bone.name=definition.name;bone.position.set(...definition.position);
    (definition.parent===null?root:bones[definition.parent]).add(bone);
    bones[bone.name]=bone;
  }
  for(const definition of spec.sockets) {
    const socket=new Group();socket.name=definition.node;socket.position.set(...definition.position);
    socket.userData.socketId=definition.id;
    bones[definition.bone].add(socket);
  }
  return {root,bones};
}

/** Bake root-local geometry and rigid weights. Each metal part follows one bone. */
export function skinRigidParts(root,bones) {
  root.updateMatrixWorld(true);
  const inverseRoot=root.matrixWorld.clone().invert();
  const ordered=Object.values(bones),skeleton=new Skeleton(ordered),parts=[];
  root.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)parts.push(o);});
  for(const part of parts) {
    let owner=part.parent;while(owner&&!owner.isBone)owner=owner.parent;
    const index=ordered.indexOf(owner);
    if(index<0)throw new Error(`Rigid part ${part.name} has no rig bone`);
    const geometry=part.geometry.clone().applyMatrix4(inverseRoot.clone().multiply(part.matrixWorld));
    const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
    geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
    const skin=new SkinnedMesh(geometry,part.material);skin.name=part.name;
    skin.userData={...part.userData,joint:owner.name};
    root.add(skin);skin.bind(skeleton);skin.frustumCulled=false;
    part.removeFromParent();part.geometry.dispose();
  }
  return skeleton;
}
