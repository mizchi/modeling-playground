import { writeFile } from 'node:fs/promises';
import { presetRecipe } from '../human/contract.mjs';
import { createHuman, disposeHuman } from '../human/model.mjs';
import { createMotions } from '../human/motion.mjs';
import { exportGlb } from './export_glb.mjs';

const recipe={...presetRecipe('base45-female'),hair:'lumi-side-tail',face:'lumi'};
const root=createHuman(recipe),bytes=await exportGlb(root,createMotions(root));
await writeFile(new URL('../output/human-side-tail.glb',import.meta.url),new Uint8Array(bytes));
await writeFile(new URL('../output/human-side-tail.recipe.json',import.meta.url),JSON.stringify(recipe,null,2)+'\n');
let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});
console.log(`Yellow side tail: ${triangles} triangles, ${(bytes.byteLength/1024).toFixed(1)} KiB, 3 motion clips`);
disposeHuman(root);
