import { prepareOutput } from '../../../../modeling/output.ts';
import { writeFile } from 'node:fs/promises';
import { createBase45, createBase45Topology } from './model.ts';
import { BASE45_BONES } from './definition.ts';
import { topologyToObj } from '../../../../modeling/quad-topology.ts';
import { exportGlb } from '../../../../modeling/export-glb.ts';

const output=await prepareOutput(import.meta.url);

const data=createBase45Topology(),bytes=new Uint8Array(await exportGlb(createBase45()));
await writeFile(new URL('base45.glb',output),bytes);
await writeFile(new URL('base45.obj',output),topologyToObj(data));
await writeFile(new URL('base45.topology.json',output),JSON.stringify({...data,bones:BASE45_BONES,units:'meters',up:'+Y',forward:'+Z',headOrigin:[0,1.76,0]},null,2)+'\n');
console.log(`BASE-45: ${data.positions.length} vertices / ${data.faces.length} quads / ${data.faces.reduce((s,f)=>s+f.length-2,0)} triangles; ${(bytes.length/1024).toFixed(1)} KiB; ${BASE45_BONES.length} bones`);
