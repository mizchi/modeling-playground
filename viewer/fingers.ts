import type {Object3D} from 'three';
import {FingerPose} from '../runtime/finger-pose.ts';
import {fingerNames,handSides} from '../contracts/fingers.ts';
import type {FingerName} from '../contracts/fingers.ts';

export function createFingerPanel(invalidate:()=>void){
  const panel=document.getElementById('finger-panel');
  if(!panel)throw Error('Missing finger panel');
  let pose:FingerPose|null=null;
  const labels:Record<FingerName,string>={Thumb:'親指',Index:'人差し指',Middle:'中指',Ring:'薬指',Little:'小指'};
  return {
    setModel(root:Object3D){
      pose=FingerPose.fromModel(root);panel.hidden=!pose;panel.replaceChildren();
      if(!pose)return;
      const heading=document.createElement('h2');heading.textContent='指のポーズ';panel.append(heading);
      const help=document.createElement('p');help.className='intro';help.textContent='緩める ← 0：軽く握る → 曲げる。表示中の調整のみで、GLBには保存しません。';panel.append(help);
      for(const side of handSides){
        const title=document.createElement('h3');title.textContent=side==='Left'?'左手':'右手';panel.append(title);
        for(const finger of fingerNames){
          const input=document.createElement('input'),label=document.createElement('label'),output=document.createElement('output');
          input.id=`finger-${side}-${finger}`;input.type='range';input.min='-100';input.max='100';input.step='1';input.value='0';
          input.setAttribute('aria-label',`${title.textContent}の${labels[finger]}`);
          label.htmlFor=input.id;label.className='range-label';label.textContent=labels[finger];output.textContent='0';label.append(output);
          input.addEventListener('input',()=>{pose?.set(side,finger,Number(input.value)/100);output.textContent=input.value;invalidate();});
          panel.append(label,input);
        }
      }
      const reset=document.createElement('button');reset.textContent='指を標準に戻す';reset.id='finger-reset';
      reset.addEventListener('click',()=>{pose?.reset();panel.querySelectorAll('input').forEach(i=>i.value='0');panel.querySelectorAll('output').forEach(o=>o.textContent='0');invalidate();});panel.append(reset);
    },
    update(){pose?.apply();},
  };
}
