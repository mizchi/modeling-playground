import type { Object3D, Material, ColorRepresentation } from 'three';
export type WyvernMaterials = Record<string,Material>;
import { BufferGeometry, Float32BufferAttribute, Vector3, Color, Mesh, Group } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Closed low-resolution elliptical sections along a polyline: [x,y,z,radiusU,radiusV]. */
export function sweep(rows: number[][],sides=8) {
  const positions=[],indices=[];
  rows.forEach((row,j)=>{
    const center=new Vector3(...row.slice(0,3)),a=rows[Math.max(0,j-1)],b=rows[Math.min(rows.length-1,j+1)];
    const tangent=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
    const u=new Vector3(...(Math.abs(tangent.x)<.85?[1,0,0]:[0,0,1]));
    u.addScaledVector(tangent,-u.dot(tangent)).normalize();const v=tangent.clone().cross(u);
    for(let k=0;k<sides;k++) {
      const angle=k/sides*Math.PI*2;
      positions.push(...center.clone().addScaledVector(u,Math.cos(angle)*row[3]).addScaledVector(v,Math.sin(angle)*row[4]));
      if(j>0){const a=(j-1)*sides+k,b=j*sides+k,c=(j-1)*sides+(k+1)%sides,d=j*sides+(k+1)%sides;indices.push(a,c,b,c,d,b);}
    }
  });
  for(const end of [0,rows.length-1]) {
    const center=positions.length/3;positions.push(...rows[end].slice(0,3));
    for(let k=0;k<sides;k++){const a=end*sides+k,b=end*sides+(k+1)%sides;indices.push(...(end===0?[center,b,a]:[center,a,b]));}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();return flat;
}

export function triangles(vertices: number[][],indices: number[]) {
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(indices.flatMap(i=>vertices[i]),3));
  geometry.computeVertexNormals();return geometry;
}

/** Merge by material within each semantic part: small draw-call count without losing focus groups. */
export function part(root: Object3D,name: string,materials: WyvernMaterials) {
  const group=new Group();group.name=name;group.userData.focusTarget=true;root.add(group);
  const buckets=new Map<string,BufferGeometry[]>();let serial=0;
  return {
    group,
    add(geometry: BufferGeometry,color: ColorRepresentation,key='hide',shade: ((point:number[])=>ColorRepresentation) | null=null) {
      const p=geometry.attributes.position,n=geometry.attributes.normal,colors=[];
      for(let i=0;i<p.count;i+=3) {
        const center=[0,1,2].map(axis=>(p.array[i*3+axis]+p.array[(i+1)*3+axis]+p.array[(i+2)*3+axis])/3);
        const tint=new Color(shade?.(center)??color);
        const variation=.94+.06*((Math.sin((serial++ +1)*78.233)*43758.5453)%1+1)/2;
        tint.multiplyScalar(variation);
        for(let k=0;k<3;k++)colors.push(tint.r,tint.g,tint.b);
      }
      geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
      if(name.endsWith('Wing')) {
        // Authoring-only region tag: keep arm and thumb out of membrane-rib skinning.
        geometry.setAttribute('wingSurface',new Float32BufferAttribute(new Float32Array(p.count).fill(geometry.userData.wingSurface?1:0),1));
      }
      if(!n)geometry.computeVertexNormals();
      if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(geometry);
    },
    finish() {
      for(const [key,list] of buckets) {
        const combined=mergeGeometries(list,false)!,mesh=new Mesh(combined,materials[key]);mesh.name=`${name}_${key}`;
        group.add(mesh);list.forEach(g=>g.dispose());
      }
      return group;
    },
  };
}

/** Four-point ridged plate: thickness and faceted highlight, not a decal. */
export function plate(points: number[][],lift=.05) {
  const a=new Vector3(...points[0]),b=new Vector3(...points[1]),c=new Vector3(...points[2]);
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const center=points.reduce((p,q)=>p.add(new Vector3(...q)),new Vector3()).multiplyScalar(1/points.length).addScaledVector(normal,lift);
  return triangles([...points,center.toArray()],points.flatMap((_,i)=>[i,(i+1)%points.length,points.length]));
}
