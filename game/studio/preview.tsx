import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PerspectiveCamera } from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ActionDocument, SoundId } from './contracts.ts';
import { sampleAction } from './action.ts';
import { replayAttack } from './preview-simulation.ts';
import { GameAudio } from './audio.ts';
import { impactSparks } from './effects.ts';
import { RenderBoundary } from '../Game.tsx';

function AttackView({action,time,running,onTime,onReady}:{action:ActionDocument;time:number;running:boolean;onTime:(time:number)=>void;onReady:()=>void}) {
  useEffect(onReady,[onReady]);
  const current=useRef(time);current.current=time;
  useFrame((_,dt)=>{if(running)onTime(Math.min(1.5,current.current+Math.min(.1,dt)));});
  const state=replayAttack(action,time),pose=sampleAction(action,time);
  return <>
    <color attach="background" args={['#334956']}/><ambientLight intensity={1.5}/><directionalLight position={[0,15,-10]} intensity={3}/><gridHelper args={[60,30,'#70848e','#445e6c']}/>
    <group position={[0,3,0]} rotation={[-pose.recoil,0,0]}><mesh><boxGeometry args={[.9,.8,4]}/><meshStandardMaterial color="#9aadb1" metalness={.6} roughness={.4}/></mesh>
      <mesh position={[0,0,2.4]} visible={pose.flash}><sphereGeometry args={[.55,8,8]}/><meshBasicMaterial color={action.flashColor}/></mesh></group>
    <mesh position={[0,3,16]} visible={state.hp.preview>0}><boxGeometry args={[5.4,6,5.4]}/><meshStandardMaterial color="#c57f61" wireframe={state.hp.preview<180}/></mesh>
    {state.projectiles.map(p=><mesh key={p.id} position={p.position}><sphereGeometry args={[.16,6,6]}/><meshBasicMaterial color="#fff2bf"/></mesh>)}
    {state.effects.map(e=><group key={e.id} position={e.position}><mesh scale={.1+e.age*(e.kind==='kill'?16:8)}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial color={e.kind==='kill'?'#f99b3d':'#ffdc9a'} transparent opacity={Math.max(0,1-e.age/(e.kind==='kill'?1.2:.45))} depthWrite={false}/></mesh>
      {impactSparks({...e,position:[0,0,0]}).map((s,i)=><mesh key={i} position={s.position} scale={s.scale}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color="#ffe1a0"/></mesh>)}
    </group>)}
  </>;
}
const soundNames:Record<SoundId,string>={'sfx.blunt':'打撲','sfx.sword':'剣ヒット','sfx.explosion':'爆発','sfx.confirm':'決定','sfx.cancel':'キャンセル'};
export function AttackPreview({action,onChange}:{action:ActionDocument;onChange:(action:ActionDocument)=>void}) {
  const [time,setTime]=useState(0),[running,setRunning]=useState(false),[error,setError]=useState('');
  const [ready,setReady]=useState(false),loaded=useCallback(()=>setReady(true),[]);
  const audio=useMemo(()=>new GameAudio(),[]);
  useEffect(()=>()=>audio.dispose(),[audio]);
  useEffect(()=>{setRunning(false);setTime(0);audio.reset();},[action,audio]);
  const frame=(next:number)=>{setTime(next);audio.consume(replayAttack(action,next).events,action);if(next>=1.5)setRunning(false);};
  const field=(key:'cooldown'|'damage'|'flashDuration'|'recoilDuration'|'recoilStrength',label:string,min:number,max:number,step:number)=><label className="number-field"><span>{label}</span><input aria-label={label} type="number" value={action[key]} min={min} max={max} step={step} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))onChange({...action,[key]:Math.max(min,Math.min(max,n))});}}/></label>;
  const snapshot=replayAttack(action,time);
  return <div className="attack-workspace"><section className="attack-main"><div className="studio-viewport" role="region" aria-label="攻撃プレビュー" data-ready={ready}><RenderBoundary><Canvas dpr={[.5,1.5]} camera={{position:[23,15,-17],fov:45,onUpdate:(camera:PerspectiveCamera)=>camera.lookAt(0,2,8)}} fallback={<p role="alert">WebGL 2対応のブラウザで開いてください。</p>}><AttackView action={action} time={time} running={running} onTime={frame} onReady={loaded}/></Canvas></RenderBoundary>{!ready&&<p className="viewport-loading" aria-live="polite">プレビューを準備中…</p>}<div className="viewport-caption">ライフル → 弾道 → 命中 · 実際のゲームと同じ判定</div></div>
    <div className="attack-timeline"><button onClick={()=>{audio.reset();setTime(0);void audio.unlock().then(()=>{if(audio.ready){setRunning(true);setError('');}else setError(audio.error);});}}>攻撃を再生</button>
      <label>TIME <input aria-label="攻撃の時間" type="range" min="0" max="1.5" step=".005" value={time} onChange={e=>{setRunning(false);audio.reset();setTime(Number(e.target.value));}}/><output>{time.toFixed(3)}s</output></label>
      <p>ドラッグでコマ送り（無音）。発射時に反動と閃光、実際の命中時にエフェクトと効果音。</p>
      <output data-testid="attack-result" data-shots={snapshot.shots} data-hits={snapshot.hits} data-hp={snapshot.hp.preview}>発射 {snapshot.shots} / 命中 {snapshot.hits} / 標的HP {snapshot.hp.preview}</output>
      {error&&<p role="alert">{error}</p>}
    </div></section><aside className="studio-inspector"><h2>ACTION / RIFLE</h2><h3>発射と命中</h3>
      {field('cooldown','連射間隔（秒）',.06,1,.01)}{field('damage','ダメージ',1,180,1)}
      <h3>フラッシュ・反動</h3>{field('flashDuration','閃光の長さ（秒）',.005,.15,.005)}<label>閃光の色<input aria-label="閃光の色" type="color" value={action.flashColor} onChange={e=>onChange({...action,flashColor:e.target.value})}/></label>
      {field('recoilDuration','反動の長さ（秒）',.03,.5,.01)}{field('recoilStrength','反動の強さ',0,.3,.005)}
      <h3>効果音</h3>{(['shotSound','hitSound'] as const).map(key=><label key={key}>{key==='shotSound'?'発射音':'命中音'}<select aria-label={key==='shotSound'?'発射音':'命中音'} value={action[key]} onChange={e=>onChange({...action,[key]:e.target.value as SoundId})}>{Object.entries(soundNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>)}
      <p className="inspector-hint">この設定はシーンに保存され、試遊でもそのまま使われます。プレビューは1発のみ。連射間隔は試遊で確認できます。</p>
    </aside></div>;
}
