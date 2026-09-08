import type { Bone } from 'three';
import type { Object3D, AnimationClip, AnimationAction, Mesh, MeshStandardMaterial } from 'three';
import type { HumanRecipe, HumanModel, HumanShape, HumanBodyShape } from './contract.ts';
import type { HumanElements } from './dom.types.ts';
import { elementLookup, errorMessage } from '../viewer/dom.ts';
import { isMesh, isSkinnedMesh } from '../modeling/scene-objects.ts';
import './viewer.css';
import { Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, GridHelper, Vector3, AnimationMixer, SkeletonHelper, CanvasTexture, SRGBColorSpace, LinearFilter, ACESFilmicToneMapping } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SHAPE_FIELDS, BODY_SHAPE_FIELDS, presetRecipe, validateRecipe, validateRig } from './contract.ts';
import { createHistory } from './state.ts';
import { createHuman, disposeHuman, exportRig } from './model.ts';
import { humanFraming } from './framing.ts';
import { createMotions, fitMotion } from './motion.ts';
import { loadMotionGlb, downloadFile } from './io.ts';
import { setModelWireframe, updateQuadWires } from '../viewer/quad-wire.ts';

const $=elementLookup<HumanElements>(),storageKey='human-viewer.recipe.v1';
function error(e: unknown){$('error').hidden=false;$('error').textContent=errorMessage(e);}
function clearError(){$('error').hidden=true;}
let initial=presetRecipe('lumi');
try{const stored=localStorage.getItem(storageKey);if(stored)initial=validateRecipe(JSON.parse(stored));}catch{error(new Error('保存設定を読み込めなかったため、LUMIで開始します。'));}
const history=createHistory(initial);
type ShapeKey = keyof HumanShape | keyof HumanBodyShape;
const sliderGroups: {section: 'shape' | 'bodyShape'; fields: Record<string,{label:string;min:number;max:number;step:number}>; container:'shape-fields' | 'body-shape-fields'}[]=[{section:'shape',fields:SHAPE_FIELDS,container:'shape-fields'},
  {section:'bodyShape',fields:BODY_SHAPE_FIELDS,container:'body-shape-fields'}];
