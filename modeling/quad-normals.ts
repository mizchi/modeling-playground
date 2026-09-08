import { Float32BufferAttribute, Vector3 } from 'three';
import type { BufferGeometry } from 'three';

/** Angle-weighted authoring-face normals: independent of triangle diagonals and
 * patch area. sourceVertices welds shading across UV splits, never geometry. */
export function computeQuadNormals(geometry: BufferGeometry,faces: number[][],sourceVertices?: number[]): void {
  const p=geometry.attributes.position,sums=new Map<number,Vector3>();
  const source=(i: number)=>sourceVertices?.[i]??i;
  for(const face of faces){
    const points=face.map(i=>new Vector3().fromBufferAttribute(p,i)),normal=new Vector3();
    for(let k=0;k<points.length;k++)normal.add(points[k].clone().cross(points[(k+1)%points.length]));
    if(normal.lengthSq()<1e-20)continue;
    normal.normalize();
    face.forEach((id,k)=>{
      const current=points[k],prev=points[(k+points.length-1)%points.length].clone().sub(current),next=points[(k+1)%points.length].clone().sub(current);
      if(prev.lengthSq()<1e-20||next.lengthSq()<1e-20)return;
      const key=source(id),sum=sums.get(key)??new Vector3();
      sum.addScaledVector(normal,prev.angleTo(next));sums.set(key,sum);
    });
  }
  for(const sum of sums.values())sum.normalize();
  const values=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++)(sums.get(source(i))??new Vector3()).toArray(values,i*3);
  geometry.setAttribute('normal',new Float32BufferAttribute(values,3));
}
