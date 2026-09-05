import { Mesh, BoxGeometry, Shape, Vector2, Vector3, ExtrudeGeometry } from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

/** Named rigid parts attached in bone-local space; no character-specific dimensions. */
export function rigidPrimitives(bones,{bevelSize=.009,bevelThickness=.008}={}) {
  const add=(parent,name,geometry,material,at=[0,0,0])=>{
    if(!bones[parent])throw new Error(`Unknown part parent ${parent}`);
    const mesh=new Mesh(geometry,material);mesh.name=name;mesh.position.set(...at);bones[parent].add(mesh);return mesh;
  };
  const box=(parent,name,at,size,material)=>add(parent,name,new BoxGeometry(...size),material,at);
  const hull=(parent,name,points,material)=>add(parent,name,new ConvexGeometry(points.map(p=>new Vector3(...p))),material);
  const plate=(parent,name,points,depth,z,material)=>{
    const shape=new Shape(points.map(p=>new Vector2(...p)));
    const geometry=new ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize,bevelThickness});
    geometry.translate(0,0,z-depth/2);return add(parent,name,geometry,material);
  };
  return {add,box,hull,plate};
}
