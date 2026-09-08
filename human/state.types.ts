import type { HumanRecipe } from './contract.ts';
export interface HumanHistory {
  readonly value:HumanRecipe;readonly canUndo:boolean;readonly canRedo:boolean;
  commit(next:HumanRecipe):boolean;undo():HumanRecipe;redo():HumanRecipe;
}
