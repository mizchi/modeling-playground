import { Bone, MeshStandardMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { compactMesh } from '../modeling/compact-mesh.mjs';
import { createLumiHairTexture } from '../models/lumi-hair-texture.mjs';

// World-rest coordinates: +X is the character's left, -Z behind the shoulder.
// Two closed, broad locks provide the silhouette; the texture supplies fine flow.
const locks=[
  [[.195,2.170,-.075,.075,.065],[.265,2.235,-.075,.050,.045],
    [.305,2.245,-.075,.045,.040],[.390,2.275,-.090,.070,.058],[.465,2.235,-.130,.090,.070],
    [.530,2.115,-.185,.100,.080],[.560,1.850,-.300,.110,.070],
    [.600,1.520,-.375,.105,.060],[.630,1.185,-.390,.086,.050],
    [.625,.850,-.360,.062,.032],[.530,.565,-.285,0,0]],
  [[.325,2.245,-.085,.035,.032],[.485,2.230,-.140,.055,.050],
    [.590,1.975,-.220,.055,.045],[.635,1.655,-.290,.055,.040],
    [.700,1.280,-.325,.050,.033],[.725,.950,-.290,.035,.024],
    [.665,.690,-.215,0,0]],
];
const joints=[
  ['SideTailRoot',[.305,2.245,-.075]],['SideTailUpper',[.560,1.850,-.300]],
  ['SideTailLower',[.620,1.300,-.385]],['SideTailTip',[.550,.620,-.300]],
];

function influences([,y]) {
  if(y>=joints[0][1][1])return [[joints[0][0],1]];
  for(let i=0;i<joints.length-1;i++){
    const [a,p]=joints[i],[b,q]=joints[i+1];
    if(y>=q[1]){const t=(p[1]-y)/(p[1]-q[1]);return [[a,1-t],[b,t]];}
  }
  return [[joints.at(-1)[0],1]];
}

function closedLock(builder,rows,sides,color,weights) {
  const points=[],uv=[],faces=[],rings=[];
  const lengths=[0];
  for(let j=1;j<rows.length;j++)lengths.push(lengths[j-1]+new Vector3(...rows[j].slice(0,3)).distanceTo(new Vector3(...rows[j-1].slice(0,3))));
  rows.forEach((row,j)=>{
    const center=new Vector3(...row.slice(0,3));
    const tangent=new Vector3(...rows[Math.min(j+1,rows.length-1)].slice(0,3))
      .sub(new Vector3(...rows[Math.max(j-1,0)].slice(0,3))).normalize();
    const u=new Vector3(0,0,1).cross(tangent).normalize(),v=tangent.clone().cross(u);
    const ring=[];
    for(let k=0;k<(row[3]===0?1:sides);k++){
      const angle=k/sides*Math.PI*2;ring.push(points.length);
      points.push(center.clone().addScaledVector(u,Math.cos(angle)*row[3]).addScaledVector(v,Math.sin(angle)*row[4]).toArray());
      uv.push([.01+.98*(1-Math.cos(angle))/2,.01+.98*lengths[j]/lengths.at(-1)]);
    }
    rings.push(ring);
    if(j)for(let k=0;k<sides;k++){
      const prev=rings[j-1],next=(k+1)%sides;
      if(ring.length===1)faces.push([prev[k],prev[next],ring[0]]);
      else faces.push([prev[k],prev[next],ring[k]],[prev[next],ring[next],ring[k]]);
    }
  });
  for(const end of [0,rows.length-1]){
    const ring=rings[end];if(ring.length===1)continue;
    const center=points.length;points.push(rows[end].slice(0,3));uv.push([.5,end? .99:.01]);
    for(let k=0;k<sides;k++)faces.push(end?[center,ring[k],ring[(k+1)%sides]]:[center,ring[(k+1)%sides],ring[k]]);
  }
  builder.surface(points,faces,color,weights,uv);
}

/** Adds a separate skin so the approved short hair geometry stays unchanged. */
export function attachSideTail(root) {
  const anchor=new Bone();anchor.name='SideTailAnchor';
  const bones=[anchor];let parent=anchor,origin=[0,1.76,0];
  for(const [name,position] of joints){
    const bone=new Bone();bone.name=name;bone.position.set(...position.map((v,k)=>v-origin[k]));
    parent.add(bone);bones.push(bone);parent=bone;origin=position;
  }
  const builder=compactMesh(bones.map(b=>b.name));
  for(const rows of locks)closedLock(builder,rows,8,'#ffffff',influences);
  // A dark fastening band, embedded into the crown and the gathered root.
  closedLock(builder,[[.288,2.242,-.070,.060,.055],[.333,2.250,-.080,.063,.058]],8,'#242735','SideTailRoot');
  const geometry=builder.finish();geometry.computeVertexNormals();
  const mesh=new SkinnedMesh(geometry,new MeshStandardMaterial({map:createLumiHairTexture(),vertexColors:true,roughness:.8}));
  mesh.name='SideTail';mesh.frustumCulled=false;
  mesh.userData.hairDynamics={version:1,space:'Head-local',solver:false,chains:[{joints:joints.map(([name])=>name),pinned:1}]};
  root.getObjectByName('HairSocket').add(anchor);root.add(mesh);root.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones));return mesh;
}
