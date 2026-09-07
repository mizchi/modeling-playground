import { mkdir, writeFile } from 'node:fs/promises';
import { createBase45, createBase45Topology } from '../models/base45.mjs';
import { BASE45_BONES } from '../models/base45-definition.mjs';
import { topologyToObj } from '../modeling/quad-topology.mjs';
import { exportGlb } from './export_glb.mjs';

const data=createBase45Topology(),bytes=new Uint8Array(await exportGlb(createBase45()));
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/base45.glb',import.meta.url),bytes);
await writeFile(new URL('../output/base45.obj',import.meta.url),topologyToObj(data));
await writeFile(new URL('../output/base45.topology.json',import.meta.url),JSON.stringify({...data,bones:BASE45_BONES,units:'meters',up:'+Y',forward:'+Z',headOrigin:[0,1.76,0]},null,2)+'\n');
console.log(`BASE-45: ${data.positions.length} vertices / ${data.faces.length} quads / ${data.faces.reduce((s,f)=>s+f.length-2,0)} triangles; ${(bytes.length/1024).toFixed(1)} KiB; ${BASE45_BONES.length} bones`);
