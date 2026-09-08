export const fingerNames=['Thumb','Index','Middle','Ring','Little'] as const;
export const handSides=['Left','Right'] as const;
export type FingerName=typeof fingerNames[number];
export type HandSide=typeof handSides[number];
export interface FingerBoneMetadata {
  version:1;side:HandSide;finger:FingerName;joint:0|1|2;restRotation:[number,number,number,number];
}
