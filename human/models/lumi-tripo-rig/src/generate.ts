import {readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fal} from '@fal-ai/client';
import {RigClient,RIG_MODEL,rigInput} from '../../lumi-meshy-v2/src/client.ts';
import {object,id,assetUrl} from '../../../generation/fal-queue.ts';

const input=new URL('input/',import.meta.url),job=new URL('rig/',input),output=new URL('../output/',import.meta.url);
const missing=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT';
async function publish(file:URL,data:string|Uint8Array){
  const temp=new URL(`.${randomUUID()}.tmp`,file);await writeFile(temp,data,{flag:'wx',mode:0o600});
  try{await link(temp,file);}finally{await unlink(temp);}
}
const json=async(file:URL)=>object(JSON.parse(await readFile(file,'utf8')));
async function main(){
  const command=process.argv[2];
  if(command!=='submit'&&command!=='fetch')throw Error('Use submit --execute --geometry-reviewed or fetch');
  if(command==='submit'&&!process.argv.includes('--execute'))throw Error('Paid request requires --execute');
  if(command==='submit'&&!process.argv.includes('--geometry-reviewed'))throw Error('Rigging requires --geometry-reviewed');
  const key=process.env.FAL_KEY??'',client=new RigClient(key);
  if(command==='submit'){
    const source=await readFile(new URL('../../lumi-tripo/output/lumi-tripo.glb',import.meta.url));
    if(source.length>20*1024*1024||source.readUInt32LE(0)!==0x46546c67)throw Error('Expected small local GLB');
    await mkdir(input,{recursive:true});await mkdir(job,{mode:0o700});
    await publish(new URL('source.json',job),JSON.stringify({version:1,model:RIG_MODEL,
      file:'human/models/lumi-tripo/output/lumi-tripo.glb',sha256:createHash('sha256').update(source).digest('hex'),
      geometryReviewed:true,createdAt:new Date().toISOString(),pricingSnapshot:{unit_price:0.8,unit:'generations',currency:'USD'}},null,2));
    fal.config({credentials:key});
    const modelUrl=assetUrl(await fal.storage.upload(new File([source],'lumi-tripo.glb',{type:'model/gltf-binary'})));
    await publish(new URL('request.json',job),JSON.stringify(rigInput(modelUrl),null,2));
    const requestId=await client.submit(modelUrl);
    console.log(`Accepted Meshy rig: ${requestId}. Do not resubmit.`);
    await publish(new URL('job.json',job),JSON.stringify({version:1,model:RIG_MODEL,requestId},null,2));return;
  }
  const receipt=await json(new URL('job.json',job));if(receipt.version!==1||receipt.model!==RIG_MODEL)throw Error('Invalid receipt');
  const requestId=id(receipt.requestId),status=await client.status(requestId);console.log(status);if(status!=='COMPLETED')return;
  let result:Record<string,unknown>;
  try{result=await json(new URL('result.json',job));}catch(e){if(!missing(e))throw e;result=await client.result(requestId);await publish(new URL('result.json',job),JSON.stringify(result,null,2));}
  await mkdir(output,{recursive:true});
  const animations=object(result.basic_animations??{});
  for(const [name,file] of Object.entries({'lumi-tripo-rig.glb':result.rigged_character_glb,'lumi-tripo-rig-walking.glb':animations.walking_glb})){
    if(!file)throw Error(`Missing ${name}`);const target=new URL(name,output);
    try{await readFile(target);console.log(`Exists ${name}`);continue;}catch(e){if(!missing(e))throw e;}
    const bytes=await client.download(object(file).url);
    if(bytes.length<20||new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB result');
    await publish(target,bytes);console.log(`Saved ${name}: ${bytes.length} bytes`);
  }
}
try{await main();}catch(e){const key=process.env.FAL_KEY,message=e instanceof Error?e.message:'Failed';console.error(key?message.split(key).join('[redacted]'):message);process.exitCode=1;}
