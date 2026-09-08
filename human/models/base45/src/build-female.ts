import { requireMesh } from '../../../../modeling/scene-objects.ts';
import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { presetRecipe } from '../../../contract.ts';
import { createHuman, exportRig, disposeHuman } from '../../../model.ts';
import { createBase45Topology } from './model.ts';
import { validateBaseTopology } from '../../../../contracts/base-topology.ts';
import { topologyToObj } from '../../../../modeling/quad-topology.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);

const root=createHuman(presetRecipe('base45-female')),body=requireMesh(root,'BaseBody');
const data=createBase45Topology(),p=body.geometry.attributes.position;
data.positions=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);validateBaseTopology(data);
const bytes=await exportGlb(root);
await writeFile(new URL('human-female.glb',output),new Uint8Array(bytes));
await writeFile(new URL('human-female.obj',output),topologyToObj(data).replaceAll('Base45','Base45Female').replace('BASE-45 |','BASE-45 FEMALE |'));
await writeFile(new URL('human-female.topology.json',output),JSON.stringify({...data,bones:exportRig(root).bones,units:'meters',up:'+Y',forward:'+Z',humanRecipe:root.userData.humanRecipe},null,2)+'\n');
console.log(`BASE-45 F: ${p.count} vertices / ${data.faces.length} quads / ${body.geometry.index!.count/3} triangles; ${(bytes.byteLength/1024).toFixed(1)} KiB; shared 22-bone rig`);
disposeHuman(root);
