import {SPEC,DIRECTIONS,PALETTE,PROPORTIONS,getRig,artifactNames,sampleWalk,renderFrame,project,toRgba} from './walk.mjs';
const assets=import.meta.glob('../output/sprite-walk*.{png,json}',{query:'?url',import:'default',eager:true});

const $=id=>document.getElementById(id);
const state={playing:true,frame:0,ticks:0,speed:1,direction:'w',proportion:'4head',colored:true,bones:false,ground:true};
const stage=$('stage'),ctx=stage.getContext('2d'),strip=$('strip'),stripCtx=strip.getContext('2d');
const tile=document.createElement('canvas');tile.width=32;tile.height=48;
const tileCtx=tile.getContext('2d'),cache=new Map();
const comparisons=['8head','4head','3head','2head'].map(id=>({id,canvas:$(`compare-${id}`),ctx:$(`compare-${id}`).getContext('2d')}));

for(const d of DIRECTIONS) $('direction').add(new Option(d.label,d.id));
$('direction').value=state.direction;
for(const profile of PROPORTIONS) $('proportion').add(new Option(profile.label,profile.id));
$('proportion').value=state.proportion;

function selectProportion(id) {
  getRig(id);state.proportion=id;$('proportion').value=id;
  const paths=artifactNames(id);
  for(const key of ['debug','neutral','metadata']) $(key+'-download').href=assets['../output/'+paths[key]];
  $('export-proportion').textContent=getRig(id).label;
  $('head-mode').textContent=getRig(id).pixelHead?'頭部：固定4×5pxの形状＋外輪郭。3Dの頭位置に追従し、コマごとの縮小・拡大はしません。':'頭部：3D形状を論理ピクセルへ投影。';
  document.querySelectorAll('[data-proportion]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.proportion===id)));
  draw();
}

function frameImage(frame,proportion=state.proportion) {
  const key=`${proportion}/${state.direction}/${state.colored}/${frame}`;
  if(!cache.has(key)) {
    const rgba=toRgba(renderFrame(frame/SPEC.frames,state.direction,{colored:state.colored,proportion}));
    cache.set(key,new ImageData(new Uint8ClampedArray(rgba.data),rgba.width,rgba.height));
  }
  return cache.get(key);
}
const color=index=>`rgb(${PALETTE[index].slice(0,3).join(',')})`;

function line(a,b,index) {
  let x=Math.round(a[0]),y=Math.round(a[1]);
  const tx=Math.round(b[0]),ty=Math.round(b[1]),dx=Math.abs(tx-x),dy=-Math.abs(ty-y);
  const sx=x<tx?1:-1,sy=y<ty?1:-1;let error=dx+dy;ctx.fillStyle=color(index);
  for(;;) {
    ctx.fillRect(x+48,y+8,1,1);if(x===tx&&y===ty)break;
    const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}
  }
}

