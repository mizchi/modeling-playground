import { createProject, restPose } from '../../motion/contract.ts';
import type { BodyBone, Quat } from '../../motion/contract.ts';
const project=createProject(),pose=restPose();
const name:BodyBone='Head';
// @ts-expect-error Quaternion must have exactly four components.
const q:Quat=[0,0,1];
// @ts-expect-error Unknown bones cannot enter the canonical pose.
pose.rotations.Eyes=[0,0,0,1];
// @ts-expect-error Supported frame rates are explicit.
project.fps=29.97;
// @ts-expect-error Schema versions are not arbitrary numbers.
project.version=2;
void name;void q;
