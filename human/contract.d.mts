export type HumanModel='base45'|'base45-female'|'lumi';
export interface HumanShape {noseHeight:number;faceLength:number;faceWidth:number;eyeSpacing:number}
export interface HumanBodyShape {chestSize:number;waistWidth:number;muscularity:number;legLength:number;height:number}
/** BASE-45 names/hierarchy, world-space rest anchors in meters, +Y up / +Z front. */
export interface HumanRig {version:1;bones:Array<{name:string;parent:string|null;position:[number,number,number]}>}
/** Canonical recipe. validateRecipe upgrades legacy v1 JSON lacking bodyShape. */
export interface HumanRecipe {version:1;model:HumanModel;hair:'none'|'lumi-short'|'lumi-side-tail';face:'clay'|'lumi';shape:HumanShape;bodyShape:HumanBodyShape;rig:HumanRig|null}
export const SHAPE_FIELDS:Readonly<Record<keyof HumanShape,{label:string;min:number;max:number;step:number}>>;
export const BODY_SHAPE_FIELDS:Readonly<Record<keyof HumanBodyShape,{label:string;min:number;max:number;step:number}>>;
export function presetRecipe(model:HumanModel):HumanRecipe;
export function validateRecipe(value:unknown):HumanRecipe;
export function validateRig(value:unknown):HumanRig;
