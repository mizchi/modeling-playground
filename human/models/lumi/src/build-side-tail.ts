import type { HumanRecipe } from '../../../contract.ts';
import { isMesh } from '../../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { presetRecipe } from '../../../contract.ts';
import { createHuman, disposeHuman } from '../../../model.ts';
import { createMotions } from '../../../motion.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);

const recipe:HumanRecipe={...presetRecipe('base45-female'),hair:'lumi-side-tail',face:'lumi'};
const root=createHuman(recipe),bytes=await exportGlb(root,createMotions(root));
await writeFile(new URL('human-side-tail.glb',output),new Uint8Array(bytes));
await writeFile(new URL('human-side-tail.recipe.json',output),JSON.stringify(recipe,null,2)+'\n');
let triangles=0;root.traverse(o=>{if(isMesh(o))triangles+=o.geometry.index!.count/3;});
console.log(`Yellow side tail: ${triangles} triangles, ${(bytes.byteLength/1024).toFixed(1)} KiB, 3 motion clips`);
disposeHuman(root);
