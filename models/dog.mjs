import { Scene, Bone, Skeleton, SkinnedMesh, MeshStandardMaterial } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { DOG, dogBones, dogPoint } from './dog-definition.mjs';
export { DOG } from './dog-definition.mjs';

const clamp = x => Math.max(0, Math.min(1, x));
const blend = (a, b, t) => [[a, 1 - clamp(t)], [b, clamp(t)]];

export function createDog(preset = DOG) {
  const root = new Scene(); root.name = preset.name;
  root.userData = { modelId: preset.id, title: preset.title, groundLevel: 0, rigged: true, units: 'meters', version: 1 };
  const definitions = dogBones(preset), bones = new Map(), anchors = new Map(definitions.map(b => [b.name, b.position]));
  for (const definition of definitions) {
    const bone = new Bone(); bone.name = definition.name;
    const origin = anchors.get(definition.parent) ?? [0, 0, 0];
    bone.position.set(...definition.position.map((v, i) => v - origin[i]));
    (bones.get(definition.parent) ?? root).add(bone); bones.set(bone.name, bone);
  }
  let region = 'body';
  const mesh = compactMesh([...bones.keys()], point => dogPoint(preset, region, point)), p = preset.palette;
  // Broad chest, tucked belly and rounded rump: retain volume in side and rear views.
  mesh.loft([[0,.59,-.52,.13,.17],[0,.61,-.37,.235,.235],[0,.63,-.12,.22,.20],
    [0,.63,.16,.255,.245],[0,.66,.38,.25,.26],[0,.68,.50,.15,.20]],8,
    ([x,y,z])=>y<.55||z>.37&&y<.72?p.cream:y>.76?p.back:p.coat,'Body');
  region = 'neck';
  mesh.loft([[0,.65,.39,.19,.20],[0,.86,.46,.22,.22],[0,1.01,.57,.19,.19]],6,
    ([x,y,z])=>z>.49?p.cream:p.coat,([x,y])=>blend('Body','Head',(y-.72)/.25));
  // A clean low-resolution collar is the only accessory.
  mesh.loft([[0,.785,.437,.227,.224],[0,.83,.451,.231,.225]],6,p.collar,
    ([x,y])=>blend('Body','Head',(y-.72)/.25));
  region = 'head';
  mesh.loft([[0,1.01,.36,.17,.19],[0,1.025,.56,.285,.25],[0,1.01,.77,.26,.22],[0,.97,.91,.13,.14]],8,
    ([x,y,z])=>y<.965?p.cream:p.coat,'Head');
  mesh.loft([[0,.945,.82,.18,.13],[0,.925,1.02,.16,.11],[0,.95,1.135,.09,.065]],6,p.cream,'Head');
  mesh.loft([[0,.974,1.117,.092,.053],[0,.967,1.184,.065,.039]],4,p.nose,'Head',Math.PI/4);
  mesh.polygon([[-.067,.901,1.11],[.067,.901,1.11],[.046,.888,1.10],[-.046,.888,1.10]], [0,0,1],p.nose,'Head');
  for (const side of [1,-1]) {
    const m = points => points.map(([x,y,z])=>[side*x,y,z]);
    region = 'ears';
    const ear = m([[.08,1.16,.62],[.30,1.16,.53],[.225,1.38,.51], [.08,1.16,.52],[.30,1.16,.43],[.225,1.38,.44]]);
    mesh.convex(ear,[[0,1,2],[3,5,4],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]],p.coat,'Head');
    mesh.polygon(m([[.13,1.19,.61],[.264,1.19,.557],[.224,1.325,.538]]),[side*.3,0,1],p.ear,'Head');
    region = 'head';
    mesh.polygon(m([[.19,1.125,.885],[.252,1.12,.785],[.252,1.075,.785],[.19,1.078,.885]]),[side,0,1],p.nose,'Head');
    mesh.polygon(m([[.196,1.119,.88],[.207,1.118,.862],[.207,1.106,.862],[.196,1.107,.88]]),[side,0,1],p.cream,'Head');
    mesh.polygon(m([[.172,1.161,.868],[.221,1.155,.809],[.222,1.144,.809],[.178,1.15,.865]]),[side,0,1],p.cream,'Head');
    for (const end of ['Front','Hind']) {
      const name=end+(side===1?'Left':'Right'),z=end==='Front'?.37:-.37,hind=end==='Hind';
      region = hind ? 'hindLeg' : 'frontLeg';
      const rows=[[side*.19,.65,z,.11,.13],[side*.22,.43,z+(hind?.06:0),.09,.09],
        [side*.22,.25,z+(hind?-.025:0),.065,.065],[side*.22,.12,z+(hind?-.08:.01),.06,.06]];
      mesh.loft(rows,5,([x,y])=>y<.25?p.cream:p.coat,([x,y])=>y>.34
        ?blend(`${name}Upper`,`${name}Lower`,(.46-y)/.12):blend(`${name}Lower`,`${name}Paw`,(.20-y)/.08));
      const footZ=z+(hind?-.05:.025);
      const soleHeight = .073 * Math.sqrt(3) / 2;
      region = hind ? 'hindPaw' : 'frontPaw';
      mesh.loft([[side*.22,soleHeight,footZ-.07,.068,.073],[side*.22,soleHeight,footZ+.135,.078,.073]],6,p.cream,`${name}Paw`);
    }
  }
  region = 'tail';
  mesh.loft(preset.tailRows,5,
    ([x,y,z])=>z>-.40?p.cream:p.coat,([x,y])=>blend('TailBase','TailTip',(y-preset.tailBlend[0])/preset.tailBlend[1]));
  const geometry=mesh.finish();
  const material=new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,flatShading:true});material.name=`${preset.meshName} palette`;
  const skin=new SkinnedMesh(geometry,material);skin.name=preset.meshName;skin.frustumCulled=false;root.add(skin);
  root.updateMatrixWorld(true);skin.bind(new Skeleton([...bones.values()]));
  return root;
}
