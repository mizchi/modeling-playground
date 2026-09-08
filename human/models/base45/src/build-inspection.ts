import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createBase45Inspection, createFaceCheckTexture } from './inspection.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { encodeRgbaPng } from '../../../../modeling/png.ts';

const output=await prepareOutput(import.meta.url);

const root=createBase45Inspection({surface:'eyes'});
await writeFile(new URL('base45-face-check.glb',output),new Uint8Array(await exportGlb(root)));
await writeFile(new URL('base45-face-check.png',output),encodeRgbaPng(createFaceCheckTexture('eyes').image));
console.log('BASE-45 face check: unchanged head crop, embedded 256px diagnostic eye texture');
