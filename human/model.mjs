import { MeshStandardMaterial, Vector3 } from 'three';
import { createBase45 } from '../models/base45.mjs';
import { createLumi } from '../models/lumi.mjs';
import { BASE45_BONES } from '../models/base45-definition.mjs';
import { validateRecipe } from './contract.mjs';
import { shapePoint } from './shape.mjs';
import { shapeBodyPoint } from './body.mjs';
import { attachSideTail } from './side-tail.mjs';

/** Adapter boundary: existing authored assets stay untouched. A future topology
 * can supply another adapter without changing the editor's recipe/state layer. */
export function createHuman(input) {
  const recipe=validateRecipe(input);
  const root=recipe.hair!=='none'||recipe.face==='lumi'?createLumi():createBase45();
  const body=root.getObjectByName('BaseBody'),hair=root.getObjectByName('Hair');
  if(hair&&recipe.hair==='none') {
    root.getObjectByName('LumiHairAnchor').removeFromParent();hair.removeFromParent();disposeHuman(hair);
  }
  if(recipe.face==='clay'&&body.material.map) {
    body.material.map.dispose();body.material.dispose();body.material=new MeshStandardMaterial({color:'#b9c5ca',roughness:.86});
  }
  if(recipe.hair==='lumi-side-tail')attachSideTail(root);
  const restPoint=(p,kind)=>shapePoint(shapeBodyPoint(p,recipe.model,kind),recipe.shape,kind);
  const edited=recipe.model==='base45-female'||recipe.rig||Object.values(recipe.shape).some(v=>v!==0);
  if(edited) {
    root.updateMatrixWorld(true);
    const bones=[],rest=new Map(),target=new Map(),rig=new Map(recipe.rig?.bones.map(b=>[b.name,b.position])??[]);
    root.traverse(o=>{if(o.isBone){bones.push(o);rest.set(o.name,o.getWorldPosition(new Vector3()).toArray());}});
    const delta=new Map(BASE45_BONES.map(({name})=>{
      const shaped=restPoint(rest.get(name),'rig');
      return [name,rig.has(name)?rig.get(name).map((v,k)=>v-shaped[k]):[0,0,0]];
    }));
    for(const bone of bones) {
      const p=restPoint(rest.get(bone.name),delta.has(bone.name)?'rig':'hair'),d=delta.get(bone.name)??delta.get('Head');
      target.set(bone.name,p.map((v,k)=>v+d[k]));
    }
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
      for(let i=0;i<p.count;i++) {
        const point=restPoint([p.getX(i),p.getY(i),p.getZ(i)],mesh===body?'body':'hair');
        for(let j=0;j<4;j++) {
          const name=mesh.skeleton.bones[si.getComponent(i,j)].name,d=delta.get(name)??delta.get('Head');
          for(let k=0;k<3;k++)point[k]+=d[k]*sw.getComponent(i,j);
        }
        p.setXYZ(i,...point);
      }
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    });
    for(const bone of bones) {
      // Hair anchor's parent is an identity socket under Head.
      let parent=bone.parent;while(parent&&!parent.isBone)parent=parent.parent;
      const origin=target.get(parent?.name)??[0,0,0];
      bone.position.set(...target.get(bone.name).map((v,k)=>v-origin[k]));
    }
    root.updateMatrixWorld(true);
    root.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.calculateInverses();o.bind(o.skeleton);o.skeleton.update();}});
  }
  const restPositions={};root.traverse(o=>{if(o.isBone)restPositions[o.name]=o.position.toArray();});
  root.name='Human';root.userData={...root.userData,humanRecipe:recipe,humanRestPositions:restPositions};return root;
}

export function exportRig(root) {
  root.updateMatrixWorld(true);
  return {version:1,bones:BASE45_BONES.map(({name,parent})=>({name,parent,position:root.getObjectByName(name).getWorldPosition(new Vector3()).toArray()}))};
}

export function disposeHuman(root) {
  const resources=new Set();
  root.traverse(o=>{
    if(o.geometry)resources.add(o.geometry);
    if(o.skeleton)resources.add(o.skeleton);
    for(const m of [o.material].flat().filter(Boolean)) {
      resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);
    }
  });
  resources.forEach(r=>r.dispose());
}
