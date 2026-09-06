import { Group } from 'three';
import { BASTION_SLOTS, DEFAULT_LOADOUT, validateLoadout } from './bastion-definition.mjs';
import { createBastionPart } from './bastion-parts.mjs';
import { disposeModel } from '../modeling/resources.mjs';

export function createBastion(loadout=DEFAULT_LOADOUT) {
  const selection=validateLoadout(loadout),root=new Group();root.name='BASTION-06';
  root.userData={modelId:'bastion',assemblyVersion:1,groundLevel:0,loadout:selection};
  for(const slot of BASTION_SLOTS) {
    const mount=new Group();mount.name='Mount_'+slot.id;mount.position.set(...slot.position);
    mount.userData={slot:slot.id,interface:'bastion-v1',focusTarget:true};
    mount.add(createBastionPart(slot.id,selection[slot.id]));root.add(mount);
  }
  root.updateMatrixWorld(true);return root;
}

export function findBastion(scene) {
  let found=null;scene.traverse(node=>{if(node.userData.modelId==='bastion' && node.userData.assemblyVersion===1)found=node;});
  return found;
}

export function replaceBastionPart(root,slot,id) {
  const next=validateLoadout({...root.userData.loadout,[slot]:id});
  const mount=root.getObjectByName('Mount_'+slot);
  if(!mount || mount.userData.interface!=='bastion-v1')throw new Error(`Missing compatible mount: ${slot}`);
  const replacement=createBastionPart(slot,id),previous=[...mount.children];
  mount.clear();mount.add(replacement);root.userData.loadout=next;root.updateMatrixWorld(true);
  for(const part of previous)disposeModel(part);
  return replacement;
}
