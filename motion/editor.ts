import './editor.css';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { elementLookup, errorMessage } from '../viewer/dom.ts';
import { presetRecipe, validateRecipe } from '../human/contract.ts';
import type { HumanModel } from '../human/contract.ts';
import { createHuman, disposeHuman } from '../human/model.ts';
import { downloadFile } from '../human/io.ts';
import { BODY_BONES, createProject, restPose, validateProject } from './contract.ts';
import type { BodyBone, MotionProject, MotionPose, Vec3 } from './contract.ts';
import { createMotionHistory, putKey, moveKey, deleteKey, resizeClip, samplePose, referenceTime } from './project.ts';
import { compileClip, createMotionRig } from './rig.ts';
import { MotionViewport } from './viewport.ts';
import { ReferenceVideo } from './video.ts';
import type { Group } from 'three';
import { Quaternion } from 'three';
import { retargetHunyuan } from './import/hunyuan.ts';

type InputId='clip-name'|'duration-frames'|'timeline'|'key-frame'|'loop'|'show-bones'|'video-in'|'video-out'|'video-file'|'project-file'|'recipe-file'|'fbx-file'|'in-place'|'target-x'|'target-y'|'target-z'|'rotate-x'|'rotate-y'|'rotate-z';
type ButtonId='save-project'|'export-glb'|'play'|'previous-frame'|'next-frame'|'put-key'|'move-key'|'delete-key'|'undo'|'redo'|'discard-pose'|'resize-clip'|'apply-trim'|'remove-video'|'rest-pose'|'new-project'|'import-fbx';
type Elements=Record<InputId,HTMLInputElement>&Record<ButtonId,HTMLButtonElement>&Record<'model'|'bone'|'target'|'speed'|'source-clip',HTMLSelectElement>&Record<'viewport'|'status'|'error'|'draft'|'key-count'|'key-lane'|'time'|'model-title'|'video-empty'|'video-name'|'storage-status'|'fps-label'|'angle-x'|'angle-y'|'angle-z'|'import-status',HTMLElement>&{'reference-video':HTMLVideoElement};
const $=elementLookup<Elements>(),storageKey='motion-editor.project.v1';
function fail(error: unknown){$('error').textContent=errorMessage(error);$('error').hidden=false;}
function clearError(){$('error').hidden=true;}
function attempt(action: ()=>void){try{clearError();action();}catch(e){fail(e);}}
let initial=createProject();
try{const saved=localStorage.getItem(storageKey);if(saved)initial=validateProject(JSON.parse(saved));}catch{fail(new Error('自動保存を読み込めなかったため、新規クリップで開始しました'));}
const history=createMotionHistory(initial);let project=history.value,frame=0,playing=false,dirty=false,busy=false,lastRecipe='',external: Group|null=null;
const viewport=new MotionViewport($('viewport'),project.recipe),reference=new ReferenceVideo($('reference-video'));
let selectedBone: BodyBone='Head',selectedTarget='leftHand';
const lockOnDraft: (InputId|ButtonId|'model')[]=['timeline','play','previous-frame','next-frame','move-key','delete-key','model','duration-frames','resize-clip','apply-trim','save-project','export-glb','project-file','recipe-file','new-project','video-file','remove-video','clip-name','loop','fbx-file','import-fbx'];

