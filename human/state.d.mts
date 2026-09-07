import type { HumanRecipe } from './contract.mjs';
export interface HumanHistory {
  readonly value:HumanRecipe;readonly canUndo:boolean;readonly canRedo:boolean;
  commit(next:HumanRecipe):boolean;undo():HumanRecipe;redo():HumanRecipe;
}
export function createHistory(initial?:HumanRecipe):HumanHistory;
