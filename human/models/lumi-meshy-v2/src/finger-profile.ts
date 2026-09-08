import {Vector3} from 'three';

import type {FingerName} from '../../../../contracts/fingers.ts';
export type Point3=[number,number,number];
export interface FingerDefinition {name:FingerName;points:[Point3,Point3,Point3,Point3]}
export interface FingerInfluence {finger:FingerName|null;joint:number;weight:number}
// Original (unbent) v2 mesh coordinates, in meters relative to the wrist.
export const fingerDefinitions:readonly FingerDefinition[]=[
  {name:'Thumb',points:[[.034,-.006,.025],[.050,-.010,.043],[.066,-.012,.060],[.080,-.014,.071]]},
  {name:'Index',points:[[.067,-.003,.019],[.104,-.008,.020],[.131,-.008,.021],[.153,-.009,.020]]},
  {name:'Middle',points:[[.067,-.003,.001],[.107,-.008,.001],[.139,-.009,.001],[.162,-.009,.001]]},
  {name:'Ring',points:[[.064,-.003,-.017],[.101,-.008,-.017],[.128,-.009,-.018],[.149,-.009,-.018]]},
  {name:'Little',points:[[.058,-.004,-.034],[.088,-.010,-.035],[.109,-.010,-.035],[.130,-.010,-.035]]},
];
const smooth=(a:number,b:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};

/** Palm blends to one finger only; adjacent fingers never share distal weights. */
export function fingerInfluences(point:readonly number[]):FingerInfluence[]{
  if(point.length!==3||!point.every(Number.isFinite))throw Error('Invalid finger point');
  if(point[0]<.026)return [];
  const p=new Vector3(point[0],0,point[2]);
  const candidates=fingerDefinitions.map(finger=>{
    const start=new Vector3(finger.points[0][0],0,finger.points[0][2]);
    const end=new Vector3(finger.points[3][0],0,finger.points[3][2]);
    const axis=end.clone().sub(start).normalize(),distance=p.clone().sub(start).dot(axis);
    const closest=start.clone().addScaledVector(axis,Math.max(0,Math.min(end.distanceTo(start),distance)));
    return {finger,start,axis,distance,error:closest.distanceToSquared(p)};
  }).sort((a,b)=>a.error-b.error);
  const {finger,start,axis,distance}=candidates[0],amount=smooth(-.012,.014,distance);
  if(amount===0)return [];
  const influence:FingerInfluence[]=[];
  if(amount<1)influence.push({finger:null,joint:0,weight:1-amount});
  const joints=finger.points.slice(0,3).map(p=>new Vector3(p[0],0,p[2]).sub(start).dot(axis));
  const middle=smooth(joints[1]-.010,joints[1]+.010,distance),distal=smooth(joints[2]-.008,joints[2]+.008,distance);
  [1-middle,middle*(1-distal),middle*distal].forEach((weight,joint)=>{
    if(weight>0)influence.push({finger:finger.name,joint,weight:weight*amount});
  });
  return influence;
}
