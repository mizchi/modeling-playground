import { writeFile } from 'node:fs/promises';
import { createBastion } from '../models/bastion.mjs';
import { BASTION_SLOTS, DEFAULT_LOADOUT } from '../models/bastion-definition.mjs';
import { exportGlb } from './export_glb.mjs';
const root=createBastion(),bytes=await exportGlb(root);
await writeFile(new URL('../output/bastion.glb',import.meta.url),new Uint8Array(bytes));
await writeFile(new URL('../output/bastion.parts.json',import.meta.url),JSON.stringify({version:1,id:'bastion',units:'meters',forward:'+Z',slots:BASTION_SLOTS,loadout:DEFAULT_LOADOUT},null,2)+'\n');
console.log(`BASTION-06: ${(bytes.byteLength/1024).toFixed(0)} KB; ${BASTION_SLOTS.length} replaceable modules`);
