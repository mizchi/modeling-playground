import { prepareOutput } from '../../../../modeling/output.ts';
import { createStrix } from './model.ts';
import { exportAsset } from '../../../../modeling/export-asset.ts';

const output=await prepareOutput(import.meta.url);
const asset=createStrix();
const bytes=await exportAsset(asset,output);
console.log(`STRIX-04: ${(bytes.byteLength/1024).toFixed(0)} KB; ${Object.keys(asset.bones).length} bones; ${asset.clips.map(c=>c.name).join(', ')}`);
