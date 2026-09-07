export type HumanModel='base45'|'lumi';
export interface HumanShape {noseHeight:number;faceLength:number;faceWidth:number;eyeSpacing:number}
/** BASE-45 names/hierarchy, world-space rest anchors in meters, +Y up / +Z front. */
export interface HumanRig {version:1;bones:Array<{name:string;parent:string|null;position:[number,number,number]}>}
export interface HumanRecipe {version:1;model:HumanModel;hair:'none'|'lumi-short';face:'clay'|'lumi';shape:HumanShape;rig:HumanRig|null}
export const SHAPE_FIELDS:Readonly<Record<keyof HumanShape,{label:string;min:number;max:number;step:number}>>;
export function presetRecipe(model:HumanModel):HumanRecipe;
export function validateRecipe(value:unknown):HumanRecipe;
export function validateRig(value:unknown):HumanRig;
