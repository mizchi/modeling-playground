import { writeFile } from 'node:fs/promises';
import { presetRecipe } from '../human/contract.mjs';
import { createHuman, exportRig, disposeHuman } from '../human/model.mjs';
import { createBase45Topology } from '../models/base45.mjs';
import { validateBaseTopology } from '../contracts/base-topology.mjs';
import { topologyToObj } from '../modeling/quad-topology.mjs';
import { exportGlb } from './export_glb.mjs';

const root=createHuman(presetRecipe('base45-female')),body=root.getObjectByName('BaseBody');
const data=createBase45Topology(),p=body.geometry.attributes.position;
data.positions=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);validateBaseTopology(data);
const bytes=await exportGlb(root);
await writeFile(new URL('../output/human-female.glb',import.meta.url),new Uint8Array(bytes));
await writeFile(new URL('../output/human-female.obj',import.meta.url),topologyToObj(data).replaceAll('Base45','Base45Female').replace('BASE-45 |','BASE-45 FEMALE |'));
await writeFile(new URL('../output/human-female.topology.json',import.meta.url),JSON.stringify({...data,bones:exportRig(root).bones,units:'meters',up:'+Y',forward:'+Z',humanRecipe:root.userData.humanRecipe},null,2)+'\n');
console.log(`BASE-45 F: ${p.count} vertices / ${data.faces.length} quads / ${body.geometry.index.count/3} triangles; ${(bytes.byteLength/1024).toFixed(1)} KiB; shared 22-bone rig`);
disposeHuman(root);
