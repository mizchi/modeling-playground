import { BASTION_SLOTS, DEFAULT_LOADOUT, validateLoadout } from '../models/bastion-definition.mjs';
import { findBastion, replaceBastionPart } from '../models/bastion.mjs';

/** DOM adapter only: geometry and loadout state live in the model layer. */
export function createAssemblyPanel(onChange) {
  const $=id=>document.getElementById(id),fields=$('assembly-fields'),panel=$('assembly-panel');
  let root=null;
  function sync() {
    for(const slot of BASTION_SLOTS)$('part-'+slot.id).value=root.userData.loadout[slot.id];
  }
  for(const slot of BASTION_SLOTS) {
    const label=document.createElement('label');label.htmlFor='part-'+slot.id;label.textContent=slot.label;
    const select=document.createElement('select');select.id=label.htmlFor;
    for(const part of slot.options)select.add(new Option(part.label,part.id));
    select.addEventListener('change',()=>{
      if(!root)return;
      try {
        replaceBastionPart(root,slot.id,select.value);onChange();
        $('assembly-status').textContent=`${slot.label}を交換しました。未保存`;
      } catch(error){sync();$('assembly-status').textContent=error.message;}
    });
    fields.append(label,select);
  }
  $('assembly-reset').addEventListener('click',()=>{
    if(!root)return;
    for(const slot of BASTION_SLOTS)if(root.userData.loadout[slot.id]!==DEFAULT_LOADOUT[slot.id])replaceBastionPart(root,slot.id,DEFAULT_LOADOUT[slot.id]);
    sync();onChange();$('assembly-status').textContent='標準構成に戻しました。';
  });
  $('assembly-export').addEventListener('click',async()=>{
    if(!root)return;
    const source=root,button=$('assembly-export');button.disabled=true;
    // Lock assembly edits while the exporter reads geometry and embedded maps.
    fields.inert=true;$('assembly-reset').disabled=true;
    try {
      const { GLTFExporter }=await import('three/addons/exporters/GLTFExporter.js');
      if(source!==root)return;
      const data=await new GLTFExporter().parseAsync(source,{binary:true});
      const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));
      const link=document.createElement('a');link.href=url;link.download='bastion-custom.glb';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),10_000);
      if(source===root)$('assembly-status').textContent='現在の構成をGLBに書き出しました。';
    } catch(error){if(source===root)$('assembly-status').textContent=`保存できませんでした：${error.message}`;}
    finally{button.disabled=false;fields.inert=false;$('assembly-reset').disabled=false;}
  });
  return {
    setModel(model) {
      root=findBastion(model);
      if(root)try {
        validateLoadout(root.userData.loadout);
        for(const slot of BASTION_SLOTS)if(root.getObjectByName('Mount_'+slot.id)?.userData.interface!=='bastion-v1')throw new Error('Missing mount');
      } catch {root=null;}
      panel.hidden=!root;
      if(root){sync();$('assembly-status').textContent='標準接続規格：BASTION v1';}
    },
  };
}
