import { prepareOutput } from '../../../../modeling/output.ts';
import { createRaven } from './model.ts';
import { exportAsset } from '../../../../modeling/export-asset.ts';

const output=await prepareOutput(import.meta.url);

const asset=createRaven(),{bones,clips}=asset;
const bytes=await exportAsset(asset,output);
console.log(`RAVEN-03: ${(bytes.byteLength/1024).toFixed(0)} KB, ${Object.keys(bones).length} bones, ${clips.map(c=>c.name).join(', ')}`);
