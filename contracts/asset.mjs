const fail=(path,message)=>{throw new Error(`Asset contract ${path}: ${message}`);};
const fields=(value,keys,path)=>{
  if(!value || typeof value!=='object' || Array.isArray(value))fail(path,'expected object');
  for(const key of keys)if(!Object.hasOwn(value,key))fail(path,`missing ${key}`);
  for(const key of Object.keys(value))if(!keys.includes(key))fail(path,`unknown ${key}`);
};
const list=(value,path)=>{if(!Array.isArray(value)||value.length>512)fail(path,'expected array (max 512)');return value;};
const number=(value,path,min=-Infinity)=>{if(!Number.isFinite(value)||value<min)fail(path,'invalid number');};
const positive=(value,path)=>{number(value,path);if(value<=0)fail(path,'must be positive');};
const vector=(value,path)=>{if(!Array.isArray(value)||value.length!==3)fail(path,'expected xyz');value.forEach(n=>number(n,path));};
const name=(value,path)=>{if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value))fail(path,'invalid identifier');};
const unique=(items,key,path)=>{
  const ids=new Set();
  for(const item of list(items,path)){
    name(item?.[key],path);
    if(ids.has(item[key]))fail(path,`duplicate ${item[key]}`);
    ids.add(item[key]);
  }
  return ids;
};
const reference=(value,ids,path)=>{if(!ids.has(value))fail(path,`missing reference ${value}`);};

/** Runtime boundary for authoring, imported sidecars and the shared runtime. */
export function validateAssetSpec(spec) {
  fields(spec,['version','id','units','coordinateSystem','forward','groundLevel','rig','sockets','colliders','attacks','emitters','clips'],'root');
  if(spec.version!==1 || spec.units!=='meters' || spec.coordinateSystem!=='gltf-y-up' || spec.forward!=='+Z')fail('root','unsupported version or coordinates');
  name(spec.id,'id');number(spec.groundLevel,'groundLevel');
  fields(spec.rig,['bones'],'rig');
  const bones=unique(spec.rig.bones,'name','bones'),ordered=new Set();
  if(!bones.size)fail('rig','requires bones');
  for(const bone of spec.rig.bones) {
    fields(bone,['name','parent','position'],bone.name);vector(bone.position,bone.name);
    // Parent-first ordering is deterministic and also rules out cyclic rigs.
    if(bone.parent!==null)reference(bone.parent,ordered,bone.name);
    ordered.add(bone.name);
  }
  const sockets=unique(spec.sockets,'id','sockets'),nodes=unique(spec.sockets,'node','socket nodes');
  for(const node of nodes)if(bones.has(node))fail(node,'socket node collides with bone name');
  for(const socket of spec.sockets) {
    fields(socket,['id','node','bone','position'],socket.id);
    reference(socket.bone,bones,socket.id);vector(socket.position,socket.id);
  }
  unique(spec.colliders,'id','colliders');
  for(const collider of spec.colliders) {
    fields(collider,['id','bone','shape','center','halfExtents'],collider.id);
    reference(collider.bone,bones,collider.id);
    if(collider.shape!=='box')fail(collider.id,'unsupported collider shape');
    vector(collider.center,collider.id);vector(collider.halfExtents,collider.id);
    collider.halfExtents.forEach(n=>positive(n,collider.id));
  }
  const attacks=unique(spec.attacks,'id','attacks'),emitters=unique(spec.emitters,'id','emitters');
  for(const attack of spec.attacks) {
    fields(attack,['id','from','to','radius'],attack.id);
    reference(attack.from,sockets,attack.id);reference(attack.to,sockets,attack.id);
    if(attack.from===attack.to)fail(attack.id,'requires distinct sockets');
    positive(attack.radius,attack.id);
  }
  for(const emitter of spec.emitters) {
    fields(emitter,['id','socket','direction','preset','rate','lifetime','speed'],emitter.id);
    reference(emitter.socket,sockets,emitter.id);name(emitter.preset,emitter.id);
    vector(emitter.direction,emitter.id);
    if(Math.hypot(...emitter.direction)<1e-8)fail(emitter.id,'direction must be nonzero');
    number(emitter.rate,emitter.id,0);positive(emitter.lifetime,emitter.id);number(emitter.speed,emitter.id,0);
  }
  unique(spec.clips,'name','clips');
  for(const clip of spec.clips) {
    fields(clip,['name','duration','fps','mode','windows'],clip.name);
    positive(clip.duration,clip.name);positive(clip.fps,clip.name);
    if(!Number.isInteger(clip.fps)||clip.fps>240)fail(clip.name,'invalid fps');
    if(!['once','repeat'].includes(clip.mode))fail(clip.name,'invalid loop mode');
    const previous=[];
    for(const window of list(clip.windows,clip.name)) {
      fields(window,['kind','id','start','end'],clip.name);
      if(!['attack','emitter'].includes(window.kind))fail(clip.name,'invalid window kind');
      reference(window.id,window.kind==='attack'?attacks:emitters,clip.name);
      number(window.start,clip.name,0);number(window.end,clip.name,0);
      if(window.start>=window.end || window.end>clip.duration)fail(clip.name,'window outside clip duration');
      if(previous.some(p=>p.kind===window.kind&&p.id===window.id&&p.start<window.end&&window.start<p.end))fail(clip.name,'overlapping windows');
      previous.push(window);
    }
  }
  return spec;
}
