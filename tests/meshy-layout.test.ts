import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

test('Meshy exposes only relaxed v2 models and is independent of the retired v1 source',async()=>{
  const catalog=await readFile('viewer/catalog.ts','utf8');
  const ids=[...catalog.matchAll(/'(lumi-meshy[^']*)':/g)].map(match=>match[1]);
  assert.deepEqual(ids,['lumi-meshy-v2-relaxed','lumi-meshy-v2-walking-relaxed','lumi-meshy-v2-running-relaxed']);
  for(const file of ['client.ts','generate.ts']){
    assert.ok(!(await readFile(`human/models/lumi-meshy-v2/src/${file}`,'utf8')).includes('../../lumi-meshy/'));
  }
  const generate=await readFile('human/models/lumi-meshy-v2/src/generate.ts','utf8');
  const build=await readFile('human/models/lumi-meshy-v2/src/build-relaxed-hands.ts','utf8');
  assert.ok(generate.includes("new URL('./input/',import.meta.url)"));
  assert.ok(build.includes('`./input/${name}.glb`'));
  await assert.rejects(access('human/models/lumi-meshy'),{code:'ENOENT'});
});
