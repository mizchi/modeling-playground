import assert from 'node:assert/strict';
import { defaultScene } from '../../game/studio/document.ts';
import { load_scene } from './_build/js/release/build/scene-bridge.js';
const doc=defaultScene(),root=load_scene(JSON.stringify(doc));
assert.equal(root.isGroup,true);
assert.equal(root.children.length,doc.stage.solids.length+doc.stage.targets.length+1);
assert.deepEqual(root.getObjectByName('spawn').position.toArray(),doc.stage.spawn);
for(const solid of doc.stage.solids) {
  const mesh=root.getObjectByName(solid.id);
  assert.equal(mesh.isMesh,true);
  assert.deepEqual(mesh.position.toArray(),solid.center);
  assert.equal(mesh.geometry.parameters.width,solid.size[0]);
}
assert.throws(()=>load_scene(JSON.stringify({...doc,version:2})));
assert.throws(()=>load_scene('{broken'));
console.log(`MoonBit → mizchi/three: ${root.children.length} scene nodes, transforms and version rejection verified`);
