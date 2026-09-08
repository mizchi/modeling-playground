import { isSkinnedMesh } from '../modeling/scene-objects.ts';
import { Quaternion } from 'three';
import { validateHairDynamics } from '../contracts/hair.ts';
import type { Bone, SkinnedMesh } from 'three';
import type { HairDynamics, HairChain } from '../contracts/hair.ts';

/** Bone adapter only: a spring/physics solver supplies local rotation offsets. */
export class HairRig {
  spec: HairDynamics;
  bones: Map<string, Bone>;
  chains: HairChain[];
  rest: Map<string, Quaternion>;
  constructor(mesh: SkinnedMesh) {
    if(!isSkinnedMesh(mesh))throw new Error('Hair must be a skinned mesh');
    this.spec=validateHairDynamics(mesh.userData.hairDynamics);
    this.bones=new Map(mesh.skeleton.bones.map(b=>[b.name,b]));
    if(!this.bones.has(this.spec.anchor))throw new Error('Missing hair anchor');
    this.chains=this.spec.chains;this.rest=new Map();
    for(const c of this.chains)c.joints.forEach((name,i)=>{
      const bone=this.bones.get(name);
      if(!bone||bone.parent!==this.bones.get(i?c.joints[i-1]:this.spec.anchor))throw new Error('Invalid hair joint hierarchy');
      this.rest.set(name,bone.quaternion.clone());
    });
  }
  setJoint(id: string,index: number,rotation: Quaternion) {
    const chain=this.chains.find(c=>c.id===id);
    if(!chain)throw new Error('Unknown hair chain');
    if(index===0)throw new Error('Hair root is pinned');
    if(!Number.isInteger(index)||index<1||index>=chain.joints.length)throw new Error('Unknown hair joint');
    if(!rotation?.isQuaternion||![rotation.x,rotation.y,rotation.z,rotation.w].every(Number.isFinite)||rotation.lengthSq()<1e-12)
      throw new Error('Invalid hair quaternion');
    const q=rotation.clone().normalize();
    if(q.angleTo(new Quaternion())>chain.maxAngle+1e-6)throw new Error('Hair joint exceeds angle limit');
    const name=chain.joints[index];this.bones.get(name)!.quaternion.copy(this.rest.get(name)!).multiply(q);
  }
  reset(){for(const [name,q] of this.rest)this.bones.get(name)!.quaternion.copy(q);}
}
