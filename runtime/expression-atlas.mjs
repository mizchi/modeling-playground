import { atlasUV } from '../modeling/pixel-atlas.mjs';

/** Embedded GLB extras contract. Switching a face changes only UVs. */
export class ExpressionAtlas {
  constructor(mesh) {
    const spec=mesh?.userData?.expressionAtlas;
    if(!spec||spec.version!==1||!Number.isInteger(spec.size)||spec.size<1||spec.size>2048||
      !Array.isArray(spec.tiles)||!spec.tiles.length||!mesh.material?.map||!mesh.geometry?.attributes.uv)
      throw new Error('Invalid expression atlas contract');
    const names=new Set();
    for(const tile of spec.tiles) {
      if(typeof tile.name!=='string'||!tile.name||names.has(tile.name)||!Array.isArray(tile.rect)||tile.rect[2]<2||tile.rect[3]<2)throw new Error('Invalid expression tile');
      atlasUV(tile.rect,0,0,spec.size);names.add(tile.name);
    }
    this.mesh=mesh;this.spec=spec;this.names=[...names];this.name=spec.active??this.names[0];
    const initial=spec.tiles.find(t=>t.name===this.name);
    if(!initial)throw new Error('Unknown initial expression');
    const [x,y,w,h]=initial.rect,uv=mesh.geometry.attributes.uv;
    this.local=Array.from({length:uv.count},(_,i)=>[
      Math.max(0,Math.min(1,(uv.getX(i)*spec.size-x-.5)/(w-1))),
      Math.max(0,Math.min(1,1-(uv.getY(i)*spec.size-y-.5)/(h-1))),
    ]);
  }
  set(name) {
    const tile=this.spec.tiles.find(t=>t.name===name);
    if(!tile)throw new Error(`Unknown expression: ${name}`);
    const uv=this.mesh.geometry.attributes.uv;
    this.local.forEach(([u,v],i)=>uv.setXY(i,...atlasUV(tile.rect,u,v,this.spec.size)));
    uv.needsUpdate=true;this.name=name;this.spec.active=name;
  }
}
