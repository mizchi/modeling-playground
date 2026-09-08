import {Matrix4,Quaternion,Vector3} from 'three';
import {GlbEditor} from './glb-editor.ts';
import {fingerDefinitions,fingerInfluences} from './finger-profile.ts';
import {relaxHandPoint} from './relax-hands.ts';
import type {FingerBoneMetadata} from '../../../../contracts/fingers.ts';

/** Add finger chains to the relaxed mesh using the corresponding original mesh for weight assignment. */
export function addFingerRig(original:Uint8Array,relaxed:Uint8Array):Buffer{
  const source=new GlbEditor(original),edit=new GlbEditor(relaxed),{doc}=edit;
  if(doc.extras?.fingerRig)throw Error('Finger rig already applied');
  if(!doc.extras?.relaxedHands||source.doc.extras?.relaxedHands||doc.skins.length!==1||doc.meshes.length!==1)throw Error('Expected original and relaxed v2 pair');
  const skin=doc.skins[0],binds=edit.read(skin.inverseBindMatrices),oldCount=skin.joints.length;
  if(oldCount!==24||JSON.stringify(source.doc.skins)!==JSON.stringify(doc.skins))throw Error('Incompatible v2 skeleton');
  const hands=(['Left','Right'] as const).map(side=>{
    const sign=side==='Left'?1:-1,slot=skin.joints.findIndex(i=>doc.nodes[i].name===`${side}Hand`);
    if(slot<0)throw Error('Missing hand joint');
    const parentBind=new Matrix4().fromArray(binds[slot]).invert(),wrist=new Vector3().setFromMatrixPosition(parentBind);
    if(wrist.x*sign<.50||wrist.x*sign>.55||wrist.y<1.12||wrist.y>1.18)throw Error('Unsupported hand calibration');
    const slots=new Map<string,number[]>();
    for(const finger of fingerDefinitions){
      let parent=skin.joints[slot],parentMatrix=parentBind;
      const chain:number[]=[];
      const points=finger.points.map(p=>{const q=relaxHandPoint(p);return new Vector3(wrist.x+q[0]*sign,wrist.y+q[1],wrist.z+q[2]);});
      for(const joint of [0,1,2] as const){
        const y=points[joint+1].clone().sub(points[joint]).normalize();
        const x=y.clone().cross(new Vector3(0,0,sign)).normalize(),z=x.clone().cross(y).normalize();
        const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
        const world=new Matrix4().compose(points[joint],rotation,new Vector3(.01,.01,.01));
        const local=parentMatrix.clone().invert().multiply(world),translation=new Vector3(),q=new Quaternion(),scale=new Vector3();
        local.decompose(translation,q,scale);
        const metadata:FingerBoneMetadata={version:1,side,finger:finger.name,joint,restRotation:q.toArray()};
        const node=doc.nodes.push({name:`${side}Hand${finger.name}${joint+1}`,translation:translation.toArray(),rotation:q.toArray(),scale:scale.toArray(),extras:{fingerRig:metadata}})-1;
        (doc.nodes[parent].children??=[]).push(node);
        chain.push(skin.joints.length);skin.joints.push(node);binds.push(world.clone().invert().toArray());
        parent=node;parentMatrix=world;
      }
      // Non-deforming tip makes the last phalanx visible to skeleton viewers and DCC tools.
      const tip=points[3].clone().applyMatrix4(parentMatrix.clone().invert());
      const end=doc.nodes.push({name:`${side}Hand${finger.name}Tip`,translation:tip.toArray()})-1;
      (doc.nodes[parent].children??=[]).push(end);slots.set(finger.name,chain);
    }
    return {sign,slot,wrist,slots};
  });
  let changed=0;
  for(let i=0;i<doc.meshes[0].primitives.length;i++){
    const p=doc.meshes[0].primitives[i],raw=source.doc.meshes[0].primitives[i];
    const positions=source.read(raw.attributes.POSITION),joints=edit.read(p.attributes.JOINTS_0),weights=edit.read(p.attributes.WEIGHTS_0);
    if(positions.length!==joints.length||joints.length!==weights.length)throw Error('Vertex layout mismatch');
    positions.forEach((point,index)=>{
      const hand=hands.find(h=>point[0]*h.sign>h.wrist.x*h.sign+.026&&Math.abs(point[1]-h.wrist.y)<.10&&Math.abs(point[2]-h.wrist.z)<.12);
      if(!hand)return;
      const influence=fingerInfluences([(point[0]-hand.wrist.x)*hand.sign,point[1]-hand.wrist.y,point[2]-hand.wrist.z]);
      if(!influence.length)return;
      const combined=new Map<number,number>();
      const add=(slot:number,value:number)=>combined.set(slot,(combined.get(slot)??0)+value);
      joints[index].forEach((slot,j)=>{
        if(slot!==hand.slot)add(slot,weights[index][j]);
        else influence.forEach(w=>add(w.finger===null?hand.slot:hand.slots.get(w.finger)![w.joint],weights[index][j]*w.weight));
      });
      const sorted=[...combined].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,[,w])=>s+w,0);
      if(sum<=0)throw Error('Empty skin weights');
      joints[index]=[0,1,2,3].map(i=>sorted[i]?.[0]??0);weights[index]=[0,1,2,3].map(i=>(sorted[i]?.[1]??0)/sum);changed++;
    });
    p.attributes.JOINTS_0=edit.append(joints,'VEC4',5123);p.attributes.WEIGHTS_0=edit.append(weights,'VEC4');
  }
  if(changed<50)throw Error('No valid finger weights');
  skin.inverseBindMatrices=edit.append(binds,'MAT4');
  doc.extras={...doc.extras,fingerRig:{version:1,addedJoints:30,changedVertices:changed,neutral:'relaxed',axis:'local -Z curls'}};
  return edit.finish();
}
