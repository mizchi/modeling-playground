import { Matrix4, Quaternion, Vector3 } from 'three';
import { validateAssetSpec } from '../contracts/asset.mjs';
import { activeWindows } from './timeline.mjs';

/** Bind immutable authoring data to a loaded rig. No DOM, rendering or game rules. */
export function bindAsset(root,clips,definition) {
  const spec=validateAssetSpec(structuredClone(definition));
  const nodes=new Map();
  root.updateMatrixWorld(true);
  root.traverse(node=>{
    if(!nodes.has(node.name))nodes.set(node.name,[]);
    nodes.get(node.name).push(node);
  });
  const owners=[];
  root.traverse(node=>{if(node.userData.assetId)owners.push(node);});
  if(owners.length!==1||owners[0].userData.assetId!==spec.id||owners[0].userData.assetVersion!==spec.version)throw new Error('Asset identity/version mismatch');
  const find=(name,kind)=>{
    const matches=nodes.get(name)??[];
    if(matches.length!==1)throw new Error(`Asset ${kind} ${name}: expected one matching node`);
    return matches[0];
  };
  const bones=new Map(spec.rig.bones.map(b=>{
    const node=find(b.name,'bone');
    if(!node.isBone||(node.parent?.isBone?node.parent.name:null)!==b.parent)throw new Error(`Asset bone hierarchy: ${b.name}`);
    if(node.position.distanceTo(new Vector3(...b.position))>1e-5)throw new Error(`Asset bone rest position: ${b.name}`);
    if(node.quaternion.angleTo(new Quaternion())>1e-5||node.scale.distanceTo(new Vector3(1,1,1))>1e-5)throw new Error(`Asset bone rest orientation/scale: ${b.name}`);
    return [b.name,node];
  }));
  const sockets=new Map(spec.sockets.map(s=>{
    const node=find(s.node,'socket');
    if(node.parent!==bones.get(s.bone)||node.position.distanceTo(new Vector3(...s.position))>1e-5)throw new Error(`Asset socket transform: ${s.id}`);
    if(node.quaternion.angleTo(new Quaternion())>1e-5||node.scale.distanceTo(new Vector3(1,1,1))>1e-5)throw new Error(`Asset socket orientation/scale: ${s.id}`);
    return [s.id,node];
  }));
  if(clips.length!==spec.clips.length)throw new Error('Asset clip count mismatch');
  for(const c of spec.clips) {
    const matching=clips.filter(clip=>clip.name===c.name);
    if(matching.length!==1||Math.abs(matching[0].duration-c.duration)>1e-5)throw new Error(`Asset clip duration/name mismatch: ${c.name}`);
  }
  const socketPosition=id=>sockets.get(id).getWorldPosition(new Vector3());
  return {
    modes:Object.fromEntries(spec.clips.map(c=>[c.name,c.mode])),
    /** Call after animation/IK updates. Returned world-space snapshots are owned by the caller. */
    sample(clipName,time) {
      const clip=spec.clips.find(c=>c.name===clipName);
      if(!clip)throw new Error(`Unknown asset clip: ${clipName}`);
      const windows=activeWindows(clip,time),active=(kind,id)=>windows.some(w=>w.kind===kind&&w.id===id);
      root.updateMatrixWorld(true);
      return {
        colliders:spec.colliders.map(c=>({id:c.id,shape:c.shape,halfExtents:new Vector3(...c.halfExtents),
          matrix:bones.get(c.bone).matrixWorld.clone().multiply(new Matrix4().makeTranslation(...c.center))})),
        attacks:spec.attacks.map(a=>({id:a.id,active:active('attack',a.id),from:socketPosition(a.from),to:socketPosition(a.to),
          // Conservative sphere radius under scaled parents; endpoints include the full transform.
          radius:a.radius*Math.max(...sockets.get(a.from).getWorldScale(new Vector3()).toArray().map(Math.abs))})),
        emitters:spec.emitters.map(e=>({...e,active:active('emitter',e.id),position:socketPosition(e.socket),
          direction:new Vector3(...e.direction).transformDirection(sockets.get(e.socket).matrixWorld)})),
      };
    },
  };
}
