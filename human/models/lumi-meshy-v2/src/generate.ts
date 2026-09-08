import {readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {ImageClient,RigClient,IMAGE_MODEL,RIG_MODEL} from './client.ts';
import {object,id,assetUrl} from './queue-client.ts';

const output=new URL('./input/',import.meta.url);
async function publish(file:URL,data:string|Uint8Array){
  const temp=new URL(`.${randomUUID()}.tmp`,file);await writeFile(temp,data,{flag:'wx',mode:0o600});
  try{await link(temp,file);}finally{await unlink(temp);}
}
async function json(file:URL){return object(JSON.parse(await readFile(file,'utf8')));}
async function main(){
  const command=process.argv[2];
  if(!['image-submit','image-fetch','rig-submit','rig-fetch'].includes(command))throw Error('Use image-submit --execute, image-fetch, rig-submit --execute --geometry-reviewed, rig-fetch');
  const rig=command.startsWith('rig'),submit=command.endsWith('submit'),model=rig?RIG_MODEL:IMAGE_MODEL;
  if(submit&&!process.argv.includes('--execute'))throw Error('Paid request requires --execute');
  if(rig&&submit&&!process.argv.includes('--geometry-reviewed'))throw Error('Inspect the unrigged geometry before rigging');
  const client=rig?new RigClient(process.env.FAL_KEY??''):new ImageClient(process.env.FAL_KEY??''),directory=new URL(rig?'rig/':'image/',output);
  if(submit){
    let input:string,summary:Record<string,unknown>;
    if(rig){
      const result=await json(new URL('image/result.json',output));input=assetUrl(object(result.model_glb).url);summary={model_url:input,geometryReviewed:true};
    }else{
      const data=await readFile(new URL('reference.png',import.meta.url));if(data.readUInt32BE(0)!==0x89504e47)throw Error('Expected PNG reference');
      input=`data:image/png;base64,${data.toString('base64')}`;summary={reference:'src/reference.png',sha256:createHash('sha256').update(data).digest('hex')};
    }
    await mkdir(output,{recursive:true});await mkdir(directory,{mode:0o700});
    await publish(new URL('request.json',directory),JSON.stringify({version:1,model,...summary},null,2));
    const requestId=await client.submit(input);console.log(`Accepted ${model}: ${requestId}. Do not resubmit.`);
    await publish(new URL('job.json',directory),JSON.stringify({version:1,model,requestId},null,2));return;
  }
  const receipt=await json(new URL('job.json',directory));if(receipt.version!==1||receipt.model!==model)throw Error('Invalid job receipt');
  const status=await client.status(id(receipt.requestId));console.log(status);if(status!=='COMPLETED')return;
  let result:Record<string,unknown>;
  try{result=await json(new URL('result.json',directory));}catch(e){if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;result=await client.result(id(receipt.requestId));await publish(new URL('result.json',directory),JSON.stringify(result,null,2));}
  const basic=result.basic_animations?object(result.basic_animations):{};
  const files:Record<string,unknown>=rig?{'lumi-meshy-v2.glb':result.rigged_character_glb,'lumi-meshy-v2.fbx':result.rigged_character_fbx,'lumi-meshy-v2-walking.glb':basic.walking_glb,'lumi-meshy-v2-running.glb':basic.running_glb}:{'lumi-meshy-v2-unrigged.glb':result.model_glb,'preview.png':result.thumbnail};
  if(!files[rig?'lumi-meshy-v2.glb':'lumi-meshy-v2-unrigged.glb'])throw Error('Required GLB missing from result');
  for(const [name,file] of Object.entries(files)){
    if(!file)continue;const target=new URL(name,output);
    try{await readFile(target);console.log(`Exists: ${name}`);continue;}catch(e){if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;}
    const data=await client.download(object(file).url);
    if(name.endsWith('.glb')&&(data.length<20||new DataView(data.buffer,data.byteOffset).getUint32(0,true)!==0x46546c67))throw Error('Invalid GLB header');
    await publish(target,data);console.log(`Saved ${name}: ${data.length} bytes`);
  }
}
try{await main();}catch(e){const key=process.env.FAL_KEY,message=e instanceof Error?e.message:'Failed';console.error(key?message.split(key).join('[redacted]'):message);process.exitCode=1;}
