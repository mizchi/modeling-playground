import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {TripoClient,tripoInput,modelUrl} from '../human/models/lumi-tripo/src/client.ts';
import {orientTripoGlb} from '../human/models/lumi-tripo/src/orient.ts';
import {readFileSync,existsSync} from 'node:fs';

test('Tripo uses standard textured triangles with a 6000-face target',()=>{
  const input=tripoInput('data:image/png;base64,aGVsbG8=');
  assert.equal(input.face_limit,6000);
  assert.equal(input.texture,true);
  assert.equal(input.quad,false);
  assert.equal(input.geometry_quality,'standard');
  assert.equal(input.texture_quality,'standard');
  assert.throws(()=>tripoInput('https://example.com/ref.png'));
  assert.equal(modelUrl({model_urls:{glb:{url:'https://v3b.fal.media/a.glb'}}}),'https://v3b.fal.media/a.glb');
  assert.equal(modelUrl({model_mesh:{url:'https://fal.media/a.glb'}}),'https://fal.media/a.glb');
  assert.throws(()=>modelUrl({model_mesh:{url:'https://evil.example/a.glb'}}));
});

test('Tripo uses fal auth, scoped queue polling and never retries paid submissions',async()=>{
  const calls=[];
  const client=new TripoClient('test-key',async(url,options)=>{
    calls.push({url,options});return Response.json({request_id:'test-id',status:'IN_PROGRESS'});
  });
  await client.submit('data:image/png;base64,aGVsbG8=');
  await client.status('test-id');await client.result('test-id');
  assert.deepEqual(calls.map(c=>c.url),[
    'https://queue.fal.run/tripo3d/h3.1/image-to-3d',
    'https://queue.fal.run/tripo3d/h3.1/requests/test-id/status',
    'https://queue.fal.run/tripo3d/h3.1/requests/test-id',
  ]);
  assert.equal(calls[0].options.headers.Authorization,'Key test-key');
  assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
  let attempts=0;
  const failing=new TripoClient('secret',async()=>{attempts++;throw Error('secret');});
  await assert.rejects(()=>failing.submit('data:image/png;base64,aGVsbG8='),e=>!e.message.includes('secret'));
  assert.equal(attempts,1);
});

test('Tripo CLI requires explicit paid execution',()=>{
  const result=spawnSync(process.execPath,['human/models/lumi-tripo/src/generate.ts','submit'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/requires --execute/);
});

test('local orientation preserves binary mesh and maps Tripo +X forward to viewer +Z',()=>{
  const path='human/models/lumi-tripo/src/input/lumi-tripo-raw.glb';
  if(!existsSync(path))return;
  const raw=readFileSync(path),output=orientTripoGlb(raw);
  const parse=b=>JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  const before=parse(raw),after=parse(output),root=after.nodes.at(-1);
  assert.deepEqual(root.children,before.scenes[0].nodes);
  assert.deepEqual(after.scenes[0].nodes,[after.nodes.length-1]);
  assert.ok(Math.abs(root.rotation[1]+Math.SQRT1_2)<1e-10);
  assert.ok(Math.abs(root.rotation[3]-Math.SQRT1_2)<1e-10);
  assert.deepEqual(output.subarray(20+output.readUInt32LE(12)),raw.subarray(20+raw.readUInt32LE(12)));
  assert.deepEqual(after.meshes,before.meshes);
  assert.throws(()=>orientTripoGlb(output),/already/);
  assert.throws(()=>orientTripoGlb(Buffer.from('invalid')));
});
