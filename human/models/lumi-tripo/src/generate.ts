import {readFile,writeFile,mkdir,link,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {TripoClient,TRIPO_MODEL,tripoInput,modelUrl} from './client.ts';
import {object,id} from '../../../generation/fal-queue.ts';
import {orientTripoGlb} from './orient.ts';

const output=new URL('../output/',import.meta.url);
const job=new URL('./input/',import.meta.url);
async function publish(file:URL,data:string|Uint8Array){
  const temp=new URL(`.${randomUUID()}.tmp`,file);
  await writeFile(temp,data,{flag:'wx',mode:0o600});
  try{await link(temp,file);}finally{await unlink(temp);}
}
async function json(file:URL){return object(JSON.parse(await readFile(file,'utf8')));}
function missing(error:unknown){return !!error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT';}

async function main(){
  const command=process.argv[2];
  if(command!=='submit'&&command!=='fetch')throw Error('Use submit --execute or fetch');
  if(command==='submit'&&!process.argv.includes('--execute'))throw Error('Paid request requires --execute');
  const client=new TripoClient(process.env.FAL_KEY??'');
  if(command==='submit'){
    // Share the comparison reference without modifying the Meshy model.
    const data=await readFile(new URL('../../lumi-meshy-v2/src/reference.png',import.meta.url));
    if(data.length<8||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG reference');
    const input=tripoInput(`data:image/png;base64,${data.toString('base64')}`);
    // Existing directory blocks retries, including uncertain network outcomes.
    await mkdir(job,{mode:0o700});
    const {image_url,...settings}=input;
    await publish(new URL('request.json',job),JSON.stringify({version:1,model:TRIPO_MODEL,
      reference:'human/models/lumi-meshy-v2/src/reference.png',sha256:createHash('sha256').update(data).digest('hex'),settings},null,2));
    const requestId=await client.submit(image_url);
    console.log(`Accepted ${TRIPO_MODEL}: ${requestId}. Do not resubmit.`);
    await publish(new URL('job.json',job),JSON.stringify({version:1,model:TRIPO_MODEL,requestId},null,2));
    return;
  }
  const receipt=await json(new URL('job.json',job));
  if(receipt.version!==1||receipt.model!==TRIPO_MODEL)throw Error('Invalid job receipt');
  const requestId=id(receipt.requestId),status=await client.status(requestId);
  console.log(status);if(status!=='COMPLETED')return;
  let result:Record<string,unknown>;
  try{result=await json(new URL('result.json',job));}
  catch(error){if(!missing(error))throw error;result=await client.result(requestId);await publish(new URL('result.json',job),JSON.stringify(result,null,2));}
  const target=new URL('lumi-tripo.glb',output);
  try{await readFile(target);console.log('Already saved: lumi-tripo.glb');return;}
  catch(error){if(!missing(error))throw error;}
  const rawFile=new URL('lumi-tripo-raw.glb',job);
  let raw:Uint8Array;
  try{raw=await readFile(rawFile);}
  catch(error){if(!missing(error))throw error;raw=await client.download(modelUrl(result));await publish(rawFile,raw);}
  const data=orientTripoGlb(raw);
  await mkdir(output,{recursive:true});await publish(target,data);
  console.log(`Saved lumi-tripo.glb: ${data.length} bytes`);
}
try{await main();}
catch(error){const message=error instanceof Error?error.message:'Failed',key=process.env.FAL_KEY;console.error(key?message.split(key).join('[redacted]'):message);process.exitCode=1;}
