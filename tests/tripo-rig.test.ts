import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Tripo→Meshy CLI refuses paid submission before execute and geometry review',()=>{
  for(const args of [['submit'],['submit','--execute']]){
    const result=spawnSync(process.execPath,['human/models/lumi-tripo-rig/src/generate.ts',...args],{encoding:'utf8'});
    assert.equal(result.status,1);
    assert.match(result.stderr,args.length===1?/requires --execute/:/requires --geometry-reviewed/);
  }
});
