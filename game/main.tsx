import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import strixUrl from '../robot/models/strix/output/strix.glb?url';
import bastionUrl from '../robot/models/bastion/output/bastion.glb?url';
import { Stage } from './Stage.tsx';
import { Robot } from './Robot.tsx';
import { EnemyScene } from './EnemyScene.tsx';
import { advanceEnemies, createEnemies, enemyTargets, type EnemyState } from './enemies.ts';
import { STAGE, stageColliders } from './stage.ts';
import { advancePilot, cameraAim, cameraPosition, cameraTarget, constrainCamera, createPilot, viewFocus, MOVEMENT } from './simulation.ts';
import { PilotControls } from './controls.ts';
import { createCombat, type CombatState, type WeaponMounts } from './combat.ts';
import { CombatScene, CombatOverlay, emptyCombatHud, type CombatHud } from './CombatScene.tsx';
import type { PilotState, Vec3 } from './types.ts';
import './style.css';

interface Telemetry {position:Vec3;speed:number;yaw:number;boost:number;grounded:boolean}
const pilotTelemetry=(state:PilotState):Telemetry=>({position:[...state.position],speed:Math.hypot(state.velocity[0],state.velocity[2]),yaw:state.yaw,boost:state.boostWeight,grounded:state.grounded});
class RenderBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state={error:null as string|null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<div className="fatal" role="alert">3Dを読み込めませんでした。再読み込みしてください。<br/>{this.state.error}</div>:this.props.children;}
}

function World({controls,pilot,combat,enemies,ai,onReady,onTelemetry,onCombatHud}:{controls:PilotControls;pilot:RefObject<PilotState>;combat:RefObject<CombatState>;
  enemies:RefObject<EnemyState>;ai:boolean;onReady:()=>void;onTelemetry:(value:Telemetry)=>void;onCombatHud:(value:CombatHud)=>void}) {
  const [strix,bastion]=useLoader(GLTFLoader,[strixUrl,bastionUrl]);
  const cameraReady=useRef(false),hudTimer=useRef(0);
  const desired=useMemo(()=>new Vector3(),[]);
  const focus=useRef<Vec3>([0,3,30]);
  const mounts=useRef<WeaponMounts>({rifle:[0,3,-36],missiles:[[-1,4,-36],[1,4,-36]]});
  useEffect(()=>{onReady();},[onReady]);
  useFrame(({camera},delta)=>{
    const world={...STAGE,targets:enemyTargets(enemies.current).filter(t=>combat.current.hp[t.id]>0)};
    if(controls.active)pilot.current=advancePilot(pilot.current,controls.snapshot(),delta,world);
    enemies.current=advanceEnemies(enemies.current,pilot.current,combat.current.hp,delta,STAGE,controls.active&&ai);
    if(controls.active&&enemies.current.playerHp<=0)controls.pause();
    const colliders=stageColliders({...world,targets:enemyTargets(enemies.current).filter(t=>combat.current.hp[t.id]>0)});
    const state=pilot.current,target=cameraTarget(state),eye=cameraPosition(state);
    if(!cameraReady.current){camera.position.fromArray(eye);cameraReady.current=true;}
    desired.fromArray(eye);
    camera.position.lerp(desired,1-Math.exp(-14*Math.min(delta,.1)));
    camera.position.fromArray(constrainCamera(target,camera.position.toArray(),colliders));
    const look=cameraAim(state);
    camera.lookAt(...look);
    focus.current=viewFocus(camera.position.toArray(),look,colliders);
    hudTimer.current+=delta;
    if(hudTimer.current>.1){hudTimer.current=0;onTelemetry(pilotTelemetry(state));}
  },-2);
  return <>
    <Stage/>
    <Robot asset={strix} pilot={pilot} focus={focus} mounts={mounts}/>
    <CombatScene combat={combat} enemies={enemies} controls={controls} focus={focus} mounts={mounts} onHud={onCombatHud}/>
    <EnemyScene asset={bastion} enemies={enemies} combat={combat}/>
  </>;
}

