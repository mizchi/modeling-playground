/** Solver-neutral hints; the metadata does not itself implement physics. */
export interface HairChain {
  id:string; joints:[string,string,string]; pinned:1;
  radius:number; stiffness:number; drag:number; maxAngle:number;
}
export interface HairDynamics {
  version:1; anchor:string; space:'anchor-local'; chains:HairChain[];
  /** Centers are local to the named character bone; optional solver hints. */
  colliderHints:Array<{bone:string;center:[number,number,number];radius:number}>;
}
