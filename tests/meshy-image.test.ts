import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ImageClient,RigClient,imageInput,rigInput} from '../human/models/lumi-meshy-v2/src/client.ts';

test('image stage disables rigging; rig stage only accepts approved CDN geometry',()=>{
  const input=imageInput('data:image/png;base64,aGVsbG8=');
  assert.equal(input.enable_rigging,false);assert.equal(input.should_texture,true);
  assert.equal(input.target_polycount,6000);assert.equal(input.pose_mode,'t-pose');
  assert.throws(()=>imageInput('https://untrusted.example/image.png'));
  assert.throws(()=>rigInput('https://untrusted.example/model.glb'));
  assert.equal(rigInput('https://v3b.fal.media/model.glb').enable_animation,false);
});
test('separate image and rig queues preserve scoped routes and explicit single submissions',async()=>{
  const calls=[];const transport=async(url,options)=>{calls.push({url,options});return Response.json({request_id:'test-id',status:'IN_PROGRESS'});};
  const image=new ImageClient('test-key',transport),rig=new RigClient('test-key',transport);
  await image.submit('data:image/png;base64,aGVsbG8=');await image.status('test-id');
  await rig.submit('https://v3b.fal.media/model.glb');await rig.status('test-id');
  assert.deepEqual(calls.map(c=>c.url),['https://queue.fal.run/meshy/v7/image-to-3d','https://queue.fal.run/meshy/v7/requests/test-id/status','https://queue.fal.run/fal-ai/meshy/rigging','https://queue.fal.run/fal-ai/meshy/requests/test-id/status']);
  assert.equal(calls.filter(c=>c.options.method==='POST').length,2);
  assert.equal(calls[0].options.headers.Authorization,'Key test-key');
  assert.equal(calls[0].options.redirect,'error');
  await image.download('https://v3b.fal.media/model.glb');
  assert.equal(calls[4].options.headers,undefined);
  assert.equal(calls[4].options.redirect,'error');
});

test('queue failures do not retry or expose the API key',async()=>{
  let count=0;
  const client=new ImageClient('test-key',async()=>{count++;throw Error('test-key');});
  await assert.rejects(()=>client.submit('data:image/png;base64,aGVsbG8='),e=>!e.message.includes('test-key'));
  assert.equal(count,1);
  assert.throws(()=>rigInput('https://fal.media@evil.example/a.glb'));
});

test('CLI requires execution permission and a separate geometry-review gate before rigging',()=>{
  const cli=fileURLToPath(new URL('../human/models/lumi-meshy-v2/src/generate.ts',import.meta.url));
  for(const [args,message] of [[['image-submit'],/requires --execute/],[['rig-submit','--execute'],/Inspect the unrigged geometry/]]){
    const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{PATH:process.env.PATH??'',FAL_KEY:'unit-test-key'}});
    assert.equal(result.status,1);assert.match(result.stderr,message);assert.ok(!result.stderr.includes('unit-test-key'));
  }
});
