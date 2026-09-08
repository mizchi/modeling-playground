import type { Object3D, Mesh } from 'three';
import { elementLookup } from './dom.ts';
import type { PageElements } from './dom.types.ts';
import { isMesh } from '../modeling/scene-objects.ts';
import { ExpressionAtlas } from '../runtime/expression-atlas.ts';

export function createExpressionPanel(invalidate: ()=>void) {
  const $=elementLookup<PageElements>();
  const panel=$('expression-panel'),select=$('expression-select'),demo=$('expression-demo');
  let controller: ExpressionAtlas | null=null,time=0;
  select.addEventListener('change',()=>{controller?.set(select.value);demo.checked=false;invalidate();});
  demo.addEventListener('change',()=>{time=0;invalidate();});
  return {
    setModel(root: Object3D | null) {
      let face: Mesh | undefined;root?.traverse(n=>{if(isMesh(n)&&n.userData.expressionAtlas)face=n;});
      controller=face?new ExpressionAtlas(face):null;time=0;demo.checked=false;
      panel.hidden=!controller;select.replaceChildren();
      const labels: Record<string,string>={Neutral:'通常',Happy:'笑顔',Angry:'怒り',Surprised:'驚き',Blink:'まばたき',Wink:'ウインク'};
      for(const name of controller?.names??[])select.add(new Option(labels[name]??name,name));
      if(controller)select.value=controller.name;
    },
    get playing(){return Boolean(controller&&demo.checked);},
    update(delta: number) {
      if(!controller||!demo.checked)return;
      time+=delta;
      if(time>=1) {
        time%=1;const next=(controller.names.indexOf(controller.name)+1)%controller.names.length;
        controller.set(controller.names[next]);select.value=controller.name;
      }
    },
  };
}