const scene=new Scene();scene.background=new Color('#e8e9e2');
const camera=new PerspectiveCamera(35,1,.01,100);
let renderer: WebGLRenderer;
try{renderer=new WebGLRenderer({antialias:true});}catch(e){error(new Error('WebGL 2を開始できません。ブラウザのハードウェアアクセラレーションを確認してください。'));throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.domElement.setAttribute('aria-label','人体プレビュー。ドラッグで回転');renderer.domElement.tabIndex=0;$('viewport').append(renderer.domElement);
scene.add(new HemisphereLight(0xffffff,0x82948c,2.6));
const key=new DirectionalLight(0xfff7e8,2.5);key.position.set(2,4,3);scene.add(key);
const fill=new DirectionalLight(0xc7dbef,1.3);fill.position.set(-3,2,-2);scene.add(fill);
const grid=new GridHelper(6,30,0x9ea99f,0xcbd2c6);grid.position.y=-.012;scene.add(grid);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.4;controls.maxDistance=12;
let root: Scene,mixer: AnimationMixer,action: AnimationAction | null,helper: SkeletonHelper,clips: AnimationClip[]=[],imported: AnimationClip[]=[],bitmap: ImageBitmap | null=null,bitmapName='',selected='rest',playing=false,faceFocus=false,currentView='quarter',revision=0;
let framing={body:{target:[0,1.23,0],distance:4.8},face:{target:[0,1.97,0],distance:1.9}};
const views: Record<string,number[]>={front:[0,0,1],quarter:[.8,.12,1],side:[1,0,0],back:[0,0,-1],high:[.8,.8,1],low:[.8,-.65,1]};
function setView(name=currentView) {
  currentView=name;const frame=framing[faceFocus?'face':'body'];controls.target.fromArray(frame.target);
  camera.position.copy(controls.target).add(new Vector3(...views[name]).normalize().multiplyScalar(frame.distance));controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));invalidate();
}
function updateFraming(next: Object3D) {
  const mode=faceFocus?'face':'body',before=framing[mode];
  const updated=humanFraming(next),after=updated[mode];
  // Preserve the user's orbit angle, zoom factor and pan offset while following
  // the edited rest proportions. Changing body height must not reset the view.
  const offset=camera.position.clone().sub(controls.target).multiplyScalar(after.distance/before.distance);
  controls.target.add(new Vector3(...after.target).sub(new Vector3(...before.target)));
  camera.position.copy(controls.target).add(offset);framing=updated;controls.update();
}
function stop(){mixer?.stopAllAction();playing=false;$('play').textContent='再生';}
function activateMotion(time=0,resume=false) {
  stop();action=null;const clip=clips.find(c=>c.name===selected);
  if(clip){action=mixer.clipAction(clip);action.play();action.paused=true;action.time=Math.min(time,clip.duration);mixer.update(0);}
  $('timeline').max=String(clip?.duration??2);$('timeline').disabled=!clip;$('play').disabled=!clip;
  if(resume&&action){action.paused=false;playing=true;$('play').textContent='一時停止';}
  updateTime();invalidate();
}
function updateTime(){const t=action?.time??0;$('timeline').value=String(t);$('time').value=`${t.toFixed(2)} s`;}
function populateMotions() {
  $('motion').replaceChildren(new Option('レストポーズ','rest'),...clips.map(c=>new Option(c.name,c.name)));
  if(!clips.some(c=>c.name===selected))selected='rest';$('motion').value=selected;
}
function rebuild(recipe: HumanRecipe) {
  const next=createHuman(recipe);
  try {
    if(bitmap&&recipe.face==='lumi'){
      const body=next.getObjectByName('BaseBody') as Mesh<import('three').BufferGeometry,MeshStandardMaterial>,texture=new CanvasTexture(bitmap);
      texture.flipY=false;texture.colorSpace=SRGBColorSpace;texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;texture.name=bitmapName;
      body.material.map?.dispose();body.material.map=texture;body.material.needsUpdate=true;
    }
    const nextClips=[...createMotions(next),...imported.map(c=>fitMotion(next,c))];
    const time=action?.time??0,resume=playing;
    stop();if(root){mixer.uncacheRoot(root);scene.remove(root);disposeHuman(root);}
    if(helper){scene.remove(helper);helper.geometry.dispose();[helper.material].flat().forEach(m=>m.dispose());}
    root=next;scene.add(root);updateFraming(root);mixer=new AnimationMixer(root);clips=nextClips;populateMotions();
    helper=new SkeletonHelper(root);helper.visible=$('skeleton').checked;scene.add(helper);
    setModelWireframe(root,$('wireframe').checked);activateMotion(time,resume);
    let triangles=0;root.traverse(o=>{if(isMesh(o))triangles+=o.geometry.index!.count/3;});
    const hairBones=new Set<Bone>();next.traverse(o=>{if(isSkinnedMesh(o)&&o.name!=='BaseBody')o.skeleton.bones.forEach(b=>hairBones.add(b));});
    $('model-title').textContent=recipe.model==='base45-female'?'BASE-45 F':recipe.model.toUpperCase();$('model-stats').textContent=`${triangles.toLocaleString()} triangles / 22 body bones / ${hairBones.size?`${hairBones.size} hair bones`:'no hair'}`;
    $('status').textContent='編集を反映しました';$('viewport').dataset.revision=String(++revision);
    sync(recipe);invalidate();
  }catch(e){if(root!==next)disposeHuman(next);throw e;}
}
function sync(recipe: HumanRecipe) {
  for(const {section,fields} of sliderGroups)for(const key of Object.keys(fields) as ShapeKey[]){
    const values: Partial<Record<ShapeKey,number>>=recipe[section];
    const value=values[key];if(value===undefined)throw new Error(`Unknown shape field: ${section}.${key}`);
    $(key).value=String(value);$(`${key}-value`).value=value.toFixed(2);
  }
  $('hair').value=recipe.hair;$('face').value=recipe.face;$('body-type').value=recipe.model==='base45-female'?'female':'male';
  $('rig-name').textContent=recipe.rig?'読み込み骨格 / 22 bones':'BASE-45 / 22 bones';
  $('face-asset').textContent=bitmap?`${bitmapName}${recipe.face==='clay'?'（クレイ表示中）':''}`:'標準テクスチャ';
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===recipe.model)));
  $('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;
}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(history.value));}catch{error(new Error('ブラウザへ自動保存できません。設定JSONを保存してください。'));}}
function commit(recipe: HumanRecipe) {
  try{clearError();const validated=validateRecipe(recipe);rebuild(validated);history.commit(validated);sync(validated);persist();}catch(e){error(e);}
}
function change(update: (recipe: HumanRecipe)=>void){const recipe=history.value;update(recipe);commit(recipe);}