function persist(){try{localStorage.setItem(storageKey,JSON.stringify(project));$('storage-status').textContent='登録済みキーは自動保存済み。動画本体は含まれません。';}catch{$('storage-status').textContent='ブラウザへ保存できません。編集JSONを保存してください。';}}
function stop(){playing=false;reference.pause();$('play').textContent='再生';viewport.setEditable(true);updateLocks();}
function updateLocks(){
  for(const id of lockOnDraft)$(id).disabled=dirty||playing;
  $('play').disabled=dirty;$('timeline').disabled=dirty;
  for(const id of ['put-key','rest-pose','target','bone','target-x','target-y','target-z','rotate-x','rotate-y','rotate-z'] as const)$(id).disabled=playing;
  const interior=project.keys.some(k=>k.frame===frame)&&frame!==0&&frame!==project.frames;
  $('move-key').disabled=dirty||playing||!interior;$('delete-key').disabled=dirty||playing||!interior;
  $('undo').disabled=!dirty&&!history.canUndo;$('redo').disabled=dirty||!history.canRedo;
  $('apply-trim').disabled=dirty||playing||!reference.url;$('remove-video').disabled=dirty||playing||!project.reference;
  $('draft').hidden=!dirty;
  $('import-fbx').disabled=dirty||playing||!external;$('source-clip').disabled=dirty||playing||!external;
  if(busy){for(const element of document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select'))element.disabled=true;}
  viewport.setEditable(!busy&&!playing);
}
function syncPoseFields(){
  const angles=viewport.angles(selectedBone),target=viewport.rig.ik.targets[selectedTarget];
  for(const [i,axis] of ['x','y','z'].entries()){
    const a=axis as 'x'|'y'|'z';$(`rotate-${a}`).value=String(Math.round(angles[i]));$(`angle-${a}`).textContent=`${Math.round(angles[i])}°`;
    // Do not rewrite a partially typed number (e.g. "0.") under the caret.
    if(document.activeElement!==$(`target-${a}`))$(`target-${a}`).value=target.getComponent(i).toFixed(3);
  }
}
function syncVideo(force=false){
  if(!reference.url||!project.reference)return;
  const time=referenceTime(project,frame);
  if(force||Math.abs(reference.video.currentTime-time)>.12)reference.seek(time);
  if(frame/project.fps>=project.reference.out-project.reference.in)reference.pause();
}
function showFrame(next: number){
  frame=Math.max(0,Math.min(project.frames,next));viewport.setPose(samplePose(project,frame));
  $('timeline').value=String(frame);$('time').textContent=`${(frame/project.fps).toFixed(2)} s · ${Math.floor(frame)} f`;
  if(!playing){$('key-frame').value=String(Math.round(frame));syncPoseFields();updateLocks();}
  for(const button of $('key-lane').querySelectorAll<HTMLButtonElement>('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.frame)===frame));
}
function seek(next: number){stop();showFrame(Math.round(next));renderKeys();syncVideo(true);}
function renderKeys(){
  const lane=$('key-lane');lane.replaceChildren();
  const stride=Math.max(1,Math.ceil(project.keys.length/Math.max(2,Math.floor(lane.clientWidth/30))));
  project.keys.forEach((key,i)=>{
    if(i%stride&&i!==project.keys.length-1&&key.frame!==frame)return;
    const button=document.createElement('button');button.textContent='◆';button.dataset.frame=String(key.frame);
    button.setAttribute('aria-pressed',String(key.frame===frame));
    button.style.left=`${key.frame/project.frames*100}%`;button.title=`${key.frame} f`;button.setAttribute('aria-label',`キー ${key.frame} f`);
    button.addEventListener('click',()=>{if(!dirty)seek(key.frame);});lane.append(button);
  });$('key-count').textContent=`${project.keys.length} keys`;
}
function syncReference(){
  const r=project.reference;
  // A changed project must not accidentally show an unrelated local file.
  if(reference.url&&(!r||r.name!==reference.name||Math.abs(r.duration-reference.duration)>.05))reference.release();
  $('video-empty').hidden=Boolean(reference.url);
  $('video-name').textContent=r?`${r.name}${reference.url?' · ローカル参照':' · 同じ動画を再選択してください'}`:'動画は外部に送信しません。自動姿勢推定は未対応です。';
  $('video-in').value=String(r?.in??0);$('video-out').value=String(r?.out??project.frames/project.fps);
}
function refresh(){
  stop();dirty=false;const recipe=JSON.stringify(project.recipe);
  if(lastRecipe!==recipe){viewport.setRecipe(project.recipe);lastRecipe=recipe;}
  viewport.helper.visible=$('show-bones').checked;
  $('model').value=project.recipe.model;$('model-title').textContent=project.recipe.model.toUpperCase();
  $('clip-name').value=project.name;$('duration-frames').value=String(project.frames);$('duration-frames').max=String(project.fps*600);
  $('timeline').max=String(project.frames);$('key-frame').max=String(project.frames-1);$('loop').checked=project.loop;
  $('fps-label').textContent=`${project.fps} fps · 終端フレームを含む`;
  renderKeys();syncReference();seek(frame);$('status').textContent='編集できます';
}
function commit(next: MotionProject){history.commit(next);project=history.value;refresh();persist();}
function poseChanged(pose: MotionPose,target?: string){
  if(playing)return;
  if(target){selectedTarget=target;$('target').value=target;}
  const evaluated=samplePose(project,frame);
  dirty=BODY_BONES.some(name=>new Quaternion(...pose.rotations[name]).angleTo(new Quaternion(...evaluated.rotations[name]))>1e-6)
    ||(['root','hips'] as const).some(field=>pose[field].some((v,i)=>Math.abs(v-evaluated[field][i])>1e-8));
  syncPoseFields();updateLocks();
}
viewport.onPose=poseChanged;
viewport.onTick=delta=>{
  if(!playing)return;
  let next=frame+delta*project.fps*Number($('speed').value);
  if(next>=project.frames){
    if(project.loop){next%=project.frames;reference.seek(referenceTime(project,next));if(reference.url)void reference.video.play().catch(e=>{stop();fail(e);});}
    else{stop();next=project.frames;}
  }
  showFrame(next);syncVideo();
};
for(const bone of BODY_BONES)$('bone').append(new Option(bone,bone));$('bone').value=selectedBone;
$('target').append(new Option('腰','hips'));
for(const chain of viewport.rig.ik.chains){$('target').append(new Option(chain.label,chain.id),new Option(chain.label+' / 曲がる向き',chain.id+'Pole'));}$('target').value=selectedTarget;
$('bone').addEventListener('change',()=>{selectedBone=$('bone').value as BodyBone;syncPoseFields();});
$('target').addEventListener('change',()=>{selectedTarget=$('target').value;syncPoseFields();});
for(const [i,axis] of ['x','y','z'].entries()){
  const a=axis as 'x'|'y'|'z';
  $(`target-${a}`).addEventListener('input',()=>{if($(`target-${a}`).value!==''&&$(`target-${a}`).validity.valid)attempt(()=>viewport.target(selectedTarget,i,Number($(`target-${a}`).value)));});
  $(`rotate-${a}`).addEventListener('input',()=>attempt(()=>viewport.rotate(selectedBone,['x','y','z'].map(v=>Number($(`rotate-${v as 'x'|'y'|'z'}`).value)) as Vec3)));
}
$('rest-pose').addEventListener('click',()=>{viewport.setPose(restPose());poseChanged(viewport.pose());});
$('put-key').addEventListener('click',()=>attempt(()=>commit(putKey(project,Math.round(frame),viewport.pose()))));
$('discard-pose').addEventListener('click',()=>{dirty=false;seek(frame);});
$('move-key').addEventListener('click',()=>attempt(()=>{const to=Number($('key-frame').value),next=moveKey(project,frame,to);frame=to;commit(next);}));
$('delete-key').addEventListener('click',()=>attempt(()=>commit(deleteKey(project,frame))));
$('undo').addEventListener('click',()=>attempt(()=>{if(dirty){dirty=false;seek(frame);return;}project=history.undo();refresh();persist();}));
$('redo').addEventListener('click',()=>attempt(()=>{project=history.redo();refresh();persist();}));
$('timeline').addEventListener('input',()=>seek(Number($('timeline').value)));
$('previous-frame').addEventListener('click',()=>seek(Math.round(frame)-1));$('next-frame').addEventListener('click',()=>seek(Math.round(frame)+1));
$('play').addEventListener('click',()=>attempt(()=>{
  if(playing){stop();seek(Math.round(frame));return;}
  if(frame>=project.frames)seek(0);playing=true;$('play').textContent='一時停止';viewport.setEditable(false);updateLocks();
  syncVideo(true);reference.video.playbackRate=Number($('speed').value);
  if(reference.url)void reference.video.play().catch(e=>{stop();fail(new Error(`動画を再生できません: ${errorMessage(e)}`));});
}));
$('speed').addEventListener('change',()=>{reference.video.playbackRate=Number($('speed').value);});
$('loop').addEventListener('change',()=>attempt(()=>commit({...project,loop:$('loop').checked})));
$('clip-name').addEventListener('change',()=>attempt(()=>commit({...project,name:$('clip-name').value})));
$('model').addEventListener('change',()=>attempt(()=>commit({...project,recipe:presetRecipe($('model').value as HumanModel)})));
$('resize-clip').addEventListener('click',()=>attempt(()=>commit(resizeClip(project,Number($('duration-frames').value)))));
$('show-bones').addEventListener('change',()=>{viewport.helper.visible=$('show-bones').checked;});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  viewport.setView(button.dataset.view!);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
$('apply-trim').addEventListener('click',()=>attempt(()=>{
  const start=Number($('video-in').value),end=Number($('video-out').value);
  let next=validateProject({...project,reference:{name:reference.name,duration:reference.duration,in:start,out:end}});
  next=resizeClip(next,Math.floor((end-start)*project.fps+1e-6));frame=0;commit(next);
}));
$('remove-video').addEventListener('click',()=>attempt(()=>commit({...project,reference:null})));
function upload(id:'project-file'|'recipe-file'|'video-file'|'fbx-file',maxMB: number,handler:(file: File)=>Promise<void>){
  $(id).addEventListener('change',async()=>{
    const file=$(id).files?.[0];if(!file)return;
    try{clearError();stop();busy=true;updateLocks();if(file.size>maxMB*1024*1024)throw new Error(`${maxMB}MB以下のファイルを選んでください`);await handler(file);}
    catch(e){fail(e);}finally{busy=false;for(const element of document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select'))element.disabled=false;updateLocks();$(id).value='';}
  });
}
upload('project-file',16,async file=>{const next=validateProject(JSON.parse(await file.text()));frame=0;commit(next);});
upload('recipe-file',4,async file=>commit({...project,recipe:validateRecipe(JSON.parse(await file.text()))}));
upload('video-file',256,async file=>{
  if(!await reference.load(file))return;
  const r=project.reference,retain=r?.name===file.name&&Math.abs(r.duration-reference.duration)<.05;
  commit({...project,reference:retain?r:{name:file.name,duration:reference.duration,in:0,out:Math.min(reference.duration,project.frames/project.fps)}});
});
upload('fbx-file',32,async file=>{
  const {parseMotionFbx}=await import('./import/fbx.ts');const next=parseMotionFbx(await file.arrayBuffer());
  if(!next.animations.length||next.animations.length>50){disposeHuman(next);throw new Error('1〜50クリップを含むFBXが必要です');}
  if(external)disposeHuman(external);external=next;
  $('source-clip').replaceChildren(...next.animations.map((clip,i)=>new Option(`${clip.name} / ${clip.duration.toFixed(2)} s`,String(i))));
  $('import-status').textContent=`${file.name} / ${next.animations.length} clips。取り込みボタンで現在のクリップを置き換えます。`;
});
$('import-fbx').addEventListener('click',()=>attempt(()=>{
  if(!external)return;
  const result=retargetHunyuan(external,external.animations[Number($('source-clip').value)],project,viewport.rig);
  if($('in-place').checked)for(const key of result.project.keys){key.pose.root[0]=0;key.pose.root[2]=0;}
  frame=0;commit(result.project);$('import-status').textContent=result.report;
}));
$('save-project').addEventListener('click',()=>downloadFile(JSON.stringify(project,null,2),'motion-project.json','application/json'));
$('export-glb').addEventListener('click',async()=>{
  stop();$('export-glb').disabled=true;const root=createHuman(project.recipe);
  try{
    clearError();const clip=compileClip(project,createMotionRig(root));
    const bytes=await new GLTFExporter().parseAsync(root,{binary:true,animations:[clip]});
    if(!(bytes instanceof ArrayBuffer))throw new Error('GLBの生成に失敗しました');
    downloadFile(bytes,'motion.glb','model/gltf-binary');
  }catch(e){fail(e);}finally{disposeHuman(root);$('export-glb').disabled=false;}
});
$('new-project').addEventListener('click',()=>{if(confirm('新規クリップに切り替えます。現在のクリップはUndoで戻せます。')){frame=0;commit(createProject());}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',event=>{stop();if(!event.persisted){reference.dispose();viewport.dispose();if(external)disposeHuman(external);}});
refresh();
