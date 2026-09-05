import { Euler, Quaternion, Vector3 } from 'three';

/** Analytic two-bone IK. Out-of-reach targets are clamped, never stretched. */
export function solveTwoBone(start, target, pole, upperLength, lowerLength) {
  const delta=target.clone().sub(start);
  const requested=delta.length();
  const low=Math.abs(upperLength-lowerLength)+1e-7;
  const high=upperLength+lowerLength-1e-7;
  const distance=Math.max(low,Math.min(high,requested));
  const direction=requested>1e-8 ? delta.divideScalar(requested) : new Vector3(0,-1,0);
  let bend=pole.clone().sub(start).addScaledVector(direction,-pole.clone().sub(start).dot(direction));
  if (bend.lengthSq()<1e-10) {
    bend=Math.abs(direction.x)<.8 ? new Vector3(1,0,0) : new Vector3(0,0,1);
    bend.addScaledVector(direction,-bend.dot(direction));
  }
  bend.normalize();
  const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const height=Math.sqrt(Math.max(0,upperLength**2-along**2));
  return { joint:start.clone().addScaledVector(direction,along).addScaledVector(bend,height),
    end:start.clone().addScaledVector(direction,distance), clamped:Math.abs(distance-requested)>1e-6 };
}

const position=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion());
function setWorldRotation(bone,quaternion) {
  bone.quaternion.copy(rotation(bone.parent).invert().multiply(quaternion));
  bone.updateMatrixWorld(true);
}

export class IKPose {
  static fromModel(model) {
    let owner;
    model.traverse(object=>{ if(object.userData.ikRig) owner=object; });
    if(!owner) return null;
    let spec;
    try {spec=JSON.parse(owner.userData.ikRig);} catch {return null;}
    if(!spec || spec.version!==1 || spec.coordinateSystem!=='gltf-y-up' || typeof spec.hips!=='string' || !Array.isArray(spec.chains) || !spec.chains.length || spec.chains.length>16) return null;
    const ids=new Set(['hips']);
    for(const chain of spec.chains) {
      if(!chain || !['id','label','upper','lower','end'].every(key=>typeof chain[key]==='string' && chain[key].length>0)
        || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(chain.id) || !Array.isArray(chain.pole) || chain.pole.length!==3
        || !chain.pole.every(Number.isFinite) || ids.has(chain.id) || ids.has(chain.id+'Pole')) return null;
      ids.add(chain.id);ids.add(chain.id+'Pole');
    }
    try { return new IKPose(model,owner,spec); } catch { return null; }
  }
  constructor(model,owner,spec) {
    this.model=model;
    this.bones=Object.create(null);
    model.updateMatrixWorld(true);
    model.traverse(object=>{if(object.isBone)this.bones[object.name]=object;});
    this.hips=this.bones[spec.hips];
    if(!this.hips) throw new Error('IKの腰ボーンがありません。');
    this.rest=new Map(Object.values(this.bones).map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
    this.targets=Object.assign(Object.create(null),{hips:position(this.hips)});
    this.chains=spec.chains.map(item=>{
      const upper=this.bones[item.upper],lower=this.bones[item.lower],end=this.bones[item.end];
      if(!upper || !lower || !end || lower.parent!==upper || end.parent!==lower) throw new Error('IKのボーン階層が一致しません。');
      this.targets[item.id]=position(end);
      this.targets[item.id+'Pole']=owner.localToWorld(new Vector3(...item.pole));
      const upperLength=position(upper).distanceTo(position(lower)),lowerLength=position(lower).distanceTo(position(end));
      if(upperLength<1e-5 || lowerLength<1e-5) throw new Error('IKには長さのあるボーンが必要です。');
      return {...item,upper,lower,end,upperLength,lowerLength,endOrientation:rotation(end)};
    });
    this.initial=Object.fromEntries(Object.entries(this.targets).map(([id,p])=>[id,p.clone()]));
    this.fk=Object.create(null);
    this.mode='IK';
    this.errors={};
  }
  restore() {
    for(const [bone,rest] of this.rest) {
      bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);
    }
    this.model.updateMatrixWorld(true);
  }
  solve() {
    this.restore();
    this.errors={};
    if(this.mode==='FK') {
      for(const [name,angles] of Object.entries(this.fk)) {
        this.bones[name]?.quaternion.multiply(new Quaternion().setFromEuler(new Euler(...angles)));
      }
      this.model.updateMatrixWorld(true);
      return;
    }
    this.hips.position.copy(this.hips.parent.worldToLocal(this.targets.hips.clone()));
    this.model.updateMatrixWorld(true);
    for(const chain of this.chains) {
      const start=position(chain.upper);
      const result=solveTwoBone(start,this.targets[chain.id],this.targets[chain.id+'Pole'],chain.upperLength,chain.lowerLength);
      const upperDirection=position(chain.lower).sub(start).normalize();
      const desiredUpper=result.joint.clone().sub(start).normalize();
      const delta=new Quaternion().setFromUnitVectors(upperDirection,desiredUpper);
      setWorldRotation(chain.upper,delta.multiply(rotation(chain.upper)));
      const current=position(chain.end).sub(position(chain.lower)).normalize();
      const desired=result.end.clone().sub(result.joint).normalize();
      setWorldRotation(chain.lower,new Quaternion().setFromUnitVectors(current,desired).multiply(rotation(chain.lower)));
      setWorldRotation(chain.end,chain.endOrientation);
      this.errors[chain.id]=position(chain.end).distanceTo(this.targets[chain.id]);
    }
    this.model.updateMatrixWorld(true);
  }
  reset() {
    for(const [id,p] of Object.entries(this.initial))this.targets[id].copy(p);
    this.fk=Object.create(null);this.mode='IK';this.solve();
  }
}