function draw() {
  ctx.fillStyle='#111b22';ctx.fillRect(0,0,128,64);
  const phase=state.frame/SPEC.frames,rig=getRig(state.proportion),pose=sampleWalk(phase,state.proportion);
  if(state.ground) {
    ctx.fillStyle='#344750';
    const travel=state.ticks/SPEC.frames*rig.travelPerCycle,spacing=.20;
    const center=Math.floor(travel/spacing);
    for(let iz=center-16;iz<=center+16;iz++) for(let ix=-3;ix<=3;ix++) {
      const p=project([ix*spacing,0,iz*spacing-travel],state.direction);
      ctx.fillRect(Math.round(p[0])+48,Math.round(p[1])+8,1,1);
    }
  }
  tileCtx.putImageData(frameImage(state.frame),0,0);ctx.drawImage(tile,48,8);
  for(const [side,index] of [['left',7],['right',10]]) {
    const limb=pose[side];
    if(limb.contact) {
      const p=project([limb.ankle[0],0,limb.ankle[2]+.055*rig.bodyScale],state.direction);
      ctx.fillStyle=color(index);ctx.fillRect(Math.round(p[0])+47,Math.round(p[1])+9,3,1);
    }
    if(state.bones) for(const [a,b] of [['hip','knee'],['knee','ankle'],['shoulder','elbow'],['elbow','wrist']]) {
      line(project(limb[a],state.direction),project(limb[b],state.direction),15);
    }
  }
  // The strip is a presentation overlay; exported atlas pixels remain untouched.
  stripCtx.fillStyle='#111b22';stripCtx.fillRect(0,0,256,48);
  for(let f=0;f<SPEC.frames;f++) {
    tileCtx.putImageData(frameImage(f),0,0);stripCtx.drawImage(tile,f*32,0);
    if(f===state.frame){stripCtx.fillStyle='#94d2c8';stripCtx.fillRect(f*32,47,32,1);}
  }
  for(const comparison of comparisons) {
    comparison.ctx.fillStyle='#111b22';comparison.ctx.fillRect(0,0,32,48);
    tileCtx.putImageData(frameImage(state.frame,comparison.id),0,0);
    comparison.ctx.drawImage(tile,0,0);
    comparison.canvas.dataset.frame=String(state.frame);comparison.canvas.dataset.direction=state.direction;
  }
  $('frame').value=state.frame;$('frame-label').textContent=`${state.frame+1} / ${SPEC.frames}`;
  $('ratio').textContent=`1 / ${Number(rig.heads.toFixed(2))}`;
  $('stride-length').textContent=`${rig.stride.toFixed(3)} m`;
  $('contact').textContent=`左：${pose.left.contact?'接地':'遊脚'} / 右：${pose.right.contact?'接地':'遊脚'}`;
  stage.dataset.frame=String(state.frame);stage.dataset.direction=state.direction;stage.dataset.proportion=state.proportion;
}

function pause() {state.playing=false;$('play').textContent='再生';}
$('play').onclick=()=>{state.playing=!state.playing;$('play').textContent=state.playing?'一時停止':'再生';};
$('step').onclick=()=>{pause();state.ticks++;state.frame=state.ticks%SPEC.frames;draw();};
$('frame').oninput=e=>{pause();state.frame=Number(e.target.value);state.ticks=state.frame;draw();};
$('direction').onchange=e=>{state.direction=e.target.value;draw();};
$('proportion').onchange=e=>selectProportion(e.target.value);
document.querySelectorAll('[data-proportion]').forEach(button=>button.onclick=()=>selectProportion(button.dataset.proportion));
$('speed').onchange=e=>{state.speed=Number(e.target.value);};
for(const name of ['colored','bones','ground']) $(name).onchange=e=>{state[name]=e.target.checked;draw();};
strip.onclick=e=>{
  pause();const rect=strip.getBoundingClientRect();state.frame=Math.min(7,Math.floor((e.clientX-rect.left)/rect.width*8));
  state.ticks=state.frame;draw();
};
function resize() {
  for(const canvas of [stage,strip,...comparisons.map(c=>c.canvas)]) {
    const scale=Math.max(1,Math.min(6,Math.floor(canvas.parentElement.clientWidth/canvas.width)));
    const width=`${canvas.width*scale}px`,height=`${canvas.height*scale}px`;
    if(canvas.style.width!==width) canvas.style.width=width;
    if(canvas.style.height!==height) canvas.style.height=height;
  }
}
// ResizeObserver callbacks must not synchronously resize their own observed tree.
let resizePending=false;
new ResizeObserver(()=>{
  if(resizePending) return;
  resizePending=true;requestAnimationFrame(()=>{resizePending=false;resize();});
}).observe(document.querySelector('main'));resize();selectProportion(state.proportion);
let previous=performance.now(),elapsed=0;
function animate(now) {
  const delta=Math.min(.1,(now-previous)/1000);previous=now;
  if(state.playing) {
    elapsed+=delta*state.speed;
    const duration=SPEC.period/SPEC.frames;
    if(elapsed>=duration) {
      const steps=Math.floor(elapsed/duration);elapsed-=steps*duration;
      state.ticks+=steps;state.frame=state.ticks%SPEC.frames;draw();
    }
  } else elapsed=0;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
