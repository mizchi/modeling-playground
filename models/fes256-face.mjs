import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { atlasUV } from '../modeling/pixel-atlas.mjs';
import { FES256_HEAD } from './fes256-head.mjs';
import { createFes256Atlas, FES256_ATLAS, faceUV } from './fes256-texture.mjs';

/** Static curved skin patch. Eyes/mouth exist only in the texture. */
export function createFes256Face() {
  const points=[],uv=[],indices=[],cache=new Map();
  for(const face of FES256_HEAD.faces) {
    if(!face.every(i=>i%13<7)||face.every(i=>i<13)||face.every(i=>i>=52))continue;
    for(const id of face) {
      if(!cache.has(id)) {
        const [x,y,z]=FES256_HEAD.points[id];cache.set(id,points.length/3);
        points.push(x,y-1.05,z+.003);
        uv.push(...atlasUV(FES256_ATLAS.tiles[0].rect,...faceUV(x,y),FES256_ATLAS.size));
      }
      indices.push(cache.get(id));
    }
  }
  const geometry=new BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
  const material=new MeshBasicMaterial({map:createFes256Atlas(),transparent:true,alphaTest:.5,depthWrite:false});
  material.name='Lila expression atlas';
  const mesh=new Mesh(geometry,material);mesh.name='Face';mesh.userData.expressionAtlas=structuredClone(FES256_ATLAS);
  return mesh;
}
