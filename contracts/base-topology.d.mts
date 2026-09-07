export interface BaseTopology {
  version: 1;
  positions: [number,number,number][];
  faces: number[][];
  weights: [string,number][][];
  regions: string[];
}
export function validateBaseTopology(data: unknown): BaseTopology;
