import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from 'three';
import { STRIX_SPEC, STRIX_LEGS, STRIX_GAIT as G } from '../models/strix-definition.mjs';
import { strixPose } from '../models/strix-motion.mjs';
import { createStrix } from '../models/strix.mjs';
import { IKPose } from '../runtime/ik.mjs';
import { AnimationPlayer } from '../runtime/animation-player.mjs';
import { bindAsset } from '../runtime/asset.mjs';

test('Boost lifts before travelling, folds four legs, brakes before touchdown and holds its destination',()=>{
  const clip=STRIX_SPEC.clips.find(c=>c.name==='Boost');
  assert.ok(clip,'A dedicated Boost clip must exist');assert.equal(clip.mode,'once');
  let before=strixPose('Boost',0),airborne=0;
  assert.deepEqual(before.position,[0,0,0]);
  for(let i=1;i<=clip.duration*120;i++) {
    const after=strixPose('Boost',i/120);
    assert.ok(after.position[2]>=before.position[2]-1e-8,'No reverse travel on braking');
    for(const leg of STRIX_LEGS) {
      const foot=after.feet[leg.id];
      assert.ok(!foot.clamped,`${i}: ${leg.id} reachable`);
      assert.ok(Math.abs(foot.hip.distanceTo(foot.knee)-G.upper)<1e-7);
      assert.ok(Math.abs(foot.knee.distanceTo(foot.ankle)-G.lower)<1e-7);
      assert.ok(foot.ankle.y>=G.footHeight-1e-8);
      if(foot.contact && before.feet[leg.id].contact)
        assert.ok(foot.ankle.distanceTo(before.feet[leg.id].ankle)<1e-8,'Planted feet must not slide');
      for(const segment of ['Upper','Lower','Foot']) {
        const q=p=>new Quaternion().setFromEuler(new Euler(...p.rotations[leg.id+segment]));
        assert.ok(q(before).angleTo(q(after))<.10,'No joint flips');
      }
    }
    if(Object.values(after.feet).every(f=>!f.contact))airborne++;
    before=after;
  }
  assert.ok(airborne>180,'A sustained low-altitude boost, not a foot shuffle');
  const cruise=strixPose('Boost',1.4);
  assert.ok(cruise.rotations.Hull[0]+cruise.rotations.Torso[0]>.25,'Forward lean');
  for(const leg of STRIX_LEGS) {
    assert.ok(cruise.feet[leg.id].ankle.y>.7);
    assert.ok(cruise.feet[leg.id].ankle.z-cruise.position[2]<leg.ankle[2]-.4,'Feet swept back');
  }
  assert.ok(before.position[2]>4);
  assert.equal(before.position[1],0);
  for(const leg of STRIX_LEGS)assert.ok(before.feet[leg.id].contact);
  assert.ok(Object.values(cruise.scales).some(s=>s[2]>.5),'Visible thrust');
  for(const name of ['Idle','Walk','Advance'])for(const scale of Object.values(strixPose(name,1).scales))
    assert.ok(Math.max(...scale)<.002,'Ground clips have no exhaust');
});

test('four-leg interactive IK follows feet and poles, lowers the hull, clamps and resets',()=>{
  const asset=createStrix(),pose=IKPose.fromModel(asset.root);
  assert.ok(pose,'STRIX must advertise a valid four-chain IK rig');
  assert.equal(pose.chains.length,4);
  pose.targets.hips.y-=.12;pose.solve();
  for(const chain of pose.chains)assert.ok(chain.end.getWorldPosition(new Vector3()).distanceTo(pose.initial[chain.id])<1e-6);
  const chain=pose.chains[0];
  pose.targets[chain.id].add(new Vector3(-.1,.3,-.2));pose.solve();
  assert.ok(pose.errors[chain.id]<1e-6);
  const knee=chain.lower.getWorldPosition(new Vector3());
  pose.targets[chain.id+'Pole'].z-=.6;pose.solve();
  assert.ok(chain.lower.getWorldPosition(new Vector3()).distanceTo(knee)>.02);
  pose.targets[chain.id].x=20;pose.solve();
  assert.ok(pose.errors[chain.id]>10);
  assert.ok(Math.abs(chain.end.getWorldPosition(new Vector3()).distanceTo(chain.lower.getWorldPosition(new Vector3()))-G.lower)<1e-6);
  pose.reset();
  assert.ok(chain.end.getWorldPosition(new Vector3()).distanceTo(pose.initial[chain.id])<1e-6);
});

test('taking over a paused Boost pose with IK preserves root, all joints and exhaust before editing',()=>{
  const asset=createStrix(),player=new AnimationPlayer(asset.root,asset.clips);
  const pose=IKPose.fromModel(asset.root);assert.ok(pose);
  player.select(asset.clips.findIndex(c=>c.name==='Boost'));player.seek(1.4);
  asset.root.updateMatrixWorld(true);
  const matrices=Object.fromEntries(Object.entries(asset.bones).map(([name,b])=>[name,b.matrixWorld.clone()]));
  pose.capture();pose.solve();
  for(const [name,bone] of Object.entries(asset.bones))
    assert.ok(bone.matrixWorld.elements.every((v,i)=>Math.abs(v-matrices[name].elements[i])<1e-6),`${name}: no jump on takeover`);
  const untouched=pose.chains[1].end.getWorldPosition(new Vector3());
  pose.targets[pose.chains[0].id].y+=.12;pose.solve();
  assert.ok(pose.errors[pose.chains[0].id]<1e-6);
  assert.ok(pose.chains[1].end.getWorldPosition(new Vector3()).distanceTo(untouched)<1e-6);
  for(let i=0;i<3;i++) {
    pose.restore();player.seek(player.time);
    for(const [name,bone] of Object.entries(asset.bones))
      assert.ok(bone.matrixWorld.elements.every((v,j)=>Math.abs(v-matrices[name].elements[j])<1e-6),`${name}: reset even when the mixer caches an identical sample`);
    pose.capture();pose.targets.hips.y-=.12;pose.solve();
  }
  player.dispose();
});

test('boost emitter sockets remain at the physical nozzles, separate from shrinking plume bones',()=>{
  const asset=createStrix(),binding=bindAsset(asset.root,asset.clips,asset.definition);
  const player=new AnimationPlayer(asset.root,asset.clips);
  player.select(asset.clips.findIndex(c=>c.name==='Boost'));
  for(const t of [0,.25,.55,1.4,2.85,3.2]) {
    player.seek(t);
    const sample=binding.sample('Boost',t);
    assert.equal(sample.emitters.length,4);
    for(const emitter of sample.emitters) {
      assert.equal(emitter.active,t>=.25&&t<2.85);
      assert.ok(emitter.position.distanceTo(asset.bones[emitter.id].getWorldPosition(new Vector3()))<1e-6);
      assert.ok(Math.abs(emitter.direction.length()-1)<1e-6);
      if(emitter.id.includes('Main'))assert.ok(emitter.direction.z<-.8,'Thrust travels backwards');
    }
  }
  player.dispose();
});
