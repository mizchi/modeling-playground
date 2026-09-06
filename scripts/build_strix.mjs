import { createStrix } from '../models/strix.mjs';
import { exportAsset } from './export_asset.mjs';
const asset=createStrix();
const bytes=await exportAsset(asset,new URL('../output/',import.meta.url));
console.log(`STRIX-04: ${(bytes.byteLength/1024).toFixed(0)} KB; ${Object.keys(asset.bones).length} bones; ${asset.clips.map(c=>c.name).join(', ')}`);
