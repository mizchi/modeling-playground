import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Baseline: 27aaf9a, before extracting authoring/runtime and adding plain sockets.
// Deliberate art edits may update these; structural refactors must not change them.
test('Raven refactor preserves every rendered mesh, material and baked motion sample',async()=>{
  const bytes=await readFile(new URL('../output/raven.glb',import.meta.url));
  const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const meshes=[];
  asset.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    meshes.push({name:mesh.name,
      attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key,a])=>[key,Array.from(a.array)])),
      index:mesh.geometry.index?Array.from(mesh.geometry.index.array):null,
      material:{name:mesh.material.name,color:mesh.material.color.toArray(),metalness:mesh.material.metalness,
        roughness:mesh.material.roughness,emissive:mesh.material.emissive?.toArray()}});
  });
  const clips=asset.animations.map(c=>({name:c.name,duration:c.duration,
    tracks:c.tracks.map(t=>({name:t.name,times:Array.from(t.times),values:Array.from(t.values)}))}));
  assert.equal(hash(meshes.sort((a,b)=>a.name.localeCompare(b.name))),'5fdad5052aef5c1b20724f258a676919300dcb53c2a574a9160ca87fedb2ba74','Rendered geometry/material drift');
  assert.equal(hash(clips),'328a37dfe2ea9ae08a32a5512c572e67fe6f37a361043159f6b9ca78a8ca704c','Baked animation drift');
});
