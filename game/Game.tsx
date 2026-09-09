import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import strixUrl from '../robot/models/strix/output/strix.glb?url';
import bastionUrl from '../robot/models/bastion/output/bastion.glb?url';
import { Stage } from './Stage.tsx';
import { Robot } from './Robot.tsx';
import { EnemyScene } from './EnemyScene.tsx';
import { advanceEnemies, createEnemies, enemyTargets, type EnemyState } from './enemies.ts';
import { stageColliders } from './stage.ts';
import { advancePilot, cameraAim, cameraPosition, cameraTarget, constrainCamera, createPilot, viewFocus, MOVEMENT } from './simulation.ts';
import { PilotControls } from './controls.ts';
import { createCombat, type CombatState, type WeaponMounts } from './combat.ts';
import { CombatScene, CombatOverlay, emptyCombatHud, type CombatHud } from './CombatScene.tsx';
import type { PilotState, Vec3 } from './types.ts';
import { defaultScene, stageForWave } from './studio/document.ts';
import type { SceneDocument } from './studio/contracts.ts';
import { createMission, advanceMission, type MissionState } from './studio/mission.ts';
import { GameAudio } from './studio/audio.ts';
import './style.css';

interface Telemetry {position:Vec3;speed:number;yaw:number;boost:number;grounded:boolean}
const pilotTelemetry=(state:PilotState):Telemetry=>({position:[...state.position],speed:Math.hypot(state.velocity[0],state.velocity[2]),yaw:state.yaw,boost:state.boostWeight,grounded:state.grounded});
export class RenderBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state={error:null as string|null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<div className="fatal" role="alert">3Dを読み込めませんでした。再読み込みしてください。<br/>{this.state.error}</div>:this.props.children;}
}

const DEFAULT_SCENE=defaultScene();
function World({controls,pilot,combat,enemies,ai,onReady,onTelemetry,onCombatHud,scene,mission,audio,onMission}:{controls:PilotControls;pilot:RefObject<PilotState>;combat:RefObject<CombatState>;
  enemies:RefObject<EnemyState>;ai:boolean;onReady:()=>void;onTelemetry:(value:Telemetry)=>void;onCombatHud:(value:CombatHud)=>void;
  scene:SceneDocument;mission:RefObject<MissionState>;audio:GameAudio;onMission:(value:MissionState)=>void}) {
  const [strix,bastion]=useLoader(GLTFLoader,[strixUrl,bastionUrl]);
  const cameraReady=useRef(false),hudTimer=useRef(0);
  const desired=useMemo(()=>new Vector3(),[]);
  const focus=useRef<Vec3>([0,3,30]);
  const attackAge=useRef(Infinity);
  const mounts=useRef<WeaponMounts>({rifle:[0,3,-36],missiles:[[-1,4,-36],[1,4,-36]]});
  useEffect(()=>{onReady();},[onReady]);
  useFrame(({camera},delta)=>{
    const world={...scene.stage,targets:enemyTargets(enemies.current).filter(t=>combat.current.hp[t.id]>0)};
    if(controls.active)pilot.current=advancePilot(pilot.current,controls.snapshot(),delta,world);
    if(combat.current.shots===0)attackAge.current=Infinity;
    else if(controls.active)attackAge.current+=Math.min(delta,.1);
    const hpBefore=enemies.current.playerHp;
    enemies.current=advanceEnemies(enemies.current,pilot.current,combat.current.hp,delta,scene.stage,controls.active&&ai);
    if(enemies.current.playerHp<hpBefore)audio.consume([{version:1,id:combat.current.nextId++,time:combat.current.time,kind:'player_hit',position:[...pilot.current.position],entityId:'player',weapon:'enemy'}],scene.action);
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
    if(hudTimer.current>.1){hudTimer.current=0;onTelemetry(pilotTelemetry(state));onMission({...mission.current});}
  },-2);
  const advance=(delta:number)=>{
    if(!controls.active||!ai)return;
    const previous=mission.current;
    mission.current=advanceMission(previous,delta,combat.current.hp,enemies.current.playerHp,scene);
    if(mission.current.wave!==previous.wave) {
      enemies.current={...enemies.current,units:[...enemies.current.units,...createEnemies(stageForWave(scene,mission.current.wave)).units],playerHp:Math.min(1000,enemies.current.playerHp+200)};
      audio.play('sfx.confirm',.65);
    }
    if(mission.current.phase==='won'||mission.current.phase==='lost') {
      controls.pause();onMission({...mission.current});
      audio.play(mission.current.phase==='won'?'sfx.confirm':'sfx.cancel',.8);
    }
  };
  return <>
    <Stage stage={scene.stage} {...scene.lighting}/>
    <Robot asset={strix} pilot={pilot} focus={focus} mounts={mounts} action={scene.action} attackAge={attackAge}/>
    <CombatScene combat={combat} enemies={enemies} controls={controls} focus={focus} mounts={mounts} onHud={onCombatHud}
      stage={scene.stage} action={scene.action} attackAge={attackAge} onEvents={events=>audio.consume(events,scene.action)} onAdvance={advance}/>
    <EnemyScene asset={bastion} enemies={enemies} combat={combat}/>
  </>;
}

