import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {clipMesh,neckLoop,bridgeLoops} from '../../../parts/head-swap.ts';
import type {Vertex} from '../../../parts/head-swap.ts';
import {readStaticGlb,writeStaticGlb,transformMesh} from '../../../parts/static-glb.ts';
import {fit} from './fit.ts';

const output=new URL('../output/',import.meta.url);
const center=(loop:Vertex[],axis:number)=>(Math.min(...loop.map(v=>v.position[axis]))+Math.max(...loop.map(v=>v.position[axis])))/2;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const bodyBytes=await readFile(new URL('../../lumi-tripo/output/lumi-tripo.glb',import.meta.url));
const headBytes=await readFile(new URL('input/head-raw.glb',import.meta.url));
const body=readStaticGlb(bodyBytes),head=readStaticGlb(headBytes);
const bodyCut=clipMesh(body.mesh,fit.bodyCutY,'below'),bodyLoop=neckLoop(bodyCut.segments);
const rawHeadCut=clipMesh(head.mesh,fit.headCutY,'above');
const rawHeadLoop=neckLoop(rawHeadCut.segments);
const top=Math.max(...head.mesh.vertices.map(v=>v.position[1]));
const scale=(fit.headTopY-fit.bodyCutY-fit.bridgeHeight)/(top-fit.headCutY);
const oriented=transformMesh(rawHeadCut.mesh,scale,fit.headYaw,[0,0,0]);
const orientedLoop=transformMesh({vertices:rawHeadLoop,indices:[]},scale,fit.headYaw,[0,0,0]).vertices;
const offset:[number,number,number]=[
  center(bodyLoop,0)-center(orientedLoop,0),
  fit.bodyCutY+fit.bridgeHeight-fit.headCutY*scale,
  center(bodyLoop,2)-center(orientedLoop,2),
];
const fittedHead=transformMesh(oriented,1,0,offset);
const fittedLoop=transformMesh({vertices:orientedLoop,indices:[]},1,0,offset).vertices;
// Match donor neck thickness only near the cut, keeping face and hair unchanged.
const span=(loop:Vertex[],axis:number)=>Math.max(...loop.map(v=>v.position[axis]))-Math.min(...loop.map(v=>v.position[axis]));
const neckScale=[span(bodyLoop,0)/span(fittedLoop,0),span(bodyLoop,2)/span(fittedLoop,2)];
const fitNeck=(vertex:Vertex)=>{
  const t=Math.min(1,Math.max(0,(vertex.position[1]-fit.bodyCutY-fit.bridgeHeight)/fit.neckBlendHeight));
  const weight=1-t*t*(3-2*t),sx=1+(neckScale[0]-1)*weight,sz=1+(neckScale[1]-1)*weight;
  vertex.position[0]=center(bodyLoop,0)+(vertex.position[0]-center(bodyLoop,0))*sx;
  vertex.position[2]=center(bodyLoop,2)+(vertex.position[2]-center(bodyLoop,2))*sz;
  vertex.normal=new Vector3(vertex.normal[0]/sx,vertex.normal[1],vertex.normal[2]/sz).normalize().toArray();
};
for(const vertex of fittedHead.vertices)fitNeck(vertex);
for(const vertex of fittedLoop)fitNeck(vertex);
const bridge=bridgeLoops(bodyLoop,fittedLoop);
// The neck crosses UV islands: never interpolate across unrelated atlas regions.
// Sample a known exposed skin point on the front neck for the narrow joining strip.
const neckSkin=bodyLoop.reduce((a,b)=>a.position[2]>b.position[2]?a:b);
for(const vertex of bridge.vertices)vertex.uv=[...neckSkin.uv];
const report={version:1,fit,scale,offset,neckScale,
  sourceSha256:{body:hash(bodyBytes),head:hash(headBytes)},
  triangles:{original:body.mesh.indices.length/3,preservedBody:bodyCut.mesh.indices.length/3,newHead:fittedHead.indices.length/3,neckBridge:bridge.indices.length/3},
  rings:{body:bodyLoop.length,head:fittedLoop.length},
  textureSha256:{body:hash(body.image),head:hash(head.image)},
  limitations:['Static proof of concept; no rig or animation validation','UV seams remain as split vertices','Head fitting is model-specific, not automatic semantic replacement'],
};
const bytes=writeStaticGlb([
  {name:'PreservedBody',mesh:bodyCut.mesh,texture:0},
  {name:'FemaleHead',mesh:fittedHead,texture:1},
  {name:'NeckBridge',mesh:bridge,texture:0},
],[body,head],{headSwap:report});
await mkdir(output,{recursive:true});
// Rebuild only this generated derivative; never modify either input model.
await writeFile(new URL('lumi-tripo-girl.glb',output),bytes);
await writeFile(new URL('assembly.json',output),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,bytes:bytes.length},null,2));
