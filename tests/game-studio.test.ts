import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultScene, DEFAULT_ACTION } from '../game/studio/document.ts';
import { validateSceneDocument, validateAction } from '../game/studio/contracts.ts';
import { createMission, advanceMission } from '../game/studio/mission.ts';
import { createHistory, editHistory, undoHistory, redoHistory } from '../game/studio/history.ts';
import { advanceCombat, createCombat } from '../game/combat.ts';
import { replayAttack } from '../game/studio/preview-simulation.ts';
import { addEntity, removeEntity } from '../game/studio/operations.ts';

test('portable scene roundtrips and rejects corrupt versions, numbers and wave references',()=>{
  const doc=defaultScene();
  assert.deepEqual(validateSceneDocument(JSON.parse(JSON.stringify(doc))),doc);
  for(const change of [(x:any)=>x.version=2,(x:any)=>x.stage.spawn[0]=Infinity,
    (x:any)=>x.mission.waves[1].targets.push('missing'),(x:any)=>x.extra=true,
    (x:any)=>x.stage.targets[0].id=x.stage.targets[1].id]) {
    const bad=structuredClone(doc);change(bad);assert.throws(()=>validateSceneDocument(bad));
  }
  assert.throws(()=>validateAction({...DEFAULT_ACTION,cooldown:0}));
});

test('scene IDs cannot collide with runtime identities or prototype properties',()=>{
  for(const reserved of ['spawn','player','constructor','__proto__','toString']) {
    const doc=defaultScene();doc.stage.targets[0].id=reserved;doc.mission.waves[0].targets[0]=reserved;
    assert.throws(()=>validateSceneDocument(doc));
  }
});

test('mission runs all waves, freezes on pause and ends in victory, defeat or timeout',()=>{
  const doc=defaultScene(),hp=Object.fromEntries(doc.stage.targets.map(t=>[t.id,180]));
  let state=createMission(doc);
  assert.deepEqual(advanceMission(state,1,hp,1000,doc),state);
  state={...state,phase:'playing'};
  for(let wave=0;wave<doc.mission.waves.length;wave++) {
    for(const id of doc.mission.waves[wave].targets) hp[id]=0;
    state=advanceMission(state,1/60,hp,1000,doc);
  }
  assert.equal(state.phase,'won');assert.equal(state.cleared,9);
  assert.equal(advanceMission({...createMission(doc),phase:'playing'},.01,{},0,doc).phase,'lost');
  assert.equal(advanceMission({...createMission(doc),phase:'playing',elapsed:179.99},.1,{},1000,doc).reason,'timeout');
  assert.equal(advanceMission({...state,phase:'paused'},.1,hp,1000,doc).elapsed,state.elapsed);
});

test('editor undo/redo owns snapshots and does not mutate the source document',()=>{
  const initial=defaultScene(),history=createHistory(initial),next=structuredClone(initial);
  next.stage.solids[0].center[0]+=2;
  const edited=editHistory(history,next);
  next.stage.solids[0].center[0]=999;
  assert.equal(edited.present.stage.solids[0].center[0],initial.stage.solids[0].center[0]+2);
  assert.deepEqual(undoHistory(edited).present,initial);
  assert.deepEqual(redoHistory(undoHistory(edited)).present,edited.present);
});

test('combat emits actual shot/hit events even if a projectile is born and collides in one frame',()=>{
  const world={solids:[],targets:[{id:'near',position:[0,0,2] as [number,number,number],yaw:0}]};
  const frame={eye:[0,3,0],forward:[0,0,1],aim:[0,3,2],mounts:{rifle:[0,3,0],missiles:[[0,3,0],[0,3,0]]}} as any;
  const next=advanceCombat(createCombat(world),{fire:true,lock:false},frame,.05,world);
  assert.ok(next.events.some(e=>e.kind==='shot'));
  assert.ok(next.events.some(e=>e.kind==='impact'&&e.entityId==='near'));
  assert.equal(new Set(next.events.map(e=>e.id)).size,next.events.length);
  assert.deepEqual(advanceCombat(next,{fire:false,lock:false,cancel:true},frame,0,world).events,[]);
});

test('attack preview seeking is deterministic, fires once and resolves real target collision',()=>{
  const before=replayAttack(DEFAULT_ACTION,0),after=replayAttack(DEFAULT_ACTION,.5);
  assert.equal(before.shots,0);assert.equal(after.shots,1);assert.equal(after.hits,1);
  assert.equal(after.hp.preview,168);assert.equal(after.events.filter(e=>e.kind==='shot').length,1);
  assert.deepEqual(replayAttack(DEFAULT_ACTION,.5),after);
  assert.equal(replayAttack({...DEFAULT_ACTION,damage:180},.5).kills,1);
});

test('prefab additions own IDs and wave references; deletion preserves minimum wave size',()=>{
  const source=defaultScene(),added=addEntity(source,'enemy',1);
  assert.equal(source.stage.targets.length,9);assert.equal(added.doc.stage.targets.length,10);
  assert.ok(added.doc.mission.waves[1].targets.includes(added.id));
  assert.deepEqual(removeEntity(added.doc,added.id),source);
  const one=removeEntity(removeEntity(source,'B-01'),'B-02');
  assert.throws(()=>removeEntity(one,'B-03'));
});
