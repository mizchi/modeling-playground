import {GlbEditor} from './glb-editor.ts';

export interface BakedTrack {node:string;path:'rotation'|'translation';times:number[];values:number[]}
export interface BakedClip {name:string;duration:number;tracks:BakedTrack[]}

/** Add clips without re-exporting geometry, textures, inverse binds or weights. */
export function appendClips(source:Uint8Array,clips:BakedClip[]):Buffer {
  const editor=new GlbEditor(source),nodes=new Map<string,number>();
  editor.doc.nodes.forEach((node,i)=>{if(node.name){if(nodes.has(node.name))throw Error('Ambiguous node name');nodes.set(node.name,i);}});
  editor.doc.animations??=[];
  for(const clip of clips){
    if(!clip.name||!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks.length)throw Error('Invalid clip');
    const samplers:{input:number;output:number;interpolation:'LINEAR'}[]=[],channels:{sampler:number;target:{node:number;path:string}}[]=[];
    const targets=new Set<string>();
    for(const track of clip.tracks){
      const node=nodes.get(track.node),size=track.path==='rotation'?4:3;
      const key=`${track.node}.${track.path}`;
      if(node===undefined||targets.has(key)||!['rotation','translation'].includes(track.path)||!track.times.length||track.values.length!==track.times.length*size
        ||!track.times.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=clip.duration+1e-5&&(!i||t>track.times[i-1]))||!track.values.every(Number.isFinite))throw Error('Invalid baked track');
      targets.add(key);
      if(track.path==='rotation')for(let i=0;i<track.values.length;i+=4)if(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)>1e-4)throw Error('Invalid quaternion');
      const input=editor.append(track.times.map(t=>[t]),'SCALAR');
      editor.doc.accessors[input].min=[track.times[0]];editor.doc.accessors[input].max=[track.times.at(-1)!];
      const output=editor.append(track.times.map((_,i)=>track.values.slice(i*size,(i+1)*size)),size===4?'VEC4':'VEC3');
      samplers.push({input,output,interpolation:'LINEAR'});channels.push({sampler:samplers.length-1,target:{node,path:track.path}});
    }
    editor.doc.animations.push({name:clip.name,samplers,channels});
  }
  return editor.finish();
}