export function GameApp({scene=DEFAULT_SCENE,onExit}:{scene?:SceneDocument;onExit?:()=>void}) {
  const arena=useRef<HTMLDivElement>(null),pilot=useRef(createPilot(scene.stage));
  const combat=useRef(createCombat(scene.stage));
  const enemies=useRef(createEnemies(stageForWave(scene,0)));
  const mission=useRef(createMission(scene)),audio=useMemo(()=>new GameAudio(),[]);
  const [missionHud,setMissionHud]=useState<MissionState>(()=>createMission(scene));
  const [audioStatus,setAudioStatus]=useState({ready:false,playing:false,played:0,voices:0,error:''});
  const [volumes,setVolumes]=useState({music:.23,effects:.7});
  const [mode,setMode]=useState('combat');
  const controls=useMemo(()=>new PilotControls(),[]);
  const [ready,setReady]=useState(false),[active,setActive]=useState(false),[started,setStarted]=useState(false);
  const [telemetry,setTelemetry]=useState<Telemetry>({position:[...scene.stage.spawn],speed:0,yaw:0,boost:0,grounded:true});
  const [combatHud,setCombatHud]=useState<CombatHud>(()=>emptyCombatHud(scene.stage));
  const loaded=useCallback(()=>setReady(true),[]);
  useEffect(()=>controls.attach(arena.current!,value=>{
    setActive(value);
    if(mission.current.phase!=='won'&&mission.current.phase!=='lost'&&mission.current.phase!=='ready')mission.current={...mission.current,phase:value?'playing':'paused'};
    setMissionHud({...mission.current});
    audio.setPlaying(value);
    // Pause and position are one UI transition; do not expose a stale throttled sample.
    if(!value)setTelemetry(pilotTelemetry(pilot.current));
  }),[controls,audio]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setAudioStatus({ready:audio.ready,playing:audio.musicPlaying,played:audio.played,voices:audio.voiceCount,error:audio.error}),150);
    return ()=>{clearInterval(timer);audio.dispose();};
  },[audio]);
  useEffect(()=>audio.setVolumes(volumes.music,volumes.effects),[audio,volumes]);
  const reset=(nextMode=mode)=>{
    pilot.current=createPilot(scene.stage);controls.yaw=0;controls.pitch=.25;
    const stage=nextMode==='training'?stageForWave(scene,0):scene.stage;
    combat.current=createCombat(stage);setCombatHud(emptyCombatHud(stage));
    enemies.current=createEnemies(stageForWave(scene,0));
    mission.current=createMission(scene);setMissionHud({...mission.current});audio.reset();
    setTelemetry({position:[...scene.stage.spawn],speed:0,yaw:0,boost:0,grounded:true});
  };
  const defeated=missionHud.phase==='lost'||combatHud.playerHp<=0,won=missionHud.phase==='won';
  const start=()=>{if(defeated||won)reset();mission.current={...mission.current,phase:'playing'};setStarted(true);
    void audio.unlock().then(()=>{if(controls.active)audio.play('sfx.confirm',.5);});void controls.start();};
  const total=mode==='training'?scene.mission.waves[0].targets.length:scene.stage.targets.length;
  const heading=((telemetry.yaw*180/Math.PI)%360+360)%360;
  return <main ref={arena} className="arena" data-ready={ready} data-active={active} aria-label="ロボットTPS訓練場">
    {/* Honor low-DPR software-rendered contexts; normal displays keep their existing resolution. */}
    <RenderBoundary><Canvas shadows dpr={[.5,1.5]} camera={{fov:scene.camera.fov,near:.15,far:260}} gl={{antialias:true,powerPreference:'high-performance'}}
      fallback={<div className="fatal" role="alert">WebGL 2対応のブラウザで開いてください。</div>}>
      <Suspense fallback={null}><World controls={controls} pilot={pilot} combat={combat} enemies={enemies} ai={mode==='combat'} onReady={loaded} onTelemetry={setTelemetry} onCombatHud={setCombatHud}
        scene={scene} mission={mission} audio={audio} onMission={setMissionHud}/></Suspense>
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
      <div className="mission"><span className="eyebrow">{mode==='combat'?`WAVE ${missionHud.wave+1} / ${scene.mission.waves.length}`:'TRAINING'}</span><strong>{won?'MISSION COMPLETE':defeated?'UNIT LOST':'敵機を撃破せよ'}</strong><p>{mode==='combat'?`残り ${Math.ceil(scene.mission.timeLimit-missionHud.elapsed)} 秒 · 遮蔽物を使って回避`:'射撃とマルチロックを確認'}</p><small>撃破 {combatHud.kills} / {total}</small></div>
      <div className="controls"><span><kbd>W A S D</kbd>移動</span><span><kbd>MOUSE</kbd>視点</span><span><kbd>SPACE</kbd>ジャンプ／長押し上昇</span><span><kbd>SHIFT</kbd>高速移動</span><span><kbd>ESC</kbd>停止</span></div>
      <div className="offline">WEAPONS ONLINE<span>LIVE FIRE EXERCISE</span></div>
    </div>
    <CombatOverlay hud={combatHud}/>
    <output id="mission-telemetry" className="sr-only" data-phase={missionHud.phase} data-wave={missionHud.wave+1} data-elapsed={missionHud.elapsed} data-total={total}/>
    <output id="audio-telemetry" className="sr-only" data-ready={audioStatus.ready} data-playing={audioStatus.playing} data-played={audioStatus.played} data-voices={audioStatus.voices}/>
    <output className="sr-only" id="pilot-telemetry" aria-label="機体の状態" data-x={telemetry.position[0]} data-y={telemetry.position[1]} data-z={telemetry.position[2]} data-grounded={telemetry.grounded} data-yaw={telemetry.yaw} data-speed={telemetry.speed} data-boost={telemetry.boost}>
      {active?'操作中':'一時停止'} / 速度 {(telemetry.speed*3.6).toFixed(1)} km/h
    </output>
    {active&&!controls.locked&&<div className="fallback-note">マウス固定が使えないため、右ドラッグで視点操作できます。Escで一時停止。</div>}
    {!active&&<section className={`deployment ${started?'resuming':''}`} aria-label="出撃メニュー">
      <div className="deployment-card"><span className="eyebrow">STRIX × BASTION / FIELD LAB</span>
        <h1>{won?'MISSION COMPLETE':defeated?'UNIT LOST':started?'SYSTEM PAUSED':'IRON YARD'}</h1><p className="subtitle">{won?`${combatHud.kills}機撃破 · ${missionHud.elapsed.toFixed(1)}秒で防衛成功`:defeated?(missionHud.reason==='timeout'?'制限時間を超過しました':'機体が撃破されました。再出撃で全機をリセット'):started?'操作を再開してください':scene.name}</p>
        <div className="brief"><span>{mode==='combat'?'DEFENSE MISSION':'TARGET PRACTICE'}</span><p>{mode==='combat'?`${scene.mission.timeLimit}秒以内に${scene.mission.waves.length}波・${scene.stage.targets.length}機を撃破。波の突破でAPを200回復。`:'最初の波の静止標的で練習。'}<br/>左クリックで連射。E長押し→離してミサイル。<br/>赤い射撃予告を見て回避。Shiftで高速移動。</p></div>
        <label className="exercise-mode">演習モード<select aria-label="演習モード" value={mode} onChange={e=>{reset(e.target.value);setMode(e.target.value);audio.play('sfx.confirm',.3);}}><option value="combat">敵AIと交戦</option><option value="training">静止標的で練習</option></select></label>
        <button className="deploy-button" onClick={start} disabled={!ready}>{ready?(won?'もう一度出撃する':defeated?'再出撃する':started?'操作を再開':'出撃する'):'機体を読み込み中…'}<span>↗</span></button>
        <div className="audio-settings"><label>BGM<input aria-label="BGM音量" type="range" min="0" max="1" step=".01" value={volumes.music} onChange={e=>setVolumes({...volumes,music:Number(e.target.value)})}/></label><label>効果音<input aria-label="効果音音量" type="range" min="0" max="1" step=".01" value={volumes.effects} onChange={e=>setVolumes({...volumes,effects:Number(e.target.value)})}/></label></div>
        {audioStatus.error&&<p role="alert">{audioStatus.error}<button onClick={()=>void audio.unlock()}>音声を再読み込み</button></p>}
        <p className="hint">クリックでマウスを固定 · Escで解除<br/>固定できない環境では右ドラッグで視点操作</p>
        <div className="menu-footer">{started&&<button onClick={()=>reset()}>出発地点へ戻す</button>}{onExit?<button onClick={()=>{controls.pause();audio.reset();onExit();}}>編集に戻る</button>:<a href="./scene-editor.html">Scene Editor</a>}<a href="./index.html?model=strix">モデルビューアへ</a></div>
        <details className="game-credits"><summary>クレジット・操作</summary><p>モデル・モーション：modeling-playground<br/>BGM「閃光の誓い」・効果音：media-studio<br/>制作：mizchi / Codex<br/>WASD：移動、Space：ジャンプ、Shift：ブースト、Esc：停止</p></details>
        <p className="scope">Space短押し：ジャンプ · 長押し：上昇ブースト<br/>弾数無制限 · ミサイル再装填3秒 · Escから標的をリセット</p>
      </div>
    </section>}
  </main>;
}