for(const group of sliderGroups)for(const [key,field] of Object.entries(group.fields) as [ShapeKey, {label:string;min:number;max:number;step:number}][]) {
  const container=document.createElement('div');container.className='slider';
  const label=document.createElement('label');label.htmlFor=key;label.append(field.label);
  const output=document.createElement('output');output.id=`${key}-value`;output.htmlFor.value=key;label.append(output);
  const input=document.createElement('input');Object.assign(input,{id:key,type:'range',min:field.min,max:field.max,step:field.step,value:0});
  // Preview during drag, one history entry on commit. Always regenerate from
  // the immutable recipe; successive slider events never accumulate deformation.
  input.addEventListener('input',()=>{const recipe=history.value;Object.assign(recipe[group.section],{[key]:Number(input.value)});try{rebuild(recipe);}catch(e){error(e);}});
  input.addEventListener('change',()=>change(r=>{Object.assign(r[group.section],{[key]:Number(input.value)});}));
  container.append(label,input);$(group.container).append(container);
}
for(const key of ['hair','face'] as const)$(key).addEventListener('change',()=>change(r=>{Object.assign(r,{[key]:$(key).value});}));
$('body-type').addEventListener('change',()=>change(r=>{r.model=$('body-type').value==='female'?'base45-female':'base45';}));
document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b=>b.addEventListener('click',()=>commit(presetRecipe(b.dataset.preset as HumanModel))));
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view!)));
$('focus').addEventListener('click',()=>{faceFocus=!faceFocus;$('focus').textContent=faceFocus?'全身に戻る':'顔に寄る';setView();});
$('reset-shape').addEventListener('click',()=>change(r=>{r.shape=presetRecipe(r.model).shape;}));
$('reset-body-shape').addEventListener('click',()=>change(r=>{r.bodyShape=presetRecipe(r.model).bodyShape;}));
$('reset-rig').addEventListener('click',()=>change(r=>{r.rig=null;}));
$('reset-face').addEventListener('click',()=>{bitmap?.close();bitmap=null;bitmapName='';$('face-file').value='';rebuild(history.value);});
for(const key of ['undo','redo'] as const)$(key).addEventListener('click',()=>{clearError();rebuild(history[key]());persist();});
$('wireframe').addEventListener('change',()=>{setModelWireframe(root,$('wireframe').checked);invalidate();});
$('skeleton').addEventListener('change',()=>{helper.visible=$('skeleton').checked;invalidate();});
$('motion').addEventListener('change',()=>{selected=$('motion').value;activateMotion();});
$('play').addEventListener('click',()=>{if(!action)return;playing=!playing;action.paused=!playing;$('play').textContent=playing?'一時停止':'再生';invalidate();});
$('timeline').addEventListener('input',()=>{if(action){playing=false;action.paused=true;action.time=Number($('timeline').value);mixer.update(0);$('play').textContent='再生';updateTime();invalidate();}});

