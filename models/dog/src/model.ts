import type { BufferGeometry } from 'three';
import type { DogPreset } from './definition.ts';
import type { Point } from '../../../modeling/types.ts';
import type { Weight } from '../../../modeling/types.ts';
import { Scene, Bone, Skeleton, SkinnedMesh, MeshStandardMaterial, Vector3 } from 'three';
import { compactMesh } from '../../../modeling/compact-mesh.ts';
import { DOG, dogBones, dogPoint } from './definition.ts';
export { DOG } from './definition.ts';

const clamp = (x: number)=> Math.max(0, Math.min(1, x));
const blend = (a: string, b: string, t: number): Weight[] => [[a, 1 - clamp(t)], [b, clamp(t)]];

/** Fit enlarged facial marks to the actual faceted skin, not a floating billboard. */
function fitFace(points: readonly Point[], geometry: BufferGeometry, offset: number) {
  const outward = new Vector3(Math.sign(points[0][0]),0,1).normalize();
  const tangent = new Vector3(outward.z,0,-outward.x);
  const flatten = (p: Vector3) => [p.dot(tangent),p.y];
  const edge = (a: number[],b: number[],p: number[]) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const source = points.map(p=>flatten(new Vector3(...p))), result=[];
  const vertices=geometry.attributes.position,indices=geometry.index;
  for(let i=0;i<indices!.count;i+=3) {
    const [a,b,c]=[0,1,2].map(k=>new Vector3().fromBufferAttribute(vertices,indices!.getX(i+k)));
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const facing=normal.dot(outward);
    if(facing<.01)continue;
    const boundary=[a,b,c].map(flatten),winding=Math.sign(edge(boundary[0],boundary[1],boundary[2]));
    let clipped=source;
    // Split marks at each skin triangle: projecting only the corners sinks the
    // middle of a quad through a convex low-poly face.
    for(let e=0;e<3&&clipped.length;e++) {
      const u=boundary[e],v=boundary[(e+1)%3],next=[];
      for(let j=0;j<clipped.length;j++) {
        const p=clipped[j],q=clipped[(j+1)%clipped.length];
        const dp=winding*edge(u,v,p),dq=winding*edge(u,v,q);
        if(dp>=0)next.push(p);
        if((dp>=0)!==(dq>=0)) {
          const t=dp/(dp-dq);next.push(p.map((x,k)=>x+(q[k]-x)*t));
        }
      }
      clipped=next;
    }
    if(clipped.length<3)continue;
    result.push(clipped.map(([u,y])=>{
      const p=tangent.clone().multiplyScalar(u);p.y=y;
      return p.addScaledVector(outward,(normal.dot(a)-normal.dot(p))/facing+offset).toArray();
    }));
  }
  if(!result.length)throw new Error('Facial mark falls outside the head silhouette');
  return result;
}

export function createDog(preset: DogPreset = DOG) {
  const root = new Scene(); root.name = preset.name;
  root.userData = { modelId: preset.id, title: preset.title, groundLevel: 0, rigged: true, units: 'meters', version: 1 };
  const definitions = dogBones(preset), bones = new Map<string,Bone>(), anchors = new Map(definitions.map(b => [b.name, b.position]));
  for (const definition of definitions) {
    const bone = new Bone(); bone.name = definition.name;
    const origin = anchors.get(definition.parent ?? '') ?? [0, 0, 0];
    bone.position.fromArray(definition.position.map((v, i) => v - origin[i]));
    (bones.get(definition.parent??'') ?? root).add(bone); bones.set(bone.name, bone);
  }
  let region = 'body';
  let faceGeometry: BufferGeometry | undefined;
  const mesh = compactMesh([...bones.keys()], point => region === 'projectedFace' ? point : dogPoint(preset,region,point)), p = preset.palette;
  const mark = (points: number[][],normal: number[],color: string,kind: string) => {
    region=kind==='brows'?'head':'eyes';
    if(!faceGeometry) { mesh.polygon(points,normal,color,'Head');return; }
    const mapped=points.map(([x,y,z])=>dogPoint(preset,region,[x,y,z+preset.face!.depthOffset]));
    region='projectedFace';
    for(const polygon of fitFace(mapped,faceGeometry,kind==='glint'?.004:.002))mesh.polygon(polygon,normal,color,'Head');
  };
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
  const headRows=[[0,1.01,.36,.17,.19],[0,1.025,.56,.285,.25],[0,1.01,.77,.26,.22],[0,.97,.91,.13,.14]];
  mesh.loft(headRows,8,
    ([x,y,z])=>y<.965?p.cream:p.coat,'Head');
  if (preset.face) {
    const shell=compactMesh(['Head'],point=>dogPoint(preset,'head',point));
    shell.loft(headRows,8,p.coat,'Head');faceGeometry=shell.finish();
  }
  mesh.loft([[0,.945,.82,.18,.13],[0,.925,1.02,.16,.11],[0,.95,1.135,.09,.065]],6,p.cream,'Head');
  mesh.loft([[0,.974,1.117,.092,.053],[0,.967,1.184,.065,.039]],4,p.nose,'Head',Math.PI/4);
  mesh.polygon([[-.067,.901,1.11],[.067,.901,1.11],[.046,.888,1.10],[-.046,.888,1.10]], [0,0,1],p.nose,'Head');
  for (const side of [1,-1]) {
    const m = (points:number[][]) => points.map(([x,y,z])=>[side*x,y,z]);
    region = 'ears';
    const ear = m([[.08,1.16,.62],[.30,1.16,.53],[.225,1.38,.51], [.08,1.16,.52],[.30,1.16,.43],[.225,1.38,.44]]);
    mesh.convex(ear,[[0,1,2],[3,5,4],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]],p.coat,'Head');
    mesh.polygon(m([[.13,1.19,.61],[.264,1.19,.557],[.224,1.325,.538]]),[side*.3,0,1],p.ear,'Head');
    mark(m([[.19,1.125,.885],[.252,1.12,.785],[.252,1.075,.785],[.19,1.078,.885]]),[side,0,1],p.nose,'eyes');
    mark(m([[.196,1.119,.88],[.207,1.118,.862],[.207,1.106,.862],[.196,1.107,.88]]),[side,0,1],p.cream,'glint');
    mark(m([[.172,1.161,.868],[.221,1.155,.809],[.222,1.144,.809],[.178,1.15,.865]]),[side,0,1],p.cream,'brows');
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
  faceGeometry?.dispose();
  const material=new MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,flatShading:true});material.name=`${preset.meshName} palette`;
  const skin=new SkinnedMesh(geometry,material);skin.name=preset.meshName;skin.frustumCulled=false;root.add(skin);
  root.updateMatrixWorld(true);skin.bind(new Skeleton([...bones.values()]));
  return root;
}
