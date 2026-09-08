import {Matrix3,Matrix4,Vector3} from 'three';
type Vec3=[number,number,number];
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
function bend(x:number,y:number,start:number,curvature:number):[number,number]{
  if(x<=start)return [x,y];const angle=(x-start)*curvature,radius=1/curvature;
  return [start+(radius+y)*Math.sin(angle),(radius+y)*Math.cos(angle)-radius];
}
/** Meter coordinates relative to the wrist: +X toward fingers, +Y hand back, +Z thumb. */
export function relaxHandPoint(p:readonly number[]):Vec3{
  if(p.length!==3||!p.every(Number.isFinite))throw Error('Invalid hand point');
  const [x,y,z]=p;if(x<=.028)return [x,y,z];
  const [fx,fy]=bend(x,y,.065,18);
  const thumbWeight=smooth(.026,.045,z)*smooth(.028,.042,x);
  if(!thumbWeight)return [fx,fy,z];
  const dx=x-.035,dz=z-.024,along=dx*.75+dz*.6614378,across=-dx*.6614378+dz*.75;
  const [curved,ty]=bend(along,y,0,12);
  let tx=curved*.75-across*.6614378,tz=curved*.6614378+across*.75;
  const angle=-.28*smooth(0,.055,along),c=Math.cos(angle),s=Math.sin(angle);
  [tx,tz]=[tx*c-tz*s,tx*s+tz*c];
  return [fx+(.035+tx-fx)*thumbWeight,fy+(ty-fy)*thumbWeight,z+(.024+tz-z)*thumbWeight];
}
/** Transform normals with the deformation Jacobian, rather than rotating them as rigid vectors. */
export function relaxHandNormal(p:readonly number[],n:readonly number[]):Vec3{
  const epsilon=1e-6,columns=[];
  for(let axis=0;axis<3;axis++){
    const a=[...p],b=[...p];a[axis]+=epsilon;b[axis]-=epsilon;
    const pa=relaxHandPoint(a),pb=relaxHandPoint(b);columns.push(pa.map((v,i)=>(v-pb[i])/(2*epsilon)));
  }
  const m=new Matrix3().set(columns[0][0],columns[1][0],columns[2][0],columns[0][1],columns[1][1],columns[2][1],columns[0][2],columns[1][2],columns[2][2]);
  if(Math.abs(m.determinant())<1e-6)throw Error('Degenerate hand deformation');
  return new Vector3(...n).applyMatrix3(m.invert().transpose()).normalize().toArray();
}
interface Accessor {bufferView:number;byteOffset?:number;componentType:number;count:number;type:string;min?:number[];max?:number[];sparse?:unknown}
interface Doc {
  buffers:{byteLength:number;uri?:string}[];bufferViews:{buffer:number;byteOffset?:number;byteLength:number;byteStride?:number}[];
  accessors:Accessor[];nodes:{name?:string}[];skins:{joints:number[];inverseBindMatrices:number}[];
  meshes:{primitives:{attributes:Record<string,number>;targets?:unknown}[]}[];extras?:Record<string,unknown>;
}
/** V2-specific neutral hand shape. Animation, skin weights, UVs and downloaded originals stay untouched. */
export function relaxHandsGlb(source:Uint8Array):Buffer{
  const input=Buffer.from(source);
  if(input.length<28||input.readUInt32LE(0)!==0x46546c67||input.readUInt32LE(4)!==2||input.readUInt32LE(8)!==input.length||input.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB');
  const jsonLength=input.readUInt32LE(12),header=20+jsonLength;
  if(header+8>input.length||input.readUInt32LE(header+4)!==0x004e4942||header+8+input.readUInt32LE(header)!==input.length)throw Error('Expected embedded binary GLB');
  const doc=JSON.parse(input.subarray(20,header).toString()) as Doc;
  if(doc.extras?.relaxedHands)throw Error('Relaxed hand shape already applied');
  if(doc.buffers.length!==1||doc.buffers[0].uri||doc.skins.length!==1||doc.meshes.length!==1)throw Error('Expected original Meshy v2 layout');
  const binary=input.subarray(header+8),parts=[binary];let offset=binary.length,changed=0;
  function read(index:number,components:number){
    const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??components*4;
    if(a.componentType!==5126||a.sparse||v.buffer!==0||start+(a.count-1)*stride+components*4>binary.length)throw Error('Unsupported float accessor');
    return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,c)=>binary.readFloatLE(start+i*stride+c*4)));
  }
  function append(values:number[][]){
    const data=Buffer.alloc(values.length*12);values.forEach((p,i)=>p.forEach((v,c)=>data.writeFloatLE(v,i*12+c*4)));
    const view=doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length})-1;parts.push(data);offset+=data.length;
    return doc.accessors.push({bufferView:view,componentType:5126,count:values.length,type:'VEC3',min:[0,1,2].map(c=>Math.min(...values.map(p=>p[c]))),max:[0,1,2].map(c=>Math.max(...values.map(p=>p[c])))})-1;
  }
  const skin=doc.skins[0],binds=read(skin.inverseBindMatrices,16);
  const wrists=([['Left',1],['Right',-1]] as const).map(([name,side])=>{
    const joint=skin.joints.findIndex(i=>doc.nodes[i].name===`${name}Hand`);if(joint<0)throw Error('Missing hand joint');
    const wrist=new Vector3().setFromMatrixPosition(new Matrix4().fromArray(binds[joint]).invert());
    if(wrist.x*side<.50||wrist.x*side>.55||wrist.y<1.12||wrist.y>1.18)throw Error('Hand calibration only supports this Meshy v2 model');
    return {side,wrist};
  });
  for(const primitive of doc.meshes[0].primitives){
    if(primitive.targets||primitive.attributes.TANGENT!==undefined)throw Error('Morphs/tangents need a separate deformation path');
    const positions=read(primitive.attributes.POSITION,3),normals=read(primitive.attributes.NORMAL,3);
    if(positions.length!==normals.length)throw Error('Attribute counts differ');
    positions.forEach((p,i)=>{
      const hand=wrists.find(h=>p[0]*h.side>h.wrist.x*h.side+.028&&Math.abs(p[1]-h.wrist.y)<.10&&Math.abs(p[2]-h.wrist.z)<.12);
      if(!hand)return;const {side,wrist}=hand,local=[(p[0]-wrist.x)*side,p[1]-wrist.y,p[2]-wrist.z],next=relaxHandPoint(local);
      if(Math.hypot(...next.map((v,c)=>v-local[c]))<1e-10)return;
      const n=relaxHandNormal(local,[normals[i][0]*side,normals[i][1],normals[i][2]]);
      positions[i]=[wrist.x+next[0]*side,wrist.y+next[1],wrist.z+next[2]];normals[i]=[n[0]*side,n[1],n[2]];changed++;
    });
    primitive.attributes.POSITION=append(positions);primitive.attributes.NORMAL=append(normals);
  }
  if(changed<50)throw Error('No valid finger geometry found');
  doc.buffers[0].byteLength=offset;doc.extras={...doc.extras,relaxedHands:{version:1,changedVertices:changed,fingerCurvature:18,thumbCurvature:12}};
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const result=Buffer.alloc(28+json.length+offset);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(json.length,12);result.writeUInt32LE(0x4e4f534a,16);json.copy(result,20);result.writeUInt32LE(offset,20+json.length);result.writeUInt32LE(0x004e4942,24+json.length);Buffer.concat(parts).copy(result,28+json.length);return result;
}
