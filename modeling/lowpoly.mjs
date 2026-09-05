import { BufferGeometry, Float32BufferAttribute, Mesh, BoxGeometry, Vector3, ShapeUtils, Vector2 } from 'three';
import { atlasUV } from './pixel-atlas.mjs';

/** A small UV-aware geometry vocabulary. No character names or I/O. */
export function texturedGeometry(positions,uvs,indices) {
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  if(indices)geometry.setIndex(indices);
  geometry.computeVertexNormals();return geometry;
}

/** Smooth a continuous skin across UV islands without merging its UV vertices. */
export function computeWeldedNormals(geometry) {
  const position=geometry.attributes.position,index=geometry.index;
  const keys=Array.from({length:position.count},(_,i)=>[position.getX(i),position.getY(i),position.getZ(i)]
    .map(v=>Math.round(v*1e6)).join(','));
  const sums=new Map(keys.map(key=>[key,new Vector3()]));
  for(let i=0;i<(index?.count??position.count);i+=3) {
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(position,id));
    const areaNormal=b.sub(a).cross(c.sub(a));
    for(const id of ids)sums.get(keys[id]).add(areaNormal);
  }
  for(const normal of sums.values())normal.normalize();
  geometry.setAttribute('normal',new Float32BufferAttribute(keys.flatMap(key=>sums.get(key).toArray()),3));
  return geometry;
}

export function lowpolyParts(material,tiles,size=256) {
  const uv=(tile,u,v)=>atlasUV(tiles[tile],u,v,size);
  function add(parent,name,geometry){const mesh=new Mesh(geometry,material);mesh.name=name;parent.add(mesh);return mesh;}
  function remap(geometry,tile) {
    const attribute=geometry.attributes.uv;
    for(let i=0;i<attribute.count;i++)attribute.setXY(i,...uv(tile,attribute.getX(i),attribute.getY(i)));
    return geometry;
  }
  function box(parent,name,at,dimensions,tile) {
    const mesh=add(parent,name,remap(new BoxGeometry(...dimensions),tile));mesh.position.set(...at);return mesh;
  }
  /** Rings: [height, x radius, z radius, z center=0, x center=0]. */
  function loft(parent,name,rings,tile,{sides=8,capBottom=true,capTop=true}={}) {
    const positions=[],uvs=[],indices=[],lo=rings[0][0],hi=rings.at(-1)[0];
    for(let row=0;row<rings.length;row++) {
      const [y,rx,rz,cz=0,cx=0]=rings[row];
      for(let i=0;i<=sides;i++) {
        const a=i/sides*Math.PI*2;positions.push(cx+rx*Math.sin(a),y,cz+rz*Math.cos(a));
        uvs.push(...uv(tile,i/sides,(y-lo)/(hi-lo)));
        if(row&&i<sides){const b=row*(sides+1)+i,a=b-sides-1;indices.push(a,a+1,b,a+1,b+1,b);}
      }
    }
    for(const row of [0,rings.length-1]) {
      if(row===0?!capBottom:!capTop)continue;
      const [y,,,cz=0,cx=0]=rings[row],center=positions.length/3;
      positions.push(cx,y,cz);uvs.push(...uv(tile,.5,row?1:0));
      for(let i=0;i<sides;i++){const a=row*(sides+1)+i;indices.push(...(row?[center,a,a+1]:[center,a+1,a]));}
    }
    return add(parent,name,texturedGeometry(positions,uvs,indices));
  }
  /** An extruded XY outline with per-vertex front Z; suitable for leather panels. */
  function panel(parent,name,points,tile,thickness=.009) {
    const xy=points.map(p=>new Vector2(p[0],p[1]));
    const triangles=ShapeUtils.triangulateShape(xy,[]),positions=[],uvs=[],indices=[];
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
    const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    for(const back of [false,true])for(const [x,y,z] of points) {
      positions.push(x,y,z-(back?thickness:0));uvs.push(...uv(tile,(x-minX)/(maxX-minX),(y-minY)/(maxY-minY)));
    }
    const n=points.length;
    for(let [a,b,c] of triangles) {
      // Front faces point +Z regardless of the outline's input winding.
      if(new Vector2().subVectors(xy[b],xy[a]).cross(new Vector2().subVectors(xy[c],xy[a]))<0)[b,c]=[c,b];
      indices.push(a,b,c,c+n,b+n,a+n);
    }
    const clockwise=ShapeUtils.isClockWise(xy);
    for(let i=0;i<n;i++) {
      let a=i,b=(i+1)%n;if(clockwise)[a,b]=[b,a];
      indices.push(a,a+n,b,b,a+n,b+n);
    }
    return add(parent,name,texturedGeometry(positions,uvs,indices));
  }
  function bar(parent,name,a,b,width,depth,tile) {
    const start=new Vector3(...a),end=new Vector3(...b);
    const mesh=box(parent,name,start.clone().add(end).multiplyScalar(.5).toArray(),[width,start.distanceTo(end),depth],tile);
    mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),end.sub(start).normalize());return mesh;
  }
  /** Piecewise diamond-section locks: angular bend and pointed tip, no spline inflation. */
  function lock(parent,name,points,widths,tile='hair',depth=.018) {
    const positions=[],uvs=[],indices=[];
    const count=points.length-1;
    for(let j=0;j<count;j++) {
      const center=new Vector3(...points[j]),tangent=new Vector3(...points[j+1]).sub(center).normalize();
      let side=new Vector3().crossVectors(tangent,new Vector3(0,0,1)).normalize();
      if(side.lengthSq()<.5)side.set(1,0,0);
      const normal=new Vector3().crossVectors(side,tangent).normalize();
      for(let k=0;k<4;k++) {
        const a=k*Math.PI/2;
        positions.push(...center.clone().addScaledVector(side,widths[j]*Math.cos(a)).addScaledVector(normal,depth*Math.sin(a)));
        uvs.push(...uv(tile,k/3,1-j/count));
        if(j){const b=j*4+k,a=b-4,c=j*4+(k+1)%4;indices.push(a,c-4,b,c-4,c,b);}
      }
    }
    const tip=positions.length/3;positions.push(...points.at(-1));uvs.push(...uv(tile,.5,0));
    for(let k=0;k<4;k++)indices.push((count-1)*4+k,(count-1)*4+(k+1)%4,tip);
    indices.push(0,2,1,0,3,2);
    const mesh=add(parent,name,texturedGeometry(positions,uvs,indices));
    // Lock winding may change as its tangent crosses the crown; closed shape is
    // rendered with the shared double-sided cloth/hair material.
    return mesh;
  }
  return {add,uv,box,loft,panel,bar,lock};
}
