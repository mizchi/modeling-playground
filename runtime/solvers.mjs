import { Matrix4, Quaternion, Vector3 } from 'three';

/** Analytic two-bone IK. Out-of-reach targets are clamped, never stretched. */
export function solveTwoBone(start, target, pole, upperLength, lowerLength) {
  const delta=target.clone().sub(start);
  const requested=delta.length();
  const low=Math.abs(upperLength-lowerLength)+1e-7;
  const high=upperLength+lowerLength-1e-7;
  const distance=Math.max(low,Math.min(high,requested));
  const direction=requested>1e-8 ? delta.divideScalar(requested) : new Vector3(0,-1,0);
  let bend=pole.clone().sub(start).addScaledVector(direction,-pole.clone().sub(start).dot(direction));
  if (bend.lengthSq()<1e-10) {
    bend=Math.abs(direction.x)<.8 ? new Vector3(1,0,0) : new Vector3(0,0,1);
    bend.addScaledVector(direction,-bend.dot(direction));
  }
  bend.normalize();
  const along=(upperLength**2-lowerLength**2+distance**2)/(2*distance);
  const height=Math.sqrt(Math.max(0,upperLength**2-along**2));
  return { joint:start.clone().addScaledVector(direction,along).addScaledVector(bend,height),
    end:start.clone().addScaledVector(direction,distance), clamped:Math.abs(distance-requested)>1e-6 };
}

/** Solve a horizontal cutting plane independently of character/bone names.
 * Input orientations are quaternions; the result is upper/forearm local rotation.
 * The caller supplies choreography, anatomical offsets and blend weight.
 */
export function solveHorizontalSweep({chest,shoulder,sweep,weight,elbowDrop,restUpper,restForearm}) {
  const direction=new Vector3(Math.cos(sweep),0,Math.sin(sweep)).applyQuaternion(chest);
  direction.y=0;direction.normalize();
  const up=new Vector3(0,1,0);
  const edge=new Vector3().crossVectors(direction,up);
  const frame=new Matrix4().makeBasis(edge,direction.clone().negate(),up.clone().negate());
  const blade=new Quaternion().setFromRotationMatrix(frame);
  const elbowDirection=direction.clone();elbowDirection.y=-elbowDrop;elbowDirection.normalize();
  const upperWorld=new Quaternion().setFromUnitVectors(direction,elbowDirection).multiply(blade);
  const parent=chest.clone().multiply(shoulder);
  const inverseParent=parent.clone().invert();
  const local=inverseParent.clone().multiply(upperWorld);
  const arm=restUpper.clone().slerp(local,weight);
  // Blend reach explicitly: quaternion blending alone bows the elbow backwards.
  const down=new Vector3(0,-1,0);
  const reach=down.clone().applyQuaternion(restUpper).lerp(elbowDirection.clone().applyQuaternion(inverseParent),weight).normalize();
  arm.premultiply(new Quaternion().setFromUnitVectors(down.clone().applyQuaternion(arm),reach));
  const forearm=restForearm.clone().slerp(parent.clone().multiply(arm).invert().multiply(blade),weight);
  return {upper:arm,forearm};
}
