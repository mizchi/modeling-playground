import { createRaven } from '../models/raven.mjs';
import { exportAsset } from './export_asset.mjs';

const asset=createRaven(),{bones,clips}=asset;
const bytes=await exportAsset(asset,new URL('../output/',import.meta.url));
console.log(`RAVEN-03: ${(bytes.byteLength/1024).toFixed(0)} KB, ${Object.keys(bones).length} bones, ${clips.map(c=>c.name).join(', ')}`);
