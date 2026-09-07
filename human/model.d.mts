import type { Object3D, Scene } from 'three';
import type { HumanRecipe, HumanRig } from './contract.mjs';
export function createHuman(recipe:HumanRecipe):Scene;
export function exportRig(root:Object3D):HumanRig;
export function disposeHuman(root:Object3D):void;
