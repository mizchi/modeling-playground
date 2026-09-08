import {Matrix4,Quaternion,Vector3} from 'three';

interface Accessor {bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;normalized?:boolean;sparse?:unknown;min?:number[];max?:number[]}
export interface GlbNode {name?:string;children?:number[];matrix?:number[];translation?:number[];rotation?:number[];scale?:number[];extras?:Record<string,unknown>}
export interface GlbDocument {
  buffers:{byteLength:number;uri?:string}[];
  bufferViews:{buffer:number;byteOffset?:number;byteLength:number;byteStride?:number}[];
  accessors:Accessor[];nodes:GlbNode[];skins:{joints:number[];inverseBindMatrices:number}[];
  meshes:{primitives:{attributes:Record<string,number>;indices?:number}[]}[];
  animations?:unknown[];materials?:unknown[];extras?:Record<string,unknown>;
}
const dimensions:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const sizes:Record<number,number>={5121:1,5123:2,5125:4,5126:4};

/** Append-only editor: preserve textures, unknown glTF fields and existing animation accessors. */
export class GlbEditor {
  readonly doc:GlbDocument;
  readonly binary:Buffer;
  private parts:Buffer[];
  private length:number;
  constructor(source:Uint8Array){
    const b=Buffer.from(source);
    if(b.length<28||b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length||b.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB');
    const end=20+b.readUInt32LE(12);
    if(end+8>b.length||b.readUInt32LE(end+4)!==0x004e4942||end+8+b.readUInt32LE(end)!==b.length)throw Error('Expected one embedded GLB buffer');
    this.doc=JSON.parse(b.subarray(20,end).toString()) as GlbDocument;
    if(this.doc.buffers.length!==1||this.doc.buffers[0].uri)throw Error('External buffers unsupported');
    this.binary=b.subarray(end+8);this.parts=[this.binary];this.length=this.binary.length;
  }
  read(index:number):number[][]{
    const a=this.doc.accessors[index];if(!a)throw Error('Missing accessor');
    const v=this.doc.bufferViews[a.bufferView],size=sizes[a.componentType],n=dimensions[a.type];
    if(!v||v.buffer!==0||!size||!n||a.normalized||a.sparse)throw Error('Unsupported accessor');
    const start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??size*n;
    const binary=Buffer.concat(this.parts);
    if(start+(a.count-1)*stride+size*n>binary.length)throw Error('Accessor out of bounds');
    return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>{
      const o=start+i*stride+j*size;
      return a.componentType===5126?binary.readFloatLE(o):size===4?binary.readUInt32LE(o):size===2?binary.readUInt16LE(o):binary[o];
    }));
  }
  append(values:number[][],type:string,componentType:5123|5126=5126):number{
    const n=dimensions[type],size=sizes[componentType];
    if(!n||!values.length||values.some(row=>row.length!==n||row.some(v=>!Number.isFinite(v)||(componentType===5123&&(!Number.isInteger(v)||v<0||v>65535)))))throw Error('Invalid appended attribute');
    const bytes=Buffer.alloc(Math.ceil(values.length*n*size/4)*4);
    values.forEach((row,i)=>row.forEach((v,j)=>{const offset=(i*n+j)*size;if(componentType===5126)bytes.writeFloatLE(v,offset);else bytes.writeUInt16LE(v,offset);}));
    const view=this.doc.bufferViews.push({buffer:0,byteOffset:this.length,byteLength:values.length*n*size})-1;
    this.parts.push(bytes);this.length+=bytes.length;
    return this.doc.accessors.push({bufferView:view,componentType,count:values.length,type})-1;
  }
  nodeMatrix(index:number):Matrix4{
    const n=this.doc.nodes[index];
    return n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
  }
  finish():Buffer{
    this.doc.buffers[0].byteLength=this.length;
    const raw=Buffer.from(JSON.stringify(this.doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
    const b=Buffer.alloc(28+json.length+this.length);
    b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);b.writeUInt32LE(this.length,20+json.length);b.writeUInt32LE(0x004e4942,24+json.length);Buffer.concat(this.parts).copy(b,28+json.length);return b;
  }
}
