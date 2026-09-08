import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {appendClips} from '../../../../modeling/animation-glb.ts';
import {GlbEditor} from '../../../../modeling/glb-editor.ts';
import type {BakedClip} from '../../../../modeling/animation-glb.ts';
import type {RetargetDiagnostics} from '../../../../motion/retarget/meshy.ts';

const output=new URL('../output/',import.meta.url);
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5188/');
  const result:{clips:BakedClip[];raw:RetargetDiagnostics;corrected:RetargetDiagnostics}=await page.evaluate(async()=>{
    const fbxPath:string='/node_modules/three/examples/jsm/loaders/FBXLoader.js';
    const gltfPath:string='/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
    const retargetPath:string='/motion/retarget/meshy.ts';
    const {FBXLoader}:typeof import('three/addons/loaders/FBXLoader.js')=await import(fbxPath);
    const {GLTFLoader}:typeof import('three/addons/loaders/GLTFLoader.js')=await import(gltfPath);
    const {retargetHyToMeshy}:typeof import('../../../../motion/retarget/meshy.ts')=await import(retargetPath);
    const fetchBytes=async(url:string)=>{const response=await fetch(url);if(!response.ok)throw Error(`Missing local input: ${url}`);return response.arrayBuffer();};
    const source=new FBXLoader().parse(await fetchBytes('/motion/output/jump-001/motion.fbx'),'');
    const target=(await new GLTFLoader().parseAsync(await fetchBytes('/human/models/lumi-tripo-rig/output/lumi-tripo-rig.glb'),'')).scene;
    if(source.animations.length!==1)throw Error('Expected one HY jump');
    const raw=retargetHyToMeshy(source,source.animations[0],target,false);
    const corrected=retargetHyToMeshy(source,source.animations[0],target,true);
    const serialize=(clip:import('three').AnimationClip):BakedClip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.map(track=>{
      const [node,property]=track.name.split('.');
      if(property!=='quaternion'&&property!=='position')throw Error('Unsupported property');
      return {node,path:property==='quaternion'?'rotation':'translation',times:Array.from(track.times),values:Array.from(track.values)};
    })});
    return {clips:[serialize(corrected.clip),serialize(raw.clip)],raw:raw.report,corrected:corrected.report};
  });
  const source=await readFile(new URL('lumi-tripo-rig.glb',output));
  await mkdir(output,{recursive:true});
  const baked=new GlbEditor(appendClips(source,result.clips));
  // Keep the provider's clip, but show the corrected jump by default.
  const animations=baked.doc.animations!;
  baked.doc.animations=[...animations.slice(-result.clips.length),...animations.slice(0,-result.clips.length)];
  await writeFile(new URL('lumi-tripo-jump.glb',output),baked.finish());
  await writeFile(new URL('jump-report.json',output),JSON.stringify({raw:result.raw,corrected:result.corrected},null,2));
  await writeFile(new URL('jump-clips.json',output),JSON.stringify(result.clips));
  for(const [name,report] of Object.entries({raw:result.raw,corrected:result.corrected})){
    const {samples,...summary}=report;console.log(name,JSON.stringify(summary));
  }
}finally{await browser.close();}
