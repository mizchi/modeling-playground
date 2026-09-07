import { presetRecipe, validateRecipe } from './contract.mjs';

/** Serializable edit history only. Three.js objects and uploaded files live in
 * the viewer, never in a recipe or browser storage. */
export function createHistory(initial=presetRecipe('lumi')) {
  let current=validateRecipe(initial);const past=[],future=[];
  return {
    get value(){return structuredClone(current);},
    get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    commit(next){const validated=validateRecipe(next);if(JSON.stringify(current)===JSON.stringify(validated))return false;past.push(current);if(past.length>60)past.shift();current=validated;future.length=0;return true;},
    undo(){if(past.length){future.push(current);current=past.pop();}return this.value;},
    redo(){if(future.length){past.push(current);current=future.pop();}return this.value;},
  };
}
