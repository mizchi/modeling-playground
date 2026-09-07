import { ExpressionAtlas } from '../runtime/expression-atlas.mjs';

export function createExpressionPanel(invalidate) {
  const panel=document.getElementById('expression-panel'),select=document.getElementById('expression-select'),demo=document.getElementById('expression-demo');
  let controller=null,time=0;
  select.addEventListener('change',()=>{controller?.set(select.value);demo.checked=false;invalidate();});
  demo.addEventListener('change',()=>{time=0;invalidate();});
  return {
    setModel(root) {
      let face;root?.traverse(n=>{if(n.isMesh&&n.userData.expressionAtlas)face=n;});
      controller=face?new ExpressionAtlas(face):null;time=0;demo.checked=false;
      panel.hidden=!controller;select.replaceChildren();
      const labels={Neutral:'通常',Happy:'笑顔',Angry:'怒り',Surprised:'驚き',Blink:'まばたき',Wink:'ウインク'};
      for(const name of controller?.names??[])select.add(new Option(labels[name]??name,name));
      if(controller)select.value=controller.name;
    },
    get playing(){return Boolean(controller&&demo.checked);},
    update(delta) {
      if(!controller||!demo.checked)return;
      time+=delta;
      if(time>=1) {
        time%=1;const next=(controller.names.indexOf(controller.name)+1)%controller.names.length;
        controller.set(controller.names[next]);select.value=controller.name;
      }
    },
  };
}
