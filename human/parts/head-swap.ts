import {Vector3} from 'three';

export type Vec3=[number,number,number];
export interface Vertex {position:Vec3;normal:Vec3;uv:[number,number]}
export interface MeshData {vertices:Vertex[];indices:number[]}
export type Segment=[Vertex,Vertex];
const key=(v:Vertex)=>v.position.map(n=>Math.round(n*1e7)).join(',');

function interpolate(a:Vertex,b:Vertex,t:number):Vertex {
  const lerp=(x:number,y:number)=>x+(y-x)*t;
  return {position:a.position.map((n,i)=>lerp(n,b.position[i])) as Vec3,
    normal:new Vector3(...a.normal).lerp(new Vector3(...b.normal),t).normalize().toArray(),
    uv:[lerp(a.uv[0],b.uv[0]),lerp(a.uv[1],b.uv[1])]};
}

/** Clip triangles without modifying vertices/UVs on the retained side. No implicit cap. */
export function clipMesh(source:MeshData,y:number,keep:'below'|'above'):{mesh:MeshData;segments:Segment[]} {
  if(!Number.isFinite(y)||source.indices.length%3)throw Error('Invalid cut');
  const mesh:MeshData={vertices:[],indices:[]},segments:Segment[]=[];
  const inside=(v:Vertex)=>keep==='below'?v.position[1]<=y:v.position[1]>=y;
  for(let i=0;i<source.indices.length;i+=3){
    const triangle=source.indices.slice(i,i+3).map(id=>source.vertices[id]);
    if(triangle.some(v=>!v||v.position.some(n=>!Number.isFinite(n))))throw Error('Invalid triangle');
    const polygon:Vertex[]=[],crossings:Vertex[]=[];
    for(let j=0;j<3;j++){
      const a=triangle[j],b=triangle[(j+1)%3];
      if(inside(a))polygon.push(a);
      if(inside(a)!==inside(b)){
        const intersection=interpolate(a,b,(y-a.position[1])/(b.position[1]-a.position[1]));
        intersection.position[1]=y;polygon.push(intersection);crossings.push(intersection);
      }
    }
    if(crossings.length===2&&key(crossings[0])!==key(crossings[1]))segments.push([crossings[0],crossings[1]]);
    for(let j=1;j+1<polygon.length;j++){
      const tri=[polygon[0],polygon[j],polygon[j+1]];
      const area=new Vector3(...tri[1].position).sub(new Vector3(...tri[0].position)).cross(new Vector3(...tri[2].position).sub(new Vector3(...tri[0].position))).lengthSq();
      if(area<1e-20)continue;
      const start=mesh.vertices.length;mesh.vertices.push(...tri);mesh.indices.push(start,start+1,start+2);
    }
  }
  return {mesh,segments};
}

/** Position-weld only for boundary analysis; preserve texture seams in actual meshes. */
export function neckLoop(segments:Segment[]):Vertex[] {
  const vertices=new Map<string,Vertex>(),adjacent=new Map<string,Set<string>>();
  for(const [a,b] of segments){
    const ka=key(a),kb=key(b);vertices.set(ka,a);vertices.set(kb,b);
    if(ka===kb)continue;
    for(const [from,to] of [[ka,kb],[kb,ka]]){const next=adjacent.get(from)??new Set<string>();next.add(to);adjacent.set(from,next);}
  }
  if(adjacent.size<3||[...adjacent.values()].some(v=>v.size!==2))throw Error('Cut must form one closed neck loop');
  const start=adjacent.keys().next().value!,visited=new Set<string>(),loop:Vertex[]=[];
  let current=start,previous='';
  do{
    if(visited.has(current))throw Error('Invalid closed loop');
    visited.add(current);loop.push(vertices.get(current)!);
    const next=[...adjacent.get(current)!].find(n=>n!==previous)!;previous=current;current=next;
  }while(current!==start);
  if(visited.size!==adjacent.size)throw Error('Cut crosses multiple closed loops (hair or shoulders)');
  return loop;
}

function angularLoop(loop:Vertex[]):{vertex:Vertex;angle:number}[] {
  const center=loop.reduce((sum,v)=>[sum[0]+v.position[0]/loop.length,sum[1]+v.position[2]/loop.length],[0,0]);
  return loop.map(vertex=>({vertex,angle:(Math.atan2(vertex.position[2]-center[1],vertex.position[0]-center[0])+Math.PI*2)%(Math.PI*2)})).sort((a,b)=>a.angle-b.angle);
}

/** Zipper triangulation: connect every vertex of both neck rings, even with unequal counts. */
export function bridgeLoops(lower:Vertex[],upper:Vertex[]):MeshData {
  if(lower.length<3||upper.length<3)throw Error('Neck loops need three vertices');
  const a=angularLoop(lower),b=angularLoop(upper),mesh:MeshData={vertices:[],indices:[]};
  let i=0,j=0;
  const append=(tri:Vertex[])=>{
    const normal=new Vector3(...tri[1].position).sub(new Vector3(...tri[0].position)).cross(new Vector3(...tri[2].position).sub(new Vector3(...tri[0].position))).normalize();
    const center=new Vector3();for(const v of [...lower,...upper])center.add(new Vector3(...v.position));center.divideScalar(lower.length+upper.length);
    const outward=new Vector3(...tri[0].position).sub(center);outward.y=0;
    if(normal.dot(outward)<0){[tri[1],tri[2]]=[tri[2],tri[1]];normal.negate();}
    const start=mesh.vertices.length;
    // Keep the boundary normals from each source so the strip does not look faceted.
    mesh.vertices.push(...tri.map(v=>({position:[...v.position] as Vec3,normal:[...v.normal] as Vec3,uv:[...v.uv] as [number,number]})));
    mesh.indices.push(start,start+1,start+2);
  };
  while(i<a.length||j<b.length){
    const nextA=i+1<a.length?a[i+1].angle:Infinity,nextB=j+1<b.length?b[j+1].angle:Infinity;
    const av=a[i%a.length].vertex,bv=b[j%b.length].vertex;
    // Bridge samples only existing body skin UVs, never the donor texture atlas.
    const upperVertex={...bv,uv:av.uv};
    if(i<a.length&&(j>=b.length||nextA<=nextB)){
      append([av,a[(i+1)%a.length].vertex,upperVertex]);i++;
    }else{append([av,{...b[(j+1)%b.length].vertex,uv:av.uv},upperVertex]);j++;}
  }
  return mesh;
}
