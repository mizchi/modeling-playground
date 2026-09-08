import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createAshley } from './model.ts';
import { createAshleyAtlas } from './texture.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';
import { encodeRgbaPng } from '../../../../modeling/png.ts';
import { inspectModel } from '../../../../viewer/model.ts';

const output=await prepareOutput(import.meta.url);

const root=createAshley(),bytes=await exportGlb(root);
await Promise.all([
  writeFile(new URL('ashley.glb',output),new Uint8Array(bytes)),
  writeFile(new URL('ashley-atlas.png',output),encodeRgbaPng(createAshleyAtlas().image)),
]);
console.log(`Ashley: ${inspectModel(root).triangles} triangles / ${(bytes.byteLength/1024).toFixed(0)} KB / embedded 256×256 PNG`);
