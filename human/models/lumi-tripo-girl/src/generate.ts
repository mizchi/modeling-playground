import {readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {TripoClient,TRIPO_MODEL,tripoInput,modelUrl} from '../../lumi-tripo/src/client.ts';
import {object,id} from '../../../generation/fal-queue.ts';

const input=new URL('input/',import.meta.url),job=new URL('job/',input);
async function publish(file:URL,data:string|Uint8Array){
  const temporary=new URL(`.${randomUUID()}.tmp`,file);await writeFile(temporary,data,{flag:'wx',mode:0o600});
  try{await link(temporary,file);}finally{await unlink(temporary);}
}
const json=async(file:URL)=>object(JSON.parse(await readFile(file,'utf8')));
const missing=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT';
async function main(){
  const command=process.argv[2];
  if(command!=='submit'&&command!=='fetch')throw Error('Use submit --execute or fetch');
  if(command==='submit'&&!process.argv.includes('--execute'))throw Error('Paid request requires --execute');
  const client=new TripoClient(process.env.FAL_KEY??'');
  if(command==='submit'){
    const reference=await readFile(new URL('reference.png',import.meta.url));
    const payload=tripoInput(`data:image/png;base64,${reference.toString('base64')}`);
    await mkdir(input,{recursive:true});await mkdir(job,{mode:0o700});
    const {image_url,...settings}=payload;
    await publish(new URL('request.json',job),JSON.stringify({version:1,model:TRIPO_MODEL,settings,
      sha256:createHash('sha256').update(reference).digest('hex'),reference:'src/reference.png',createdAt:new Date().toISOString()},null,2));
    const requestId=await client.submit(image_url);
    console.log(`Accepted head-only generation: ${requestId}. Do not resubmit.`);
    await publish(new URL('job.json',job),JSON.stringify({version:1,model:TRIPO_MODEL,requestId},null,2));return;
  }
  const receipt=await json(new URL('job.json',job));
  if(receipt.version!==1||receipt.model!==TRIPO_MODEL)throw Error('Invalid job receipt');
  const requestId=id(receipt.requestId),status=await client.status(requestId);
  console.log(status);if(status!=='COMPLETED')return;
  let result:Record<string,unknown>;
  try{result=await json(new URL('result.json',job));}
  catch(e){if(!missing(e))throw e;result=await client.result(requestId);await publish(new URL('result.json',job),JSON.stringify(result,null,2));}
  const target=new URL('head-raw.glb',input);
  try{await readFile(target);console.log('Head already downloaded');return;}catch(e){if(!missing(e))throw e;}
  const data=await client.download(modelUrl(result));
  if(data.length<20||new DataView(data.buffer,data.byteOffset).getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB');
  await publish(target,data);console.log(`Saved head-raw.glb: ${data.length} bytes`);
}
try{await main();}catch(e){const key=process.env.FAL_KEY,message=e instanceof Error?e.message:'Failed';console.error(key?message.split(key).join('[redacted]'):message);process.exitCode=1;}
