import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {retargetWorldRotation,groundOffset} from '../motion/retarget/meshy.ts';
import {appendClips} from '../modeling/animation-glb.ts';
import {GlbEditor} from '../modeling/glb-editor.ts';
import {existsSync,readFileSync} from 'node:fs';
import validator from 'gltf-validator';
import {createHash} from 'node:crypto';

test('rest-space conversion preserves a nonidentity target bind rotation',()=>{
  const sourceRest=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4);
  const targetRest=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),1.2);
  const result=retargetWorldRotation(sourceRest,sourceRest,targetRest);
  assert.ok(result.angleTo(targetRest)<1e-7);
  const delta=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.3);
  assert.ok(retargetWorldRotation(delta.clone().multiply(sourceRest),sourceRest,targetRest).angleTo(delta.clone().multiply(targetRest))<1e-7);
});
test('ground correction preserves source flight clearance instead of pinning every frame to floor',()=>{
  assert.equal(groundOffset(0,-.05),.05);
  assert.ok(Math.abs(groundOffset(.3,.25)-.05)<1e-9);
  assert.equal(groundOffset(-.01,.01),-.01);
  assert.throws(()=>groundOffset(NaN,0));
});

test('baked jump keeps rig geometry, materials and bind data unchanged',async t=>{
  const directory='human/models/lumi-tripo-rig/output/';
  if(!existsSync(directory+'lumi-tripo-jump.glb'))return t.skip('Optional local generated asset');
  const originalBytes=readFileSync(directory+'lumi-tripo-rig.glb'),source=new GlbEditor(originalBytes),output=new GlbEditor(readFileSync(directory+'lumi-tripo-jump.glb'));
  assert.deepEqual(output.binary.subarray(0,source.binary.length),source.binary);
  for(const field of ['meshes','materials','skins','nodes'])assert.deepEqual(output.doc[field],source.doc[field]);
  assert.equal(source.doc.skins[0].joints.length,24);
  for(const mesh of source.doc.meshes)for(const primitive of mesh.primitives){
    const weights=source.read(primitive.attributes.WEIGHTS_0),joints=source.read(primitive.attributes.JOINTS_0);
    assert.equal(weights.length,source.doc.accessors[primitive.attributes.POSITION].count);
    weights.forEach((row,i)=>{
      assert.ok(row.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
      assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-5);
      assert.ok(joints[i].every(j=>Number.isInteger(j)&&j>=0&&j<24));
    });
  }
  const provenance=JSON.parse(readFileSync('human/models/lumi-tripo-rig/src/input/rig/source.json','utf8'));
  assert.equal(createHash('sha256').update(readFileSync(provenance.file)).digest('hex'),provenance.sha256,'Original Tripo asset stays unchanged');
  assert.equal(output.doc.animations.length,(source.doc.animations?.length??0)+2);
  assert.equal(output.doc.animations[0].name,'HY Jump · contact corrected');
  assert.equal(output.doc.animations[1].name,'HY Jump · raw retarget');
  assert.deepEqual(output.doc.animations.slice(2),source.doc.animations??[]);
  const report=JSON.parse(readFileSync(directory+'jump-report.json','utf8'));
  assert.ok(report.raw.rawSoleMin<-.01,'Raw retarget exposes penetration');
  assert.ok(report.corrected.correctedSoleMin>-.0001);
  assert.ok(report.corrected.peakClearance>.1,'Jump must retain an airborne phase');
  assert.ok(report.corrected.maxVerticalCorrection<.1);
  assert.ok(Math.abs(report.corrected.samples[0].soleY)<.0001,'Standing start must not hover');
  assert.ok(Math.abs(report.corrected.samples.at(-1).soleY)<.0001,'Standing end must not hover');
  assert.ok(report.corrected.samples.every(s=>[s.time,s.soleY,...s.hips,...s.leftFoot,...s.rightFoot].every(Number.isFinite)));
  const result=await validator.validateBytes(new Uint8Array(readFileSync(directory+'lumi-tripo-jump.glb')));
  assert.equal(result.issues.numErrors,0);
  assert.ok(result.issues.messages.filter(m=>m.severity===1).every(m=>m.code==='NODE_SKINNED_MESH_NON_ROOT'));
  assert.throws(()=>appendClips(originalBytes,[{name:'bad',duration:1,tracks:[{node:'Missing',path:'rotation',times:[0],values:[0,0,0,1]}]}]));
  assert.throws(()=>appendClips(originalBytes,[{name:'bad',duration:1,tracks:[{node:'Hips',path:'rotation',times:[0],values:[NaN,0,0,1]}]}]));
});
