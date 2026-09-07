import { writeFile } from 'node:fs/promises';
import { createBase45Inspection, createFaceCheckTexture } from '../models/base45-inspection.mjs';
import { exportGlb } from './export_glb.mjs';
import { encodeRgbaPng } from './png.mjs';

const root=createBase45Inspection({surface:'eyes'});
await writeFile(new URL('../output/base45-face-check.glb',import.meta.url),new Uint8Array(await exportGlb(root)));
await writeFile(new URL('../output/base45-face-check.png',import.meta.url),encodeRgbaPng(createFaceCheckTexture('eyes').image));
console.log('BASE-45 face check: unchanged head crop, embedded 256px diagnostic eye texture');
