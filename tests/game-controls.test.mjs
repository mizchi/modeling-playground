import test from 'node:test';
import assert from 'node:assert/strict';
import { PilotControls } from '../game/controls.ts';

const event=(target,type,values={})=>target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),values));
async function withDom(run) {
  const saved={window:globalThis.window,document:globalThis.document};
  const window=new EventTarget(),document=new EventTarget(),element=new EventTarget();
  document.pointerLockElement=null;document.hidden=false;
  document.exitPointerLock=()=>{document.pointerLockElement=null;event(document,'pointerlockchange');};
  element.requestPointerLock=async()=>{document.pointerLockElement=element;event(document,'pointerlockchange');};
  globalThis.window=window;globalThis.document=document;
  const controls=new PilotControls(),detach=controls.attach(element,()=>{});
  try {await run({controls,window,document,element});}
  finally {detach();for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
}

test('granted pointer lock uses relative motion, accepts movement and weapons, and clears on unlock',()=>withDom(async({controls,window,document,element})=>{
  await controls.start();assert.equal(controls.locked,true);assert.equal(controls.active,true);
  event(window,'mousemove',{movementX:25,movementY:-10,clientX:640,clientY:450});
  assert.equal(controls.yaw,-.06);assert.equal(controls.pitch,.226);
  event(window,'mousemove',{movementX:0,movementY:0,clientX:0,clientY:0});
  assert.equal(controls.yaw,-.06,'Absolute cursor coordinates are irrelevant while locked');
  for(const code of ['KeyW','Space','ShiftLeft','KeyE'])event(window,'keydown',{code});
  event(element,'mousedown',{button:0});
  assert.equal(controls.snapshot().forward,1);assert.equal(controls.snapshot().jump,true);assert.equal(controls.snapshot().boost,true);
  assert.deepEqual(controls.weapons(),{fire:true,lock:true});
  document.exitPointerLock();
  assert.equal(controls.active,false);assert.equal(controls.snapshot().forward,0);
  assert.deepEqual(controls.weapons(),{fire:false,lock:false});
  await controls.start();assert.equal(controls.snapshot().jump,false);assert.equal(controls.weapons().fire,false);
}));

test('denied pointer lock only looks during right drag, with independent fire release and blur cleanup',()=>withDom(async({controls,window,element})=>{
  element.requestPointerLock=()=>Promise.reject(new Error('Denied'));
  await controls.start();assert.equal(controls.locked,false);assert.equal(controls.active,true);
  event(window,'mousemove',{movementX:200,movementY:0});assert.equal(controls.yaw,0);
  event(element,'mousedown',{button:2});event(element,'mousedown',{button:0});
  event(window,'mouseup',{button:0});event(window,'mousemove',{movementX:25,movementY:0});
  assert.equal(controls.yaw,-.06);assert.equal(controls.weapons().fire,false);
  event(window,'mouseup',{button:2});event(window,'mousemove',{movementX:200,movementY:0});
  assert.equal(controls.yaw,-.06);
  event(window,'keydown',{code:'Space'});event(window,'keydown',{code:'KeyE'});event(window,'blur');
  assert.equal(controls.active,false);assert.equal(controls.snapshot().jump,false);assert.equal(controls.weapons().lock,false);
}));
