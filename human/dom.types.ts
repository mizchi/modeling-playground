/** Static element IDs from human-viewer.html. */
export interface PageElements {
  'save-recipe': HTMLButtonElement;
  'export-glb': HTMLButtonElement;
  'viewport': HTMLElement;
  'model-title': HTMLElement;
  'model-stats': HTMLElement;
  'status': HTMLElement;
  'wireframe': HTMLInputElement;
  'skeleton': HTMLInputElement;
  'focus': HTMLButtonElement;
  'error': HTMLElement;
  'undo': HTMLButtonElement;
  'redo': HTMLButtonElement;
  'body-type': HTMLSelectElement;
  'hair': HTMLSelectElement;
  'face': HTMLSelectElement;
  'face-file': HTMLInputElement;
  'face-asset': HTMLElement;
  'reset-face': HTMLButtonElement;
  'reset-shape': HTMLButtonElement;
  'shape-fields': HTMLElement;
  'reset-body-shape': HTMLButtonElement;
  'body-shape-fields': HTMLElement;
  'rig-name': HTMLElement;
  'rig-file': HTMLInputElement;
  'save-rig': HTMLButtonElement;
  'reset-rig': HTMLButtonElement;
  'motion': HTMLSelectElement;
  'play': HTMLButtonElement;
  'timeline': HTMLInputElement;
  'time': HTMLOutputElement;
  'motion-file': HTMLInputElement;
  'motion-asset': HTMLElement;
  'recipe-file': HTMLInputElement;
}

import type { HumanShape, HumanBodyShape } from './contract.ts';
type ShapeKey = keyof HumanShape | keyof HumanBodyShape;
export type HumanElements = PageElements & Record<ShapeKey, HTMLInputElement> & Record<`${ShapeKey}-value`, HTMLOutputElement>;
