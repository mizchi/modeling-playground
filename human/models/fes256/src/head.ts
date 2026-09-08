/** Shared skin topology and attachment surface: front columns track cheeks,
 * eye beds and the nose bridge instead of extruding one broad facial plane. */
const outline=[[-.255,.23],[-.19,.30],[-.055,.30],[0,.32],[.055,.30],[.19,.30],[.255,.23],
  [.32,.045],[.27,-.20],[.14,-.29],[-.14,-.29],[-.27,-.20],[-.32,.045]];
const rows=[
  [1.105,.40,.145,.185,.200],
  [1.16,.72,.205,.265,.275],
  [1.25,1,.240,.305,.318],
  [1.34,1,.225,.305,.329],
  [1.49,.9,.220,.288,.300],
];
const points=rows.flatMap(([y,scale,cheek,eye,nose])=>outline.map(([x,z],i)=>{
  const depth=i===3?nose:i===0||i===6?cheek:i<7?eye:z*scale;
  return [x*scale,y,depth];
}));
const n=outline.length,faces: number[][]=[];
for(let row=1;row<rows.length;row++)for(let i=0;i<n;i++) {
  const a=(row-1)*n+i,b=(row-1)*n+(i+1)%n,c=row*n+i,d=row*n+(i+1)%n;
  faces.push([a,b,c],[b,d,c]);
}
for(const start of [0,(rows.length-1)*n])for(let i=1;i<n-1;i++)faces.push([start,start+i,start+i+1]);
export const FES256_HEAD=Object.freeze({points,faces});

/** Actual triangle interpolation in authoring/world coordinates. */
export function headSurfaceDepth(x: number,y: number) {
  let depth=-Infinity;
  for(const ids of faces) {
    const [a,b,c]=ids.map(i=>points[i]);
    const determinant=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(determinant)<1e-10)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/determinant;
    const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/determinant,w=1-u-v;
    if(Math.min(u,v,w)>=-1e-6)depth=Math.max(depth,u*a[2]+v*b[2]+w*c[2]);
  }
  if(!Number.isFinite(depth))throw new Error(`Facial feature outside skin at ${x}, ${y}`);
  return depth;
}
