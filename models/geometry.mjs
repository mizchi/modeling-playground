import * as T from 'three';

/** Small geometry vocabulary. Coordinates are meters, Y up, face toward +Z. */
export function group(parent,name) {
  const node=new T.Group();node.name=name;node.userData.focusTarget=true;parent?.add(node);return node;
}
export function mesh(parent,name,geometry,material) {
  const node=new T.Mesh(geometry,material);node.name=name;parent.add(node);return node;
}
export function ellipsoid(parent,name,at,size,material) {
  const node=mesh(parent,name,new T.SphereGeometry(1,32,24),material);
  node.position.set(...at);node.scale.set(...size);return node;
}
export function line(parent,name,points,radius,material) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return mesh(parent,name,new T.TubeGeometry(curve,Math.max(12,points.length*6),radius,8,false),material);
}
export function segment(parent,name,a,b,r1,r2,material) {
  const av=new T.Vector3(...a),bv=new T.Vector3(...b);
  const node=mesh(parent,name,new T.CylinderGeometry(r2,r1,av.distanceTo(bv),24),material);
  node.position.copy(av).add(bv).multiplyScalar(.5);
  node.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return node;
}

/** Elliptical rings [y, radiusX, radiusZ, centerZ]; optional radial pleats. */
export function loft(parent,name,rings,material,{segments=64,pleats=0,amplitude=0,frontPower=1}={}) {
  const vertices=[],indices=[];
  rings.forEach(([y,rx,rz,cz=0],row)=>{
    for(let i=0;i<=segments;i++) {
      const a=i/segments*Math.PI*2;
      const wave=1+amplitude*Math.cos(a*pleats);
      const sin=Math.sin(a);
      vertices.push(rx*Math.cos(a)*wave,y,cz+rz*Math.sign(sin)*Math.abs(sin)**frontPower*wave);
      if(row && i<segments) {
        const b=row*(segments+1)+i,a=b-segments-1;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  });
  // End caps are separate fans, avoiding a collapsed ring's zero-area triangles.
  for(const [row,reverse] of [[0,true],[rings.length-1,false]]) {
    const [y,,,cz=0]=rings[row],center=vertices.length/3;
    vertices.push(0,y,cz);
    for(let i=0;i<segments;i++) {
      const a=row*(segments+1)+i;
      indices.push(...(reverse?[center,a,a+1]:[center,a+1,a]));
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(parent,name,geometry,material);
}

/** Closed, tapered hair lock with a softly ridged front, not a stack of balls. */
export function lock(parent,name,points,widths,depth,material) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const vertices=[],indices=[],steps=24,sides=12;
  for(let j=0;j<=steps;j++) {
    const t=j/steps,p=curve.getPoint(t),f=t*(widths.length-1),i=Math.min(Math.floor(f),widths.length-2);
    const w=T.MathUtils.lerp(widths[i],widths[i+1],f-i);
    for(let k=0;k<=sides;k++) {
      const a=k/sides*Math.PI*2;
      vertices.push(p.x+w*Math.cos(a),p.y,p.z+depth*Math.sin(a)*Math.max(.08,w/Math.max(...widths)));
      if(j && k<sides) {const b=j*(sides+1)+k,a=b-sides-1;indices.push(a,a+1,b,a+1,b+1,b);}
    }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(parent,name,geometry,material);
}

export function patch(parent,name,points,material,zAt,{subdivisions=0}={}) {
  const shape=new T.Shape();shape.moveTo(...points[0]);
  for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
  let geometry=new T.ShapeGeometry(shape,24);
  // Boundary-only triangulation sinks into a convex face. Subdivide in 2D first,
  // then project every new vertex, so the interior follows the same surface.
  if(subdivisions) {
    const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;
    for(let step=0;step<subdivisions;step++) {
      const source=geometry.attributes.position,next=[];
      for(let i=0;i<source.count;i+=3) {
        const a=new T.Vector3().fromBufferAttribute(source,i),b=new T.Vector3().fromBufferAttribute(source,i+1),c=new T.Vector3().fromBufferAttribute(source,i+2);
        if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<1e-12)continue;
        const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
        for(const p of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])next.push(...p);
      }
      geometry.dispose();geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(next,3));
    }
  }
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setZ(i,zAt(positions.getX(i),positions.getY(i)));
  geometry.computeVertexNormals();return mesh(parent,name,geometry,material);
}

export function ovalPoints(x,y,rx,ry,steps=64) {
  return Array.from({length:steps},(_,i)=>{const t=i/steps*Math.PI*2;return [x+rx*Math.cos(t),y+ry*Math.sin(t)];});
}
