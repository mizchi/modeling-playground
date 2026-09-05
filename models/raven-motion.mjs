import { AnimationClip, Euler, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';

export const RAVEN_MOTION=Object.freeze({fps:30,hoverHeight:.8,boostDistance:4.8,
  durations:Object.freeze({Hover:2,Boost:2.4,BladeSlash:2.1})});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const joints=['Hips','Spine','Head','RightShoulder','LeftUpperArm','RightUpperArm','LeftForearm','RightForearm',
  'LeftThigh','RightThigh','LeftShin','RightShin','LeftFoot','RightFoot'];
const jets=['LeftBackJet','RightBackJet','LeftFootJet','RightFootJet'];

// Authored whole-body poses: hips lead the cut, the chest follows, and the off
// hand / split legs counterbalance it. Root travel never rewinds after impact.
const SLASH_KEYS=[
  {t:0,sweep:0,p:[0,.8,0],thrust:.14,r:{}},
  {t:.22,sweep:.15,p:[-.18,.72,-.16],thrust:.15,r:{
    Hips:[-.18,.40,-.16],Spine:[-.12,.20,-.12],Head:[.2,-.38,0],
    LeftUpperArm:[-.9,.2,-.35],LeftForearm:[-1.2,0,0],
    LeftThigh:[-.6,0,-.28],RightThigh:[.15,0,.25],LeftShin:[.95,0,0],RightShin:[.7,0,0]}},
  {t:.48,sweep:.12,p:[-.32,.90,-.30],thrust:.28,r:{
    Hips:[-.2,.65,-.26],Spine:[-.16,.30,-.10],Head:[.2,-.55,.10],
    LeftUpperArm:[-1.05,.2,-.45],LeftForearm:[-1.2,0,0],
    LeftThigh:[-.82,0,-.22],RightThigh:[.1,0,.24],LeftShin:[.95,0,0],RightShin:[.68,0,0]}},
  {t:.60,sweep:.25,p:[-.23,1.12,0],thrust:1.15,r:{
    Hips:[.2,.48,-.1],Spine:[.05,.20,-.10],Head:[-.25,-.4,.05],
    LeftUpperArm:[-.85,.1,-.5],LeftForearm:[-.9,0,0],
    LeftThigh:[-.95,0,-.3],RightThigh:[.3,0,.28],LeftShin:[.95,0,0],RightShin:[1.1,0,0]}},
  {t:.78,sweep:.9,p:[.35,1.35,2.2],thrust:1.35,r:{
    Hips:[.4,-.52,.24],Spine:[.22,-.25,.20],Head:[-.4,.5,-.1],
    LeftUpperArm:[.55,-.3,-.9],LeftForearm:[-.3,0,0],
    LeftThigh:[.4,0,-.40],RightThigh:[-1.0,0,.36],LeftShin:[1.25,0,0],RightShin:[.45,0,0],
    LeftFoot:[-.45,0,0],RightFoot:[.2,0,0]}},
  {t:.94,sweep:1.5,p:[.62,1.24,3.05],thrust:.9,r:{
    Hips:[.38,-.80,.32],Spine:[.06,-.35,.12],Head:[-.26,.7,-.12],
    LeftUpperArm:[.7,-.25,-.7],LeftForearm:[-.45,0,0],
    LeftThigh:[.48,0,-.3],RightThigh:[-.8,0,.35],LeftShin:[1.05,0,0],RightShin:[.5,0,0],
    LeftFoot:[-.4,0,0],RightFoot:[.1,0,0]}},
  {t:1.18,sweep:1.55,p:[.68,1.10,3.38],thrust:.55,r:{
    Hips:[.14,-.75,.14],Spine:[-.02,-.30,.08],Head:[-.08,.65,0],
    LeftUpperArm:[.45,-.1,-.45],LeftForearm:[-.6,0,0],
    LeftThigh:[.12,0,-.2],RightThigh:[-.48,0,.25],LeftShin:[.85,0,0],RightShin:[.5,0,0]}},
  {t:1.46,sweep:.8,p:[.60,.95,3.50],thrust:.65,r:{
    Hips:[-.22,-.35,-.1],Spine:[.15,-.08,-.08],Head:[.06,.3,0],
    LeftUpperArm:[-.12,0,-.25],LeftForearm:[-.35,0,0],
    LeftThigh:[-.32,0,-.12],RightThigh:[-.2,0,.12],LeftShin:[.5,0,0],RightShin:[.4,0,0]}},
  {t:2.1,sweep:0,p:[.60,.8,3.55],thrust:.14,r:{}},
];

// Author the weapon's trajectory, then solve the upper-arm orientation. The
// blade extends along -Y and its cutting facet lies in XY. Counter-rotate the
// torso's pitch/roll so both the reach and the cutting plane stay horizontal.
function horizontalSlashArm(rotations,sweep,weight) {
  const quaternion=angles=>new Quaternion().setFromEuler(new Euler(...angles));
  const chest=quaternion(rotations.Hips).multiply(quaternion(rotations.Spine));
  const direction=new Vector3(Math.cos(sweep),0,Math.sin(sweep)).applyQuaternion(chest);
  direction.y=0;direction.normalize();
  const up=new Vector3(0,1,0);
  const edge=new Vector3().crossVectors(direction,up);
  const frame=new Matrix4().makeBasis(edge,direction.clone().negate(),up.clone().negate());
  const blade=new Quaternion().setFromRotationMatrix(frame);
  // Keep the elbow below the shoulder armor; the forearm counter-rotates to
  // carry the blade horizontally instead of dragging the whole arm through it.
  const elbowDirection=direction.clone();elbowDirection.y=-.55;elbowDirection.normalize();
  const upperWorld=new Quaternion().setFromUnitVectors(direction,elbowDirection).multiply(blade);
  const parent=chest.clone().multiply(quaternion(rotations.RightShoulder));
  const inverseParent=parent.clone().invert();
  const local=inverseParent.clone().multiply(upperWorld);
  const rest=quaternion([.08,0,.14]);
  const arm=rest.clone().slerp(local,weight);
  // Quaternion blending alone can bow the elbow backwards through a pauldron.
  // Blend the reach explicitly; apply the blade's roll around that reach.
  const down=new Vector3(0,-1,0);
  const reach=down.clone().applyQuaternion(rest).lerp(elbowDirection.clone().applyQuaternion(inverseParent),weight).normalize();
  arm.premultiply(new Quaternion().setFromUnitVectors(down.clone().applyQuaternion(arm),reach));
  rotations.RightUpperArm=new Euler().setFromQuaternion(arm,'XYZ').toArray().slice(0,3);
  const forearm=quaternion([-.18,0,0]).slerp(parent.clone().multiply(arm).invert().multiply(blade),weight);
  rotations.RightForearm=new Euler().setFromQuaternion(forearm,'XYZ').toArray().slice(0,3);
}

/** Pose contract: XYZ Euler rotations in radians and root/jet transforms in meters. */
export function ravenPose(clip,time) {
  const duration=RAVEN_MOTION.durations[clip],u=Math.max(0,Math.min(1,time/duration));
  const rotations=Object.fromEntries(joints.map(name=>[name,[0,0,0]]));
  Object.assign(rotations,{LeftUpperArm:[.08,0,-.14],RightUpperArm:[.08,0,.14],
    LeftForearm:[-.18,0,0],RightForearm:[-.18,0,0],LeftThigh:[-.12,0,-.05],RightThigh:[-.12,0,.05],
    LeftShin:[.24,0,0],RightShin:[.24,0,0],LeftFoot:[-.12,0,0],RightFoot:[-.12,0,0]});
  const position=[0,RAVEN_MOTION.hoverHeight,0];
  let thrust=0;
  if(clip==='Hover') {
    const wave=Math.sin(u*Math.PI*2);
    position[1]+=.045*wave;
    rotations.Spine=[.02*wave,0,.018*wave];thrust=.08+.06*Math.cos(u*Math.PI*4);
  } else if(clip==='Boost') {
    const envelope=smooth(u/.25)*(1-smooth((u-.68)/.32));
    position[1]+=.34*Math.sin(Math.PI*u);position[2]=RAVEN_MOTION.boostDistance*smooth(u);
    Object.assign(rotations,{Hips:[.5*envelope,0,0],Spine:[.17*envelope,0,0],Head:[-.38*envelope,0,0],
      LeftUpperArm:[.65*envelope,0,-.19],RightUpperArm:[.65*envelope,0,.19],
      LeftThigh:[-.12-.24*envelope,0,-.05],RightThigh:[-.12-.16*envelope,0,.05],
      LeftShin:[.24+.6*envelope,0,0],RightShin:[.24+.48*envelope,0,0]});
    thrust=envelope;
  } else if(clip==='BladeSlash') {
    let i=SLASH_KEYS.findIndex(k=>k.t>=time);i=Math.max(1,i<0?SLASH_KEYS.length-1:i);
    const a=SLASH_KEYS[i-1],b=SLASH_KEYS[i],t=smooth((time-a.t)/(b.t-a.t));
    for(const joint of joints)rotations[joint]=mix(a.r[joint]??rotations[joint],b.r[joint]??rotations[joint],t);
    position.splice(0,3,...mix(a.p,b.p,t));
    thrust=a.thrust+(b.thrust-a.thrust)*t;
    const weight=smooth(time/.4)*(1-smooth((time-1.18)/.92));
    // Open the pauldron before lifting the elbow, close it after lowering it.
    rotations.RightShoulder=[0,0,.8*smooth(time/.18)*(1-smooth((time-1.5)/.6))];
    horizontalSlashArm(rotations,a.sweep+(b.sweep-a.sweep)*t,weight);
  } else throw new Error(`Unknown Raven clip: ${clip}`);
  return {rotations,position,jetScales:Object.fromEntries(jets.map(name=>[name,[1+.18*thrust,1+(name.includes('Back')?2:1)*thrust,1+.18*thrust]]))};
}

export function ravenClips() {
  return Object.entries(RAVEN_MOTION.durations).map(([name,duration])=>{
    const fps=name==='BladeSlash'?60:RAVEN_MOTION.fps;
    const authored=name==='BladeSlash'?SLASH_KEYS.map(k=>k.t):[];
    const times=[...new Set([...Array.from({length:Math.round(duration*fps)+1},(_,i)=>i/fps),...authored])].sort((a,b)=>a-b);
    const poses=times.map(t=>ravenPose(name,t));
    const tracks=[new VectorKeyframeTrack('Motion.position',times,poses.flatMap(p=>p.position))];
    for(const joint of joints)tracks.push(new QuaternionKeyframeTrack(`${joint}.quaternion`,times,
      poses.flatMap(p=>new Quaternion().setFromEuler(new Euler(...p.rotations[joint])).toArray())));
    for(const jet of jets)tracks.push(new VectorKeyframeTrack(`${jet}.scale`,times,poses.flatMap(p=>p.jetScales[jet])));
    return new AnimationClip(name,duration,tracks);
  });
}