function upload(id: 'recipe-file' | 'rig-file' | 'face-file' | 'motion-file',handler: (file: File)=>Promise<void>,maxMB=4) {
  $(id).addEventListener('change',async()=>{
    const file=$(id).files?.[0];if(!file)return;
    try{clearError();if(file.size>maxMB*1024*1024)throw new Error(`${maxMB}MB以下のファイルを選んでください`);await handler(file);}catch(e){error(e);}finally{$(id).value='';}
  });
}
upload('recipe-file',async f=>commit(validateRecipe(JSON.parse(await f.text()))));
upload('rig-file',async f=>{const rig=validateRig(JSON.parse(await f.text()));change(r=>{r.rig=rig;});});
upload('face-file',async f=>{
  if(!['image/png','image/jpeg'].includes(f.type))throw new Error('PNG / JPEGを指定してください');
  const image=await createImageBitmap(f);
  if(image.width>4096||image.height>4096){image.close();throw new Error('画像は4096px以下にしてください');}
  bitmap?.close();bitmap=image;bitmapName=f.name;change(r=>{r.face='lumi';});
},8);
upload('motion-file',async f=>{
  const gltf=await loadMotionGlb(await f.arrayBuffer());
  try {
    const accepted=gltf.animations.map((c,i)=>{const next=fitMotion(root,c);next.name=`外部 ${i+1}: ${c.name||'clip'}`;return next;});
    imported=accepted;selected=accepted[0].name;rebuild(history.value);$('motion-asset').textContent=`${f.name} / ${accepted.length} clips`;
  }finally{for(const s of new Set(gltf.scenes))disposeHuman(s);}
},32);
$('save-recipe').addEventListener('click',()=>downloadFile(JSON.stringify(history.value,null,2),'human-recipe.json','application/json'));
$('save-rig').addEventListener('click',()=>{const t=action?.time??0,resume=playing;stop();downloadFile(JSON.stringify(exportRig(root),null,2),'human-rig.json','application/json');activateMotion(t,resume);});
$('export-glb').addEventListener('click',async()=>{
  const button=$('export-glb');button.disabled=true;const t=action?.time??0,resume=playing;
  try {
    clearError();stop();setModelWireframe(root,false);
    // Export an independent snapshot so edits made during image encoding do not
    // change the asset midway through serialization.
    const {clone}=await import('three/addons/utils/SkeletonUtils.js');
    const snapshot=clone(root);snapshot.traverse(o=>{if(isMesh(o))o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();});
    const wires: Object3D[]=[];snapshot.traverse(o=>{if(o.userData.authoringEdges)wires.push(o);});wires.forEach(o=>o.removeFromParent());
    try{const bytes=await new GLTFExporter().parseAsync(snapshot,{binary:true,animations:clips});if(!(bytes instanceof ArrayBuffer))throw new Error('Expected binary GLB');downloadFile(bytes,'human.glb','model/gltf-binary');$('status').textContent='GLBを書き出しました';}
    finally{snapshot.traverse(o=>{if(isMesh(o))[o.material].flat().forEach(m=>m.dispose());if(isSkinnedMesh(o))o.skeleton.dispose();});}
  }catch(e){error(e);}finally{setModelWireframe(root,$('wireframe').checked);activateMotion(t,resume);button.disabled=false;}
});

let pending=false,last=0;
function invalidate(){if(pending)return;pending=true;requestAnimationFrame(now=>{pending=false;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(playing){mixer.update(dt);updateTime();}const moved=controls.update();updateQuadWires(root);renderer.render(scene,camera);if(playing||moved)invalidate();});}
controls.addEventListener('change',invalidate);
const resize=new ResizeObserver(()=>{const {width,height}=$('viewport').getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();invalidate();});resize.observe($('viewport'));
rebuild(history.value);setView();
