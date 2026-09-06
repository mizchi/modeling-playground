import {mkdir,writeFile} from 'node:fs/promises';
import {SPEC,DIRECTIONS,PALETTE,PROPORTIONS,getRig,artifactNames,buildSheet,toRgba,sampleWalk} from '../sprites/walk.mjs';
import {encodeRgbaPng} from './png.mjs';

await mkdir(new URL('../output/',import.meta.url),{recursive:true});
for(const profile of PROPORTIONS) {
  const rig=getRig(profile.id),paths=artifactNames(profile.id);
  for(const [key,colored] of [['debug',true],['neutral',false]]) {
    const sheet=buildSheet({colored,proportion:profile.id});
    await writeFile(new URL(`../output/${paths[key]}`,import.meta.url),encodeRgbaPng(toRgba(sheet)));
  }
  const metadata={version:2,kind:'procedural-walk-study',image:paths.debug,neutralImage:paths.neutral,
    proportion:{id:profile.id,heads:profile.heads,standingHeight:rig.stature,headHeight:rig.headHeight},
    headRendering:rig.pixelHead?{mode:'pixel-part',width:4,height:5,outline:1}:{mode:'projected-3d'},
    frame:{width:SPEC.width,height:SPEC.height,anchor:SPEC.anchor},
    columns:SPEC.frames,rows:DIRECTIONS.map(({id,label})=>({id,label})),
    periodSeconds:SPEC.period,frameDurationMs:SPEC.period*1000/SPEC.frames,
    source:rig,palette:PALETTE,
    phases:Array.from({length:SPEC.frames},(_,i)=>{
      const phase=i/SPEC.frames,pose=sampleWalk(phase,profile.id);
      return {phase,leftContact:pose.left.contact,rightContact:pose.right.contact,pose};
    }),
    notes:['In-place frames. For world motion move the root +Z by source.travelPerCycle per period.',
      'Anchor is the projected root ground origin, not the moving foot position.',
      'Head count is measured in neutral 3D stature, before walk bob, projection and pixel rounding.',
      'Mannequin motion study, not a finished Romancing SaGa-style character.'],
  };
  await writeFile(new URL(`../output/${paths.metadata}`,import.meta.url),JSON.stringify(metadata,null,2)+'\n');
  console.log(`${profile.label}: ${SPEC.frames} frames × 8 directions, 32×48 pixels, stride ${rig.stride.toFixed(3)}`);
}
