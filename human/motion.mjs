import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';

/** Imported tracks use BASE-45 local axes. This is compatibility checking and
 * root-motion rebasing, NOT an arbitrary-rig retargeter. Never silently drop tracks. */
export function fitMotion(root,source) {
  if(!source?.isAnimationClip&&!Array.isArray(source?.tracks))throw new Error('アニメーションがありません');
  if(!Number.isFinite(source.duration)||source.duration<=0||source.duration>600||!source.tracks.length||source.tracks.length>200)throw new Error('モーションの長さ・トラック数が不正です');
  const clip=source.clone(),seen=new Set();
  for(const track of clip.tracks) {
    const match=/^([A-Za-z][A-Za-z0-9]*)\.(quaternion|position)$/.exec(track.name);
    const bone=match&&root.getObjectByName(match[1]);
    if(!bone?.isBone||seen.has(track.name))throw new Error(`非互換のトラック: ${track.name}`);
    seen.add(track.name);
    const kind=match[2],size=kind==='quaternion'?4:3;
    if(!track.times.length||track.times.length>36000||track.values.length!==track.times.length*size||!track.values.every(Number.isFinite)||!track.times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=clip.duration&&(i===0||t>track.times[i-1])))throw new Error(`不正なキー: ${track.name}`);
    if(kind==='quaternion') {
      for(let i=0;i<track.values.length;i+=4)if(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)>.02)throw new Error(`非正規化の回転: ${track.name}`);
    } else {
      if(!['Root','Hips'].includes(bone.name))throw new Error(`位置アニメーションは Root / Hips のみ対応: ${bone.name}`);
      const first=track.values.slice(0,3),rest=root.userData.humanRestPositions?.[bone.name]??bone.position.toArray();
      for(let i=0;i<track.values.length;i++)track.values[i]+=rest[i%3]-first[i%3];
    }
  }
  return clip;
}

export function createMotions(root) {
  const track=(name,axis,angles)=>new QuaternionKeyframeTrack(`${name}.quaternion`,[0,.5,1,1.5,2],angles.flatMap(a=>new Quaternion().setFromAxisAngle(new Vector3(...axis),a).toArray()));
  const arms=[track('LeftUpperArm',[0,0,1],[-1.2,-1.2,-1.2,-1.2,-1.2]),track('RightUpperArm',[0,0,1],[1.2,1.2,1.2,1.2,1.2])];
  return [
    new AnimationClip('待機',2,[...arms,track('Chest',[0,0,1],[0,.015,0,-.015,0]),track('Head',[0,1,0],[0,.06,0,-.06,0])]),
    new AnimationClip('歩行テスト',2,[...arms.map(t=>t.clone()),track('LeftThigh',[1,0,0],[0,.30,0,-.30,0]),track('RightThigh',[1,0,0],[0,-.30,0,.30,0]),track('LeftShin',[1,0,0],[0,.05,.25,.05,0]),track('RightShin',[1,0,0],[.25,.05,0,.05,.25])]),
    createNeckCheckMotion(),
  ].map(c=>fitMotion(root,c));
}

/** Total yaw ±45°, pitch ±30°, roll ±23°. Shared by inspection and the UI. */
export function createNeckCheckMotion() {
  const neck=[[0,0,0],[0,.26,0],[0,-.26,0],[0,0,0],[.17,0,0],[-.17,0,0],[0,0,.14],[0,0,-.14],[.12,.17,0],[0,0,0]];
  const head=[[0,0,0],[0,.52,0],[0,-.52,0],[0,0,0],[.35,0,0],[-.35,0,0],[0,0,.26],[0,0,-.26],[.22,.35,.12],[0,0,0]];
  return new AnimationClip('首・頭チェック',9,[['Neck',neck],['Head',head]].map(([name,poses])=>
    new QuaternionKeyframeTrack(`${name}.quaternion`,poses.map((_,i)=>i),poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p)).toArray()))));
}
