import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createBastion } from './model.ts';
import { BASTION_SLOTS, DEFAULT_LOADOUT } from './definition.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);
const root=createBastion(),bytes=await exportGlb(root);
await writeFile(new URL('bastion.glb',output),new Uint8Array(bytes));
await writeFile(new URL('bastion.parts.json',output),JSON.stringify({version:1,id:'bastion',units:'meters',forward:'+Z',slots:BASTION_SLOTS,loadout:DEFAULT_LOADOUT},null,2)+'\n');
console.log(`BASTION-06: ${(bytes.byteLength/1024).toFixed(0)} KB; ${BASTION_SLOTS.length} replaceable modules`);
