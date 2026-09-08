import type { BaseTopology } from '../contracts/base-topology.ts';
import type { Vec3, Weight } from './types.ts';
export type TopologyBuilder = ReturnType<typeof createTopologyBuilder>;
/** Editable polygon data stays independent of Three.js triangulation. */
export function createTopologyBuilder() {
  const data: BaseTopology={version:1,positions:[],faces:[],weights:[],regions:[]};
  const vertex=(p: number[],weights: string | Weight[])=>{data.positions.push(p as Vec3);data.weights.push(typeof weights==='string'?[[weights,1]]:weights);return data.positions.length-1;};
  const face=(indices: number[],region: string)=>{data.faces.push(indices);data.regions.push(region);};
  const bridge=(a: number[],b: number[],region: string,skip: number[]=[])=>{for(let i=0;i<a.length;i++)if(!skip.includes(i))face([a[i],a[(i+1)%a.length],b[(i+1)%b.length],b[i]],region);};
  const cap=(loop: number[],region: string,weights: string | Weight[],point?: Vec3)=>{
    const p=point??[0,1,2].map(k=>loop.reduce((s,i)=>s+data.positions[i][k],0)/loop.length);
    const center=vertex(p as Vec3,weights);
    for(let i=0;i<loop.length;i+=2)face([center,loop[i],loop[(i+1)%loop.length],loop[(i+2)%loop.length]],region);
  };
  return {data,vertex,face,bridge,cap};
}

/** Orient by shared edges, not centroid heuristics (armpits/crotch are concave). */
export function orientTopology(data: BaseTopology): BaseTopology {
  // Panel openings leave their interior vertices unused; remove them before export.
  const used=new Set(data.faces.flat()),remap=new Map<number,number>();
  const positions: Vec3[]=[],weights: Weight[][]=[];
  data.positions.forEach((p,i)=>{if(used.has(i)){remap.set(i,positions.length);positions.push(p);weights.push(data.weights[i]);}});
  data.positions=positions;data.weights=weights;data.faces=data.faces.map(f=>f.map(i=>remap.get(i)!));
  const edges=new Map<string, {f: number; dir: number}[]>();
  data.faces.forEach((face,f)=>face.forEach((a,k)=>{
    const b=face[(k+1)%face.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
    const entries=edges.get(key)??[];entries.push({f,dir:a<b?1:-1});edges.set(key,entries);
  }));
  const adjacent: number[][][]=data.faces.map(()=>[]);
  for(const entries of edges.values()) {
    if(entries.length!==2)throw new Error('Open/nonmanifold authoring edge');
    const [a,b]=entries;adjacent[a.f].push([b.f,-a.dir*b.dir]);adjacent[b.f].push([a.f,-a.dir*b.dir]);
  }
  const signs=new Map([[0,1]]),queue=[0];
  for(const f of queue)for(const [next,relative] of adjacent[f]) {
    const sign=signs.get(f)!*relative;
    if(!signs.has(next)){signs.set(next,sign);queue.push(next);}
    else if(signs.get(next)!==sign)throw new Error('Non-orientable authoring surface');
  }
  if(signs.size!==data.faces.length)throw new Error('Disconnected authoring surface');
  data.faces.forEach((f,i)=>{if(signs.get(i)!<0)f.reverse();});
  let volume=0;
  for(const f of data.faces)for(let i=1;i<f.length-1;i++) {
    const [a,b,c]=[f[0],f[i],f[i+1]].map(k=>data.positions[k]);
    volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  }
  if(volume<0)data.faces.forEach(f=>f.reverse());
  return data;
}

export function topologyToObj(data: BaseTopology): string {
  const lines=['# BASE-45 | meters, Y-up, +Z forward | editable quads','o Base45'];
  for(const p of data.positions)lines.push('v '+p.map(v=>Number(v.toFixed(6))).join(' '));
  let region: string | undefined;
  data.faces.forEach((f,i)=>{if(data.regions[i]!==region){region=data.regions[i];lines.push('g '+region);}lines.push('f '+f.map(v=>v+1).join(' '));});
  return lines.join('\n')+'\n';
}
