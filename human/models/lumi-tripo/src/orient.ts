import {object} from '../../../generation/fal-queue.ts';

/** Observed H3.1 output faces +X. Wrap static scenes to face viewer +Z; retain BIN bytes. */
export function orientTripoGlb(input:Uint8Array):Buffer {
  const bytes=Buffer.from(input);
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB');
  const end=20+bytes.readUInt32LE(12);
  if(end+8>bytes.length||bytes.readUInt32LE(end+4)!==0x004e4942||end+8+bytes.readUInt32LE(end)!==bytes.length)throw Error('Expected embedded BIN');
  const doc=object(JSON.parse(bytes.toString('utf8',20,end)));
  const extras=doc.extras?object(doc.extras):{};
  if(extras.tripoOrientation)throw Error('Orientation already applied');
  if(!Array.isArray(doc.nodes)||!Array.isArray(doc.scenes)||!doc.scenes.length)throw Error('Missing scene');
  if((Array.isArray(doc.skins)&&doc.skins.length)||(Array.isArray(doc.animations)&&doc.animations.length))throw Error('Only static Tripo geometry supported');
  const nodes:unknown[]=doc.nodes,originalNodeCount=nodes.length;
  for(const value of doc.scenes){
    const scene=object(value);
    if(!Array.isArray(scene.nodes)||!scene.nodes.every(n=>Number.isInteger(n)&&n>=0&&n<originalNodeCount))throw Error('Invalid scene roots');
    const wrapper=nodes.length;
    nodes.push({name:'Tripo_ViewerOrientation',rotation:[0,-Math.SQRT1_2,0,Math.SQRT1_2],children:scene.nodes});
    scene.nodes=[wrapper];
  }
  doc.extras={...extras,tripoOrientation:{version:1,sourceForward:'+X',viewerForward:'+Z'}};
  const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);
  json.copy(padded);
  const header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(20+padded.length+bytes.length-end,8);
  header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  return Buffer.concat([header,padded,bytes.subarray(end)]);
}
