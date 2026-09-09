import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import strixUrl from '../../robot/models/strix/output/strix.glb?url';
import bastionUrl from '../../robot/models/bastion/output/bastion.glb?url';
import { Stage } from '../Stage.tsx';
import { Robot } from '../Robot.tsx';
import { GameApp, RenderBoundary } from '../Game.tsx';
import { defaultScene } from './document.ts';
import { validateSceneDocument, type SceneDocument } from './contracts.ts';
import { createHistory, editHistory, undoHistory, redoHistory } from './history.ts';
import { addEntity, removeEntity } from './operations.ts';
import { AttackPreview } from './preview.tsx';
import './editor.css';

const STORAGE='iron-yard.scene.v1';
function initialDocument() {
  try {const saved=localStorage.getItem(STORAGE);return {doc:saved?validateSceneDocument(JSON.parse(saved)):defaultScene(),message:saved?'保存済みシーンを読み込みました。':''};}
  catch{return {doc:defaultScene(),message:'保存データを読み込めませんでした。初期シーンを表示しています。JSONから復元できます。'};}
}
function Orbit() {
  const {camera,gl}=useThree(),control=useRef<OrbitControls|null>(null);
  useEffect(()=>{const c=new OrbitControls(camera,gl.domElement);c.target.set(0,0,-2);c.enableDamping=true;c.maxPolarAngle=Math.PI*.48;c.minDistance=10;c.maxDistance=180;c.update();control.current=c;return()=>c.dispose();},[camera,gl]);
  useFrame(()=>control.current?.update());return null;
}
function SceneView({doc,selected,wave,onSelect,onReady}:{doc:SceneDocument;selected:string;wave:number;onSelect:(id:string)=>void;onReady:()=>void}) {
  const [strix,bastion]=useLoader(GLTFLoader,[strixUrl,bastionUrl]);
  useEffect(onReady,[onReady]);
  const solid=doc.stage.solids.find(s=>s.id===selected),target=doc.stage.targets.find(t=>t.id===selected);
  const pos=solid?.center??target?.position??doc.stage.spawn;
  const size=solid?.size??[6,7,6];
  const active=new Set(doc.mission.waves[Math.min(wave,doc.mission.waves.length-1)].targets);
  return <>
    <Orbit/><Stage stage={doc.stage} {...doc.lighting}/>
    <group onClick={e=>{e.stopPropagation();onSelect('spawn');}}><Robot asset={strix} position={doc.stage.spawn}/></group>
    {doc.stage.targets.filter(t=>active.has(t.id)).map(t=><group key={t.id} onClick={e=>{e.stopPropagation();onSelect(t.id);}}><Robot asset={bastion} position={t.position} yaw={t.yaw}/></group>)}
    {doc.stage.solids.map(s=><mesh key={s.id} position={s.center} onClick={e=>{e.stopPropagation();onSelect(s.id);}}><boxGeometry args={s.size}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>)}
    <mesh position={[pos[0],solid?pos[1]:pos[1]+3.5,pos[2]]}><boxGeometry args={[size[0]+.2,size[1]+.2,size[2]+.2]}/><meshBasicMaterial color="#f2c878" wireframe depthTest={false}/></mesh>
  </>;
}
export function NumberField({label,value,onChange,min,max,step=.5}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;step?:number}) {
  return <label className="number-field"><span>{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))onChange(e.target.valueAsNumber);}}/></label>;
}
function Editor() {
  const [initial]=useState(initialDocument),[history,setHistory]=useState(()=>createHistory(initial.doc));
  const [selected,setSelected]=useState('spawn'),[wave,setWave]=useState(0),[message,setMessage]=useState(initial.message),[error,setError]=useState('');
  const [playing,setPlaying]=useState<SceneDocument|null>(null),[tab,setTab]=useState<'scene'|'action'>('scene');
  const [ready,setReady]=useState(false),loaded=useCallback(()=>setReady(true),[]);
  const doc=history.present;
  let invalid='';try{validateSceneDocument(doc);}catch(e){invalid=(e as Error).message;}
  const mutate=(fn:(next:SceneDocument)=>void)=>{const next=structuredClone(doc);fn(next);setHistory(h=>editHistory(h,next));setMessage('未保存の変更');setError('');};
  const replace=(next:SceneDocument)=>{setHistory(h=>editHistory(h,next));setMessage('未保存の変更');setError('');};
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(playing||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z'||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;e.preventDefault();setHistory(e.shiftKey?redoHistory:undoHistory);setMessage('未保存の変更');};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[playing]);
  const perform=(fn:()=>void)=>{try{fn();setError('');}catch(e){setError((e as Error).message);}};
  const select=(id:string)=>{setSelected(id);const w=doc.mission.waves.findIndex(w=>w.targets.includes(id));if(w>=0)setWave(w);};
  const solid=doc.stage.solids.find(s=>s.id===selected),target=doc.stage.targets.find(t=>t.id===selected);
  const position=solid?.center??target?.position??doc.stage.spawn;
  const editPosition=(axis:number,value:number)=>mutate(next=>{const s=next.stage.solids.find(s=>s.id===selected),t=next.stage.targets.find(t=>t.id===selected);(s?.center??t?.position??next.stage.spawn)[axis]=value;});
  const add=(kind:'enemy'|'container')=>perform(()=>{const result=addEntity(doc,kind,wave);replace(result.doc);select(result.id);});
  const download=()=>perform(()=>{const data=JSON.stringify(validateSceneDocument(doc),null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${doc.id}.scene.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('シーンJSONを書き出しました。');});
  if(playing)return <GameApp scene={playing} onExit={()=>{setReady(false);setPlaying(null);}}/>;
  return <main className="studio">
    <header className="studio-header"><div><span className="studio-kicker">IRON YARD / PRODUCTION TOOLS</span><h1>SCENE STUDIO</h1></div><nav><a href="./motion-editor.html">Motion Editor ↗</a><a href="./game.html">ゲーム ↗</a></nav></header>
    <div className="studio-toolbar"><div className="studio-tabs"><button aria-pressed={tab==='scene'} onClick={()=>{if(tab!=='scene')setReady(false);setTab('scene');}}>シーン</button><button aria-pressed={tab==='action'} onClick={()=>setTab('action')}>攻撃・エフェクト</button></div>
      <button disabled={!history.past.length} onClick={()=>{setHistory(undoHistory);setMessage('未保存の変更');}}>元に戻す</button><button disabled={!history.future.length} onClick={()=>{setHistory(redoHistory);setMessage('未保存の変更');}}>やり直す</button>
      <span className="toolbar-spacer"/><button disabled={!!invalid} onClick={()=>perform(()=>{localStorage.setItem(STORAGE,JSON.stringify(validateSceneDocument(doc)));setMessage('保存しました（このブラウザ）。');})}>保存</button>
      <label className="file-button">読込<input aria-label="シーンJSONを読み込む" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>1_000_000)throw Error('シーンJSONは1MB以下にしてください。');const loaded=validateSceneDocument(JSON.parse(await file.text()));replace(loaded);setSelected('spawn');setWave(0);setMessage('読み込みました。保存でブラウザにも記録できます。');}catch(e){setError((e as Error).message);}}}/></label>
      <button disabled={!!invalid} onClick={download}>JSON書出</button><button className="primary" disabled={!!invalid} onClick={()=>perform(()=>setPlaying(validateSceneDocument(doc)))}>試遊</button>
    </div>
    {(error||invalid)&&<div className="studio-error" role="alert">{error||invalid}</div>}
    {tab==='scene'?<div className="studio-workspace">
      <aside className="studio-tree"><h2>HIERARCHY</h2><button className={selected==='spawn'?'selected':''} onClick={()=>select('spawn')}>出撃地点 / STRIX</button>
        <h3>環境 · {doc.stage.solids.length}</h3>{doc.stage.solids.map(s=><button key={s.id} className={selected===s.id?'selected':''} onClick={()=>select(s.id)}>{s.id}</button>)}
        {doc.mission.waves.map((w,i)=><section key={w.id}><h3>WAVE {i+1}</h3>{w.targets.map(id=><button key={id} className={selected===id?'selected':''} onClick={()=>select(id)}>{id}</button>)}</section>)}
        <div className="tree-actions"><button onClick={()=>add('container')}>＋ コンテナ</button><button onClick={()=>add('enemy')}>＋ 敵機</button></div>
      </aside>
      <section className="studio-viewport" aria-label="シーンプレビュー" data-ready={ready}><RenderBoundary><Canvas shadows dpr={[.5,1.5]} camera={{position:[65,78,-82],fov:48,near:.2,far:500}} fallback={<p role="alert">WebGL 2対応のブラウザで開いてください。</p>}><Suspense fallback={null}><SceneView doc={doc} selected={selected} wave={wave} onSelect={select} onReady={loaded}/></Suspense></Canvas></RenderBoundary>
        {!ready&&<p className="viewport-loading" aria-live="polite">機体とシーンを読み込み中…</p>}
        <div className="viewport-caption">左ドラッグ：回転 · 右ドラッグ：移動 · ホイール：ズーム · クリック：選択</div>
        <label className="wave-picker">表示する波<select aria-label="表示する波" value={wave} onChange={e=>setWave(Number(e.target.value))}>{doc.mission.waves.map((w,i)=><option key={w.id} value={i}>WAVE {i+1}</option>)}</select></label>
      </section>
      <aside className="studio-inspector"><h2>INSPECTOR</h2><h3>{selected==='spawn'?'出撃地点':selected}</h3>
        {['X','Y','Z'].map((axis,i)=><NumberField key={axis} label={`位置 ${axis}`} value={position[i]} onChange={v=>editPosition(i,v)} min={i===1&&!solid?0:undefined} max={i===1&&!solid?0:undefined}/>)}
        {solid&&<>{['X','Y','Z'].map((axis,i)=><NumberField key={axis} label={`サイズ ${axis}`} value={solid.size[i]} min={.2} max={220} onChange={v=>mutate(d=>{d.stage.solids.find(s=>s.id===selected)!.size[i]=v;})}/>)}<label>色<input aria-label="オブジェクトの色" type="color" value={solid.color} onChange={e=>mutate(d=>{d.stage.solids.find(s=>s.id===selected)!.color=e.target.value;})}/></label></>}
        {target&&<NumberField label="向き（度）" value={Math.round(target.yaw*180/Math.PI)} step={5} min={-360} max={360} onChange={v=>mutate(d=>{d.stage.targets.find(t=>t.id===selected)!.yaw=v*Math.PI/180;})}/>}
        {selected!=='spawn'&&<button className="danger" onClick={()=>perform(()=>{replace(removeEntity(doc,selected));setSelected('spawn');})}>選択を削除</button>}
        <hr/><h3>シーン・ミッション</h3><label>シーン名<input aria-label="シーン名" value={doc.name} onChange={e=>mutate(d=>{d.name=e.target.value;})}/></label>
        <NumberField label="制限時間（秒）" value={doc.mission.timeLimit} min={10} max={600} step={10} onChange={v=>mutate(d=>{d.mission.timeLimit=v;})}/>
        <NumberField label="カメラ FOV" value={doc.camera.fov} min={40} max={85} step={1} onChange={v=>mutate(d=>{d.camera.fov=v;})}/>
        <label>空の色<input aria-label="空の色" type="color" value={doc.lighting.skyColor} onChange={e=>mutate(d=>{d.lighting.skyColor=e.target.value;})}/></label>
        <NumberField label="太陽光の強さ" value={doc.lighting.sunIntensity} min={.1} max={6} step={.1} onChange={v=>mutate(d=>{d.lighting.sunIntensity=v;})}/>
        <p className="inspector-hint">敵機は表示中の波に追加されます。配置の重なりは試遊前にチェックします。</p>
      </aside>
    </div>:<AttackPreview action={doc.action} onChange={action=>mutate(d=>{d.action=action;})}/>}
    <footer className="studio-status"><span role="status">{message||'配置を選んで編集し、試遊で確かめてください。'}</span><span>{doc.stage.targets.length} ENEMIES · {doc.mission.waves.length} WAVES · {doc.mission.timeLimit}s</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Editor/>);
