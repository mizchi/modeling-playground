import test from 'node:test';
import assert from 'node:assert/strict';
import { createBase45, createBase45Topology } from '../human/models/base45/src/model.ts';
import { Vector3, Matrix3, AnimationMixer } from 'three';
import { createNeckCheckMotion } from '../human/motion.ts';

test('nape centerline turns gradually from the neck into the occiput',()=>{
  const d=createBase45Topology();
  const p=d.positions.filter(([x,y,z])=>Math.abs(x)<1e-8&&y>=1.65&&y<=1.975&&z<-.07).sort((a,b)=>a[1]-b[1]);
  assert.ok(p.length>=10,'A single extra neck row distributes bending');
  const segments=p.slice(1).map((q,i)=>new Vector3(...q).sub(new Vector3(...p[i])));
  for(let i=1;i<segments.length;i++)assert.ok(segments[i-1].angleTo(segments[i])<Math.PI/6,`Abrupt nape turn at Y=${p[i][1]}`);
  const middle=d.positions.findIndex(([x,y,z])=>Math.abs(x)<1e-8&&y>1.70&&y<1.74&&z<-.07);
  assert.ok(d.weights[middle].some(([n,w])=>n==='Head'&&w>0&&w<.4),'Start blending Head before the attachment');
});

test('neck and nape retain finite, non-collapsed, consistently facing surfaces through bounded head motions',()=>{
  const root=createBase45(),mesh=root.getObjectByName('BaseBody'),d=createBase45Topology();
  const faces=d.faces.filter((f,i)=>d.regions[i]==='Neck'||d.regions[i]==='Head.UnderJaw'||f.every(v=>d.positions[v][1]>1.74&&d.positions[v][1]<1.985&&d.positions[v][2]<0));
  const normal=p=>p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
  const mixer=new AnimationMixer(root);mixer.clipAction(createNeckCheckMotion()).play();
  for(let time=0;time<=9;time+=.125) {
    mixer.setTime(time);root.updateMatrixWorld(true);mesh.skeleton.update();
    const matrices=mesh.skeleton.bones.map((b,i)=>new Matrix3().setFromMatrix4(b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[i])));
    for(const f of faces)for(const tri of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]]) {
      const rest=tri.map(i=>new Vector3(...d.positions[i])),posed=rest.map((p,k)=>mesh.applyBoneTransform(tri[k],p.clone()));
      const rn=normal(rest),pn=normal(posed),expected=new Vector3();
      assert.ok(posed.every(p=>p.toArray().every(Number.isFinite)));
      for(const i of tri)for(const [name,w] of d.weights[i])expected.addScaledVector(rn.clone().applyMatrix3(matrices[mesh.skeleton.bones.findIndex(b=>b.name===name)]),w/3);
      assert.ok(pn.length()/rn.length()>.2&&pn.length()/rn.length()<3,`No pinched or stretched triangle at ${time}s`);
      assert.ok(pn.dot(expected)>0,`No flipped triangle against its blended bone frame at ${time}s`);
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);
});

test('neck stands nearly upright in profile, with a slight forward rise toward the ear',()=>{
  const d=createBase45Topology();
  const ids=new Set(d.faces.flatMap((f,i)=>d.regions[i]==='Neck'?f:[]));
  const points=[...ids].map(i=>d.positions[i]);
  const lower=points.filter(p=>Math.abs(p[1]-1.65)<1e-6),upper=points.filter(p=>p[1]>1.74);
  assert.equal(lower.length,12);assert.equal(upper.length,12);
  const center=row=>row.reduce((sum,p)=>sum+p[2],0)/row.length;
  const rise=center(upper)-center(lower);
  assert.ok(rise>=0&&rise<=.025,`Neck axis should not tilt backward: Z rise ${rise}`);
  const front=row=>Math.max(...row.map(p=>p[2])),back=row=>Math.min(...row.map(p=>p[2]));
  assert.ok(front(upper)>=front(lower),'Throat must not retreat toward the back as it rises');
  assert.ok(back(upper)>back(lower)-.01,'Only a shallow rear flare begins above the upright neck shaft');
  assert.ok(front(upper)<.07,'Keep the throat behind the jaw, not directly beneath the chin');
  assert.ok(center(upper)<.02,'Keep the attachment behind the ear center');
  assert.equal(d.positions.length,722);assert.equal(d.faces.length,720);
});
