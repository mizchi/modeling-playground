import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createBase45 } from '../models/base45.mjs';
import { setModelWireframe, updateQuadWires } from '../viewer/quad-wire.mjs';

test('quad wire overlay hides triangle diagonals and follows the deformed mesh',()=>{
  const root=createBase45(),skin=root.getObjectByName('BaseBody');
  setModelWireframe(root,true);const wire=skin.getObjectByName('AuthoringEdges');
  assert.ok(wire?.isLineSegments);assert.equal(skin.material.wireframe,false);
  const edges=new Set();for(const f of skin.userData.quadTopology.faces)f.forEach((v,k)=>edges.add([v,f[(k+1)%f.length]].sort((a,b)=>a-b).join(':')));
  assert.equal(wire.geometry.index.count,edges.size*2);
  const before=wire.geometry.attributes.position.array.slice();root.getObjectByName('LeftForearm').rotation.y=-.8;
  updateQuadWires(root);assert.notDeepEqual(wire.geometry.attributes.position.array,before);
  const i=300,p=skin.applyBoneTransform(i,new Vector3().fromBufferAttribute(skin.geometry.attributes.position,i));
  assert.ok(p.distanceTo(new Vector3().fromBufferAttribute(wire.geometry.attributes.position,i))<1e-6);
  setModelWireframe(root,false);assert.equal(wire.visible,false);assert.equal(skin.material.wireframe,false);
  setModelWireframe(root,true);assert.equal(skin.children.filter(n=>n.name==='AuthoringEdges').length,1);
});
