import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateAssetSpec } from '../contracts/asset.mjs';
import { RAVEN_SPEC } from '../models/raven-definition.mjs';
import { createRaven } from '../models/raven.mjs';
import { bindAsset } from '../runtime/asset.mjs';
import { activeWindows, crossedEvents } from '../runtime/timeline.mjs';

test('asset contract is JSON-portable and rejects invalid fields and references',()=>{
  assert.deepEqual(validateAssetSpec(JSON.parse(JSON.stringify(RAVEN_SPEC))),RAVEN_SPEC);
  const invalid=[
    s=>s.version=2,
    s=>s.rig.bones[0].parent='Head',
    s=>s.rig.bones.push({...s.rig.bones[0]}),
    s=>s.sockets[0].bone='Missing',
    s=>s.sockets[0].position=[0,NaN,0],
    s=>s.colliders[0].halfExtents[0]=0,
    s=>s.attacks[0].to='Missing',
    s=>s.emitters[0].direction=[0,0,0],
    s=>s.clips[2].windows[0].end=20,
    s=>s.clips[2].windows[0].id='Missing',
    s=>s.clips[0].fps=0,
    s=>s.unrecognized=true,
  ];
  for(const mutate of invalid) {
    const spec=structuredClone(RAVEN_SPEC);mutate(spec);
    assert.throws(()=>validateAssetSpec(spec),/asset/i);
  }
});

test('timeline handles scrubbing, skipped attack windows and repeat boundaries without side effects',()=>{
  const slash=RAVEN_SPEC.clips.find(c=>c.name==='BladeSlash');
  assert.equal(activeWindows(slash,.59).some(w=>w.kind==='attack'),false);
  assert.equal(activeWindows(slash,.6).some(w=>w.kind==='attack'),true);
  assert.equal(activeWindows(slash,.94).some(w=>w.kind==='attack'),false);
  assert.equal(activeWindows(slash,20).length,0);
  assert.deepEqual(crossedEvents(slash,.5,1).filter(e=>e.kind==='attack').map(e=>[e.time,e.edge]),[[.6,'start'],[.94,'end']]);
  const loop={name:'test',duration:1,mode:'repeat',windows:[{kind:'attack',id:'blade',start:0,end:.25}]};
  assert.deepEqual(crossedEvents(loop,.9,2.3).map(e=>[e.time,e.edge]),[[1,'start'],[1.25,'end'],[2,'start'],[2.25,'end']]);
  assert.equal(activeWindows(loop,2.1).length,1);
  assert.throws(()=>crossedEvents(loop,1,.5),/forward/i);
});

test('sockets, collider transforms and emitter directions follow the rig, without simulating game rules',()=>{
  const {root,bones,clips}=createRaven(),binding=bindAsset(root,clips,RAVEN_SPEC);
  root.position.set(2,1,-3);root.rotation.y=.4;
  const mixer=new AnimationMixer(root),action=mixer.clipAction(clips.find(c=>c.name==='BladeSlash')).play();
  action.time=.78;mixer.update(0);
  const sample=binding.sample('BladeSlash',.78);
  const blade=sample.attacks.find(a=>a.id==='blade-slash');
  assert.equal(blade.active,true);
  assert.ok(blade.to.distanceTo(bones.BladeTip.getWorldPosition(new Vector3()))<1e-6);
  assert.ok(blade.from.distanceTo(blade.to)>1);
  assert.equal(sample.colliders.length,RAVEN_SPEC.colliders.length);
  assert.ok(sample.colliders.every(c=>c.matrix.elements.every(Number.isFinite)));
  assert.equal(sample.emitters.length,4);
  for(const emitter of sample.emitters)assert.ok(Math.abs(emitter.direction.length()-1)<1e-6);
  assert.equal(binding.sample('BladeSlash',1.1).attacks[0].active,false);
  assert.equal(binding.modes.BladeSlash,'once');
  assert.throws(()=>binding.sample('Missing',0),/clip/i);
  mixer.stopAllAction();
  root.getObjectByName(RAVEN_SPEC.sockets[0].node).removeFromParent();
  assert.throws(()=>bindAsset(root,clips,RAVEN_SPEC),/socket/i);
});

test('GLB and sidecar are generated together and bind after reimport',async()=>{
  const spec=JSON.parse(await readFile(new URL('../output/raven.asset.json',import.meta.url),'utf8'));
  assert.deepEqual(spec,RAVEN_SPEC);
  const bytes=await readFile(new URL('../output/raven.glb',import.meta.url));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const binding=bindAsset(asset.scene,asset.animations,spec);
  assert.equal(binding.sample('Hover',.2).attacks[0].active,false);
  const invalid=structuredClone(spec);invalid.clips[2].duration+=.1;
  assert.throws(()=>bindAsset(asset.scene,asset.animations,invalid),/duration/i);
});
