import {SPEC,PALETTE,DIRECTIONS,getRig} from './definition.mjs';
import {sampleWalk} from './motion.mjs';
import {pixelHead} from './pixel-head.mjs';

const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const d=Math.hypot(...a);return a.map(v=>v/(d||1));};

/** Orthographic 3D projection with a small downward camera pitch. */
export function project(point,direction) {
  const view=DIRECTIONS.find(d=>d.id===direction);
  if(!view) throw new Error('unknown direction');
  const [x,y,z]=point,c=Math.cos(view.yaw),s=Math.sin(view.yaw);
  const horizontal=x*c-z*s,depth=x*s+z*c;
  return [SPEC.anchor[0]+horizontal*SPEC.scale,
    SPEC.anchor[1]-(y*.98-depth*.20)*SPEC.scale,depth*.98+y*.20];
}

function ellipsoid(center,radii,base,transform) {
  const rings=6,slices=8,vertices=[],triangles=[];
  for(let row=0;row<=rings;row++) for(let column=0;column<slices;column++) {
    const latitude=Math.PI*row/rings,longitude=Math.PI*2*column/slices;
    let p=[Math.sin(latitude)*Math.cos(longitude)*radii[0],Math.cos(latitude)*radii[1],
      Math.sin(latitude)*Math.sin(longitude)*radii[2]];
    if(transform) p=transform(p);
    vertices.push(p.map((v,i)=>v+center[i]));
  }
  for(let row=0;row<rings;row++) for(let col=0;col<slices;col++) {
    const a=row*slices+col,b=row*slices+(col+1)%slices,c=b+slices,d=a+slices;
    triangles.push({points:[vertices[a],vertices[b],vertices[d]],base},
      {points:[vertices[b],vertices[c],vertices[d]],base});
  }
  return triangles;
}

function limb(a,b,radius,base) {
  const axis=norm(sub(b,a)),x=norm(cross(axis,[0,0,1])),z=cross(x,axis);
  return ellipsoid(a.map((v,i)=>(v+b[i])/2),[radius,Math.hypot(...sub(b,a))/2+radius*.35,radius],base,
    p=>[0,1,2].map(i=>x[i]*p[0]+axis[i]*p[1]+z[i]*p[2]));
}

function geometry(pose,colored,rig) {
  const s=rig.bodyScale,w=rig.bodyWidth,h=rig.headScale,r=rig.limbWidth;
  const meshes=[
    ...ellipsoid(pose.pelvis,[.16*w,.13*s,.115*w],2),
    ...ellipsoid([pose.pelvis[0],pose.chest[1]-.16*s,.01*s],[.14*w,.18*s,.115*w],2),
    ...ellipsoid(pose.chest,[.205*w,.26*s,.13*w],2),
    ...ellipsoid([pose.head[0],pose.head[1]-rig.headHeight/2-.015*s,.028*s],[.065*w,.085*s,.065*w],rig.pixelHead?2:11),
  ];
  if(!rig.pixelHead) {
    meshes.push(
      ...ellipsoid(pose.head,[.13*h,rig.headHeight/2,.13*h],11),
      // Nose and eye marks identify front versus back without a texture atlas.
      ...ellipsoid([pose.head[0],pose.head[1]-.025*h,pose.head[2]+.139*h],[.035*h,.045*h,.042*h],11),
    );
    for(const sign of [-1,1]) meshes.push(...ellipsoid(
      [pose.head[0]+sign*.052*h,pose.head[1]+.024*h,pose.head[2]+.120*h],[.022*h,.023*h,.018*h],14));
  }
  for(const [side,index] of [['left',5],['right',8]]) {
    const leg=pose[side],base=colored?index:2;
    meshes.push(...limb(leg.hip,leg.knee,.073*r,base),...limb(leg.knee,leg.ankle,.055*r,base),
      ...limb(leg.shoulder,leg.elbow,.065*r,base),...limb(leg.elbow,leg.wrist,.047*r,base),
      ...ellipsoid(leg.wrist,[.047*r,.060*s,.045*r],base),
      ...ellipsoid([leg.ankle[0],leg.ankle[1]-.025*s,leg.ankle[2]+.055*s],[.064*r,.05*s,.12*s],base));
  }
  return meshes;
}

const edge=(a,b,x,y)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);

/** Z-buffer rasterizer. Every output pixel is one palette index, never a filter. */
export function renderFrame(phase,direction='w',{colored=true,proportion='legacy'}={}) {
  const rig=getRig(proportion),pose=sampleWalk(phase,proportion),pixels=new Uint8Array(SPEC.width*SPEC.height);
  const depth=new Float64Array(pixels.length).fill(-Infinity);
  for(const triangle of geometry(pose,colored,rig)) {
    const [a,b,c]=triangle.points.map(p=>project(p,direction));
    const area=edge(a,b,c[0],c[1]);
    if(Math.abs(area)<1e-8) continue;
    const normal=norm(cross(sub(triangle.points[1],triangle.points[0]),sub(triangle.points[2],triangle.points[0])));
    const light=normal[0]*.3+normal[1]*.8+normal[2]*.45;
    const shade=triangle.base===14?0:light>.45?2:light>-.2?1:0;
    const color=triangle.base+shade;
    for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(SPEC.height-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++) {
      for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(SPEC.width-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++) {
        const u=edge(b,c,x+.5,y+.5)/area,v=edge(c,a,x+.5,y+.5)/area,w=1-u-v;
        if(u<0||v<0||w<0) continue;
        const d=u*a[2]+v*b[2]+w*c[2],i=y*SPEC.width+x;
        if(d>depth[i]) {depth[i]=d;pixels[i]=color;}
      }
    }
  }
  // 8-head pixel correction: use 3D placement, but never resample the tiny skull.
  // This walk keeps arms below the head; future overlapping actions need masks.
  const head=rig.pixelHead?pixelHead(direction,project(pose.head,direction)):null;
  if(head) head.pixels.forEach((color,i)=>{
    const x=head.x+i%head.width,y=head.y+Math.floor(i/head.width);
    if(color&&x>=0&&x<SPEC.width&&y>=0&&y<SPEC.height) pixels[y*SPEC.width+x]=color;
  });
  // Add a single logical pixel silhouette outline without changing interior masks.
  const filled=pixels.slice();
  for(let y=1;y<SPEC.height-1;y++) for(let x=1;x<SPEC.width-1;x++) {
    const i=y*SPEC.width+x;
    if(!filled[i]&&[i-1,i+1,i-SPEC.width,i+SPEC.width].some(j=>filled[j])) pixels[i]=1;
  }
  return {width:SPEC.width,height:SPEC.height,pixels,...(head?{head}:{})};
}

export function toRgba(frame) {
  const data=new Uint8Array(frame.pixels.length*4);
  frame.pixels.forEach((index,i)=>data.set(PALETTE[index],i*4));
  return {width:frame.width,height:frame.height,data};
}

export function buildSheet(options={}) {
  const width=SPEC.width*SPEC.frames,height=SPEC.height*DIRECTIONS.length,pixels=new Uint8Array(width*height);
  DIRECTIONS.forEach((direction,row)=>{
    for(let column=0;column<SPEC.frames;column++) {
      const frame=renderFrame(column/SPEC.frames,direction.id,options);
      for(let y=0;y<SPEC.height;y++) pixels.set(frame.pixels.subarray(y*SPEC.width,(y+1)*SPEC.width),
        (row*SPEC.height+y)*width+column*SPEC.width);
    }
  });
  return {width,height,pixels};
}
