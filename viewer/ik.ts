// Compatibility entrypoint. The editor owns UI; the runtime owns pose solving.
export { IKPose } from '../runtime/ik.ts';
export { solveTwoBone } from '../runtime/solvers.ts';