function App() {
  const arena=useRef<HTMLDivElement>(null),pilot=useRef(createPilot());
  const combat=useRef(createCombat(STAGE));
  const enemies=useRef(createEnemies(STAGE));
  const [mode,setMode]=useState('combat');
  const controls=useMemo(()=>new PilotControls(),[]);
  const [ready,setReady]=useState(false),[active,setActive]=useState(false),[started,setStarted]=useState(false);
  const [telemetry,setTelemetry]=useState<Telemetry>({position:[...STAGE.spawn],speed:0,yaw:0,boost:0,grounded:true});
  const [combatHud,setCombatHud]=useState<CombatHud>(emptyCombatHud);
  const loaded=useCallback(()=>setReady(true),[]);
  useEffect(()=>controls.attach(arena.current!,value=>{
    setActive(value);
    // Pause and position are one UI transition; do not expose a stale throttled sample.
    if(!value)setTelemetry(pilotTelemetry(pilot.current));
  }),[controls]);
  const reset=()=>{
    pilot.current=createPilot();controls.yaw=0;controls.pitch=.25;
    combat.current=createCombat(STAGE);setCombatHud(emptyCombatHud());
    enemies.current=createEnemies(STAGE);
    setTelemetry({position:[...STAGE.spawn],speed:0,yaw:0,boost:0,grounded:true});
  };
  const defeated=combatHud.playerHp<=0;
  const start=()=>{if(enemies.current.playerHp<=0)reset();setStarted(true);void controls.start();};
  const heading=((telemetry.yaw*180/Math.PI)%360+360)%360;
  return <main ref={arena} className="arena" data-ready={ready} data-active={active} aria-label="ロボットTPS訓練場">
    {/* Honor low-DPR software-rendered contexts; normal displays keep their existing resolution. */}
    <RenderBoundary><Canvas shadows dpr={[.5,1.5]} camera={{fov:58,near:.15,far:260}} gl={{antialias:true,powerPreference:'high-performance'}}
      fallback={<div className="fatal" role="alert">WebGL 2対応のブラウザで開いてください。</div>}>
      <Suspense fallback={null}><World controls={controls} pilot={pilot} combat={combat} enemies={enemies} ai={mode==='combat'} onReady={loaded} onTelemetry={setTelemetry} onCombatHud={setCombatHud}/></Suspense>
    </Canvas></RenderBoundary>
    <div className="hud" aria-hidden="true">
      <div className="sector"><span className="eyebrow">FIELD TEST / 001</span><strong>IRON YARD<span>04</span></strong><small>INDUSTRIAL PROVING GROUND</small></div>
      <div className="unit"><i/>{active?'UPLINK ACTIVE':'STANDBY'}<strong>STRIX–04</strong><small>QUADRUPED / MOBILITY TEST</small></div>
      <div className="compass"><span>W</span><span>│</span><b>{Math.round(heading).toString().padStart(3,'0')}°</b><span>│</span><span>E</span></div>
      <div className="reticle"><i/><span/></div>
      <div className="readout"><span className="eyebrow">GROUND SPEED</span><div><strong>{(telemetry.speed*3.6).toFixed(1)}</strong><small>KM/H</small></div>
        <div className="speed-track"><i style={{width:`${Math.min(100,telemetry.speed/MOVEMENT.boostSpeed*100)}%`}}/></div>
        <p>{!telemetry.grounded?(telemetry.boost>.25?'BOOST / ASCEND':'AIRBORNE'):telemetry.boost>.25?'BOOST / GLIDE':telemetry.speed>.1?'LOCOMOTION / WALK':'LOCOMOTION / IDLE'}</p>
        <small>ALT {telemetry.position[1].toFixed(1)}m　X {telemetry.position[0].toFixed(1)}　Z {telemetry.position[2].toFixed(1)}</small>
      </div>
      <div className="mission"><span className="eyebrow">EXERCISE 03</span><strong>{defeated?'UNIT LOST':combatHud.kills===3?'TARGETS ELIMINATED':'敵機を撃破せよ'}</strong><p>{mode==='combat'?'赤い射撃予告を見て回避・遮蔽物を活用':'射撃とマルチロックを確認'}</p><small>BASTION {3-combatHud.kills} / 3 · {mode==='combat'?'AI COMBAT':'静止標的'}</small></div>
      <div className="controls"><span><kbd>W A S D</kbd>移動</span><span><kbd>MOUSE</kbd>視点</span><span><kbd>SPACE</kbd>ジャンプ／長押し上昇</span><span><kbd>SHIFT</kbd>高速移動</span><span><kbd>ESC</kbd>停止</span></div>
      <div className="offline">WEAPONS ONLINE<span>LIVE FIRE EXERCISE</span></div>
    </div>
    <CombatOverlay hud={combatHud}/>
    <output className="sr-only" id="pilot-telemetry" aria-label="機体の状態" data-x={telemetry.position[0]} data-y={telemetry.position[1]} data-z={telemetry.position[2]} data-grounded={telemetry.grounded} data-yaw={telemetry.yaw} data-speed={telemetry.speed} data-boost={telemetry.boost}>
      {active?'操作中':'一時停止'} / 速度 {(telemetry.speed*3.6).toFixed(1)} km/h
    </output>
    {active&&!controls.locked&&<div className="fallback-note">マウス固定が使えないため、右ドラッグで視点操作できます。Escで一時停止。</div>}
    {!active&&<section className={`deployment ${started?'resuming':''}`} aria-label="出撃メニュー">
      <div className="deployment-card"><span className="eyebrow">STRIX × BASTION / FIELD LAB</span>
        <h1>{defeated?'UNIT LOST':started?'SYSTEM PAUSED':'IRON YARD'}</h1><p className="subtitle">{defeated?'機体が撃破されました。再出撃で全機をリセット':started?'操作を再開してください':'重装機動試験場 — SECTOR 04'}</p>
        <div className="brief"><span>03 / {mode==='combat'?'AI COMBAT':'TARGET PRACTICE'}</span><p>四脚機STRIXで3機のBASTIONを撃破。<br/>左クリックで連射。E長押し→離してミサイル。<br/>{mode==='combat'?'敵は索敵・接近・射撃。赤い予告線を見て回避。':'移動しない標的で武器の操作を練習。'}</p></div>
        <label className="exercise-mode">演習モード<select aria-label="演習モード" value={mode} onChange={e=>{reset();setMode(e.target.value);}}><option value="combat">敵AIと交戦</option><option value="training">静止標的で練習</option></select></label>
        <button className="deploy-button" onClick={start} disabled={!ready}>{ready?(defeated?'再出撃する':started?'操作を再開':'出撃する'):'機体を読み込み中…'}<span>↗</span></button>
        <p className="hint">クリックでマウスを固定 · Escで解除<br/>固定できない環境では右ドラッグで視点操作</p>
        <div className="menu-footer">{started&&<button onClick={reset}>出発地点へ戻す</button>}<a href="./index.html?model=strix">モデルビューアへ</a></div>
        <p className="scope">Space短押し：ジャンプ · 長押し：上昇ブースト<br/>弾数無制限 · ミサイル再装填3秒 · Escから標的をリセット</p>
      </div>
    </section>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
