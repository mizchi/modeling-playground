import { isBone, isSkinnedMesh } from '../modeling/scene-objects.ts';
import type { Object3D, Scene, Bone, SkinnedMesh } from 'three';
import type { HumanRecipe, HumanRig } from './contract.ts';
import type { PointKind, HumanPoint } from './shape.ts';
import { disposeModel } from '../modeling/resources.ts';
import { MeshStandardMaterial, Vector3 } from 'three';
import { createBase45 } from './models/base45/src/model.ts';
import { createLumi } from './models/lumi/src/model.ts';
import { BASE45_BONES } from './models/base45/src/definition.ts';
import { validateRecipe } from './contract.ts';
import { shapePoint } from './shape.ts';
import { shapeBodyPoint } from './body.ts';
import { attachSideTail } from './side-tail.ts';
import { applyBodyShape } from './body-shape.ts';
import { applyProportions } from './proportions.ts';
import { computeQuadNormals } from '../modeling/quad-normals.ts';

/** Adapter boundary: existing authored assets stay untouched. A future topology
 * can supply another adapter without changing the editor's recipe/state layer. */
export function createHuman(input: HumanRecipe): Scene {
  const recipe=validateRecipe(input);
  const root=recipe.hair!=='none'||recipe.face==='lumi'?createLumi():createBase45();
  const body=root.getObjectByName('BaseBody') as SkinnedMesh<import('three').BufferGeometry, MeshStandardMaterial>,hair=root.getObjectByName('Hair');
  if(hair&&recipe.hair==='none') {
    root.getObjectByName('LumiHairAnchor')!.removeFromParent();hair.removeFromParent();disposeHuman(hair);
  }
  if(recipe.face==='clay'&&body.material.map) {
    body.material.map.dispose();body.material.dispose();body.material=new MeshStandardMaterial({color:'#b9c5ca',roughness:.86});
  }
  if(recipe.hair==='lumi-side-tail')attachSideTail(root);
  const restPoint=(p: HumanPoint,kind: PointKind): HumanPoint=>{
    const preset=shapeBodyPoint(p,recipe.model,kind);
    const shaped=applyBodyShape(preset,recipe.bodyShape,kind,recipe.model);
    return applyProportions(shapePoint(shaped,recipe.shape,kind),recipe.bodyShape,kind);
  };
  const edited=recipe.model==='base45-female'||recipe.rig||[...Object.values(recipe.shape),...Object.values(recipe.bodyShape)].some(v=>v!==0);
  if(edited) {
    root.updateMatrixWorld(true);
    const bones: Bone[]=[],rest=new Map<string, HumanPoint>(),target=new Map<string, HumanPoint>(),rig=new Map(recipe.rig?.bones.map(b=>[b.name,b.position])??[]);
    root.traverse(o=>{if(isBone(o)){bones.push(o);rest.set(o.name,o.getWorldPosition(new Vector3()).toArray());}});
    const delta=new Map(BASE45_BONES.map(({name})=>{
      const shaped=restPoint(rest.get(name)!,'rig');
      return [name,rig.has(name)?rig.get(name)!.map((v,k)=>v-shaped[k]):[0,0,0]];
    }));
    for(const bone of bones) {
      const p=restPoint(rest.get(bone.name)!,delta.has(bone.name)?'rig':'hair'),d=delta.get(bone.name)??delta.get('Head')!;
      target.set(bone.name,p.map((v,k)=>v+d[k]) as HumanPoint);
    }
    root.traverse(mesh=>{
      if(!isSkinnedMesh(mesh))return;
      const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
      for(let i=0;i<p.count;i++) {
        const point=restPoint([p.getX(i),p.getY(i),p.getZ(i)],mesh===body?'body':'hair');
        for(let j=0;j<4;j++) {
          const name=mesh.skeleton.bones[si.getComponent(i,j)].name,d=delta.get(name)??delta.get('Head')!;
          for(let k=0;k<3;k++)point[k]+=d[k]*sw.getComponent(i,j);
        }
        p.setXYZ(i,...point);
      }
      p.needsUpdate=true;
      if(mesh===body)computeQuadNormals(g,mesh.userData.quadTopology.faces,mesh.userData.sourceVertices);
      else g.computeVertexNormals();
      g.computeBoundingBox();g.computeBoundingSphere();
    });
    for(const bone of bones) {
      // Hair anchor's parent is an identity socket under Head.
      let parent=bone.parent;while(parent&&!isBone(parent))parent=parent.parent;
      const origin=target.get(parent?.name ?? '')??[0,0,0];
      bone.position.fromArray(target.get(bone.name)!.map((v,k)=>v-origin[k]));
    }
    root.updateMatrixWorld(true);
    root.traverse(o=>{if(isSkinnedMesh(o)){o.skeleton.calculateInverses();o.bind(o.skeleton);o.skeleton.update();}});
  }
  const restPositions: Record<string, HumanPoint>={};root.traverse(o=>{if(isBone(o))restPositions[o.name]=o.position.toArray();});
  root.name='Human';root.userData={...root.userData,humanRecipe:recipe,humanRestPositions:restPositions};return root;
}

export function exportRig(root: Object3D): HumanRig {
  root.updateMatrixWorld(true);
  return {version:1,bones:BASE45_BONES.map(({name,parent})=>({name,parent,position:root.getObjectByName(name)!.getWorldPosition(new Vector3()).toArray()}))};
}

export function disposeHuman(root: Object3D): void {
  disposeModel(root);
}
