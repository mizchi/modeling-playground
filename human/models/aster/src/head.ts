import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { compactMesh } from '../../../../modeling/compact-mesh.ts';
import { atlasUV } from '../../../../modeling/pixel-atlas.ts';
import { ASTER } from './definition.ts';
import { createAsterAtlas, ASTER_ATLAS, asterFaceUV } from './texture.ts';

// Front-design XY coordinates stay fixed; profile edits change only these Z values.
const columns=[-1,-.7,-.26,0,.26,.7,1];
const sections:[number,number,number[]][]=[
  [1.55,.080,[.110,.165,.178,.180,.178,.165,.110]],
  [1.605,.185,[.150,.235,.250,.258,.250,.235,.150]],
  [1.70,.260,[.200,.267,.276,.294,.276,.267,.200]],
  [1.79,.265,[.205,.270,.274,.289,.274,.270,.205]],
  [1.88,.250,[.198,.268,.273,.280,.273,.268,.198]],
  [1.99,.195,[.140,.210,.226,.230,.226,.210,.140]],
];
const rows=sections.map(([y,w,z])=>columns.map((x,i)=>[x*w,y,z[i]]));
const points=rows.flat(),faces:number[][]=[];
for(let r=0;r<rows.length-1;r++)for(let c=0;c<6;c++) {
  const a=r*7+c;faces.push([a,a+1,a+7],[a+1,a+8,a+7]);
}
export const ASTER_FACE=Object.freeze({rows,points,faces});

// Keep the chin anchor and UV design, but narrow and shorten only the skin.
function shapeSkin(geometry: BufferGeometry) {
  geometry.scale(ASTER.faceScale[0],ASTER.faceScale[1],ASTER.faceScale[2]);
  geometry.translate(0,.01*(1-ASTER.faceScale[1]),0);
  return geometry;
}

export function createAsterHead() {
  const g=new BufferGeometry();g.setIndex(faces.flat());
  g.setAttribute('position',new Float32BufferAttribute(points.flatMap(([x,y,z])=>[x,y-1.54,z]),3));
  g.setAttribute('uv',new Float32BufferAttribute(points.flatMap(([x,y])=>atlasUV(ASTER_ATLAS.tiles[0].rect,...asterFaceUV(x,y),256)),2));
  const face=new Mesh(shapeSkin(g),new MeshBasicMaterial({map:createAsterAtlas()}));
  face.name='Face';face.userData.expressionAtlas=structuredClone(ASTER_ATLAS);
  // Side/back skull shares the exact front boundary: no floating facial overlay.
  const rear=compactMesh(['Head']);
  for(let r=0;r<rows.length-1;r++) {
    const section=(i:number)=>{
      const [y,w]=sections[i],z=-.205*(i===0?.45:i===5?.80:1);
      return [rows[i][0],[-w*1.03,y,-.05],[-w*.7,y,z],[w*.7,y,z],[w*1.03,y,-.05],rows[i][6]];
    };
    const a=section(r),b=section(r+1);
    for(let c=0;c<5;c++)rear.polygon([a[c],b[c],b[c+1],a[c+1]],[c<2?-1:1,0,-1],ASTER.palette.skin,'Head');
    for(const [i,normal] of [[0,[0,-1,0]],[5,[0,1,0]]] satisfies [number,number[]][])if(r===(i===0?0:4))
      rear.polygon([...rows[i],...section(i).slice(1,-1).reverse()],normal,ASTER.palette.skin,'Head');
  }
  const geometry=rear.finish();geometry.translate(0,-1.54,0);
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const skull=new Mesh(shapeSkin(geometry),new MeshBasicMaterial({vertexColors:true}));skull.name='HeadSkin';
  return {face,skull};
}
