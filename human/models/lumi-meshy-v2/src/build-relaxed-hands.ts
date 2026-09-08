import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {relaxHandsGlb} from './relax-hands.ts';
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
for(const suffix of ['','-walking','-running']){
  const name=`lumi-meshy-v2${suffix}`,source=new URL(`./input/${name}.glb`,import.meta.url),target=new URL(`../output/${name}-relaxed.glb`,import.meta.url);
  await writeFile(target,relaxHandsGlb(await readFile(source)),{flag:'wx'});console.log(`Saved ${target.pathname}`);
}
