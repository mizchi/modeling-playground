import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { createSuzu } from './model.ts';

const output=await prepareOutput(import.meta.url);

const bytes=await exportGlb(createSuzu());
await writeFile(new URL('suzu.glb',output),new Uint8Array(bytes));
console.log(`Suzu: ${(bytes.byteLength/1024).toFixed(0)} KB — generated entirely with Three.js`);
