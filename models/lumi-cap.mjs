/** Return the oriented outside boundary of a connected patch of quads. */
function boundary(faces) {
  const edges=new Map();
  for(const f of faces)f.forEach((a,i)=>{
    const b=f[(i+1)%f.length],key=[a,b].sort((x,y)=>x-y).join();
    if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
  });
  const next=new Map(edges.values()),first=next.keys().next().value,loop=[];
  let id=first;
  do{
    if(id===undefined||loop.length>edges.size)throw new Error('Invalid hair cap patch');
    loop.push(id);id=next.get(id);
  }while(id!==first);
  return loop;
}

const corners=faces=>{
  const counts=new Map();for(const id of faces.flat())counts.set(id,(counts.get(id)??0)+1);
  return boundary(faces).filter(id=>counts.get(id)===1);
};

/** Hair underlay LOD. Skull-only ear columns and the new dome shoulder must not
 * multiply invisible hair polygons. Retain source vertices/normals and all locks. */
export function lumiCapFaces(data) {
  const selected=data.faces.flatMap((f,i)=>{
    const region=data.regions[i];
    if(!region.startsWith('Head')||region.includes('Ear')||!f.every(v=>data.positions[v][1]>=1.985))return [];
    const front=f.reduce((sum,v)=>sum+data.positions[v][2],0)/f.length>.10;
    return front&&!f.every(v=>data.positions[v][1]>=2.045)?[]:[{f,region}];
  });
  const coarse=[],removed=new Set();
  for(let i=0;i<selected.length;i++){
    const {f,region}=selected[i];
    if(region.endsWith('Postauricular')){
      const patch=selected.slice(i,i+3);
      if(patch.length!==3||patch.some(p=>p.region!==region))throw new Error('Incomplete posterior scalp strip');
      const faces=patch.map(p=>p.f),quad=corners(faces);
      for(const id of faces.flat())if(!quad.includes(id))removed.add(id);
      coarse.push(quad);i+=2;
    }else coarse.push(f);
  }
  const apex=data.positions.findIndex(p=>Math.abs(p[1]-2.20)<1e-8);
  const cap=coarse.filter(f=>f.includes(apex)),rim=boundary(cap).filter(id=>!removed.has(id));
  const faces=coarse.filter(f=>!f.includes(apex));
  for(let i=0;i<rim.length;i+=2)faces.push([apex,rim[i],rim[(i+1)%rim.length],rim[(i+2)%rim.length]]);
  const shoulder=id=>data.positions[id][1]>2.13&&data.positions[id][1]<2.17;
  const partners=new Map(),skip=new Set(),result=[];
  faces.forEach((f,i)=>f.forEach((a,k)=>{
    const b=f[(k+1)%f.length];if(!shoulder(a)||!shoulder(b))return;
    const key=[a,b].sort((x,y)=>x-y).join();
    if(partners.has(key)){
      const other=partners.get(key);skip.add(other);skip.add(i);result.push(corners([faces[other],f]));
    }else partners.set(key,i);
  }));
  result.push(...faces.filter((_,i)=>!skip.has(i)));
  if(result.some(f=>f.length!==4))throw new Error('Hair cap LOD must retain quads');
  return result;
}
