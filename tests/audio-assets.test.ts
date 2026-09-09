import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const audioRoot=new URL('../audio/',import.meta.url);

test('game audio resolves to the migrated originals with preserved IDs and checksums',()=>{
  const manifest=JSON.parse(readFileSync(new URL('game-assets.json',audioRoot),'utf8'));
  assert.equal(manifest.version,1);
  assert.equal(manifest.sourceCommit,'035fe2c');
  assert.deepEqual(manifest.assets.map((a:{id:string})=>a.id),['bgm.battle','sfx.confirm','sfx.cancel','sfx.explosion','sfx.sword','sfx.blunt']);
  for(const asset of manifest.assets) {
    assert.ok(asset.path.startsWith('output/')&&!asset.path.includes('..'));
    const data=readFileSync(new URL(asset.path,audioRoot));
    assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256,asset.id);
    assert.equal(data.toString('ascii',0,4),'RIFF');
  }
});

test('all three accepted songs retain listening, game and editable artifacts',()=>{
  for(const name of ['01-windward-trail-chip','02-windward-trail-acoustic','03-oath-of-the-lightning-battle']) {
    for(const extension of ['mp3','wav','mid','score.json'])assert.ok(readFileSync(new URL(`output/${name}.${extension}`,audioRoot)).length>0);
  }
  assert.ok(readFileSync(new URL('THIRD_PARTY_LICENSES/midi-js-soundfonts.txt',audioRoot),'utf8').length>0);
});
