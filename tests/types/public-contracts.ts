import type { BoneSpec, Vec3 } from '../../contracts/asset.ts';
import type { HumanRecipe } from '../../human/contract.ts';
import { presetRecipe } from '../../human/contract.ts';
import { createHuman } from '../../human/model.ts';
import { compactMesh } from '../../modeling/compact-mesh.ts';

// Compile-only regression checks: an unused @ts-expect-error is a test failure.
const point: Vec3 = [0, 1, 2];
const bone: BoneSpec = {name: 'Head', parent: null, position: point};
const recipe: HumanRecipe = presetRecipe('base45');
createHuman(recipe);
compactMesh([bone.name]).loft([[0, 1, 0, .1, .1]], 6, '#ffffff', 'Head');

// @ts-expect-error Positions must contain exactly three coordinates.
const incompletePoint: Vec3 = [0, 1];
// @ts-expect-error Model IDs are a closed contract, not arbitrary strings.
presetRecipe('unknown-model');
// @ts-expect-error Hair options must match supported modules.
recipe.hair = 'unknown-hair';
// @ts-expect-error Shape settings are numeric.
recipe.shape.noseHeight = 'high';
// @ts-expect-error Reject misspelled shape fields.
recipe.shape.eyeSpace = 0;
// @ts-expect-error Skinning callbacks must return [bone name, numeric weight] pairs.
compactMesh(['Head']).loft([[0, 1, 0, .1, .1]], 6, '#ffffff', () => [['Head', 'full']]);
void incompletePoint;
