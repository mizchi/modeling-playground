export function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid object');return value as Record<string,unknown>;
}
export function id(value:unknown):string{if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(value))throw Error('Invalid request ID');return value;}
export function assetUrl(value:unknown):string{
  if(typeof value!=='string')throw Error('Missing asset URL');const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!(u.hostname==='fal.media'||u.hostname.endsWith('.fal.media')))throw Error('Untrusted asset URL');return u.href;
}
async function bytes(response:Response,limit:number):Promise<Uint8Array>{
  if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
  if(!response.body||Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('Response exceeds limit');}
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>limit){await reader.cancel();throw Error('Response exceeds limit');}parts.push(r.value);}}finally{reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
export abstract class MeshyClient {
  #key:string;#fetch:typeof fetch;
  protected abstract get endpoint():string;
  private get base(){return `https://queue.fal.run/${this.endpoint.split('/').slice(0,2).join('/')}`;}
  constructor(key:string,transport:typeof fetch=fetch){if(!key||/\s/.test(key))throw Error('FAL_KEY required');this.#key=key;this.#fetch=transport;}
  protected async call(url:string,input?:unknown){
    let r:Response;
    try{r=await this.#fetch(url,{method:input?'POST':'GET',headers:{Authorization:`Key ${this.#key}`,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined,redirect:'error',signal:AbortSignal.timeout(30_000)});}
    catch{throw Error('Queue communication failed; do not resubmit an uncertain request');}
    return object(JSON.parse(new TextDecoder().decode(await bytes(r,1024*1024))));
  }
  abstract submit(input:unknown):Promise<string>;
  async status(request:string){
    const r=await this.call(`${this.base}/requests/${id(request)}/status`);
    if(r.error!=null)throw Error('Generation failed; check fal dashboard');
    if(r.request_id!==undefined&&r.request_id!==request)throw Error('Request ID mismatch');
    if(r.status!=='IN_QUEUE'&&r.status!=='IN_PROGRESS'&&r.status!=='COMPLETED')throw Error('Invalid queue status');return r.status;
  }
  async result(request:string){return this.call(`${this.base}/requests/${id(request)}`);}
  async download(url:unknown){
    const safe=assetUrl(url);let r:Response;
    try{r=await this.#fetch(safe,{redirect:'error',signal:AbortSignal.timeout(60_000)});}catch{throw Error('Asset download failed');}
    return bytes(r,128*1024*1024);
  }
}
