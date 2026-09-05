import { DataTexture, RGBAFormat, NearestFilter, SRGBColorSpace } from 'three';

/** Tile rectangles are integer [left, top, width, height]; local UV is bottom-up. */
export function atlasUV(tile,u,v,size) {
  const [x,y,w,h]=tile;
  if(!Number.isInteger(size)||size<1||tile.length!==4||!tile.every(Number.isInteger)||
    x<0||y<0||w<1||h<1||x+w>size||y+h>size||![u,v].every(n=>Number.isFinite(n)&&n>=0&&n<=1))
    throw new Error('Invalid pixel atlas rectangle or UV');
  // Half-texel inset keeps sampling inside the selected island at its edges.
  return [(x+.5+u*(w-1))/size,(y+.5+(1-v)*(h-1))/size];
}

/** DOM-free, deterministic pixel drawing. Byte rows run top-to-bottom. */
export function pixelPainter(size) {
  if(!Number.isInteger(size)||size<1||size>2048)throw new Error('Invalid atlas size');
  const data=new Uint8Array(size*size*4);
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  function dot(x,y,color) {
    x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=size||y>=size)return;
    data.set([...rgb(color),255],(y*size+x)*4);
  }
  function rect(x,y,w,h,color){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)dot(i,j,color);}
  function line(x0,y0,x1,y1,color,width=1) {
    const steps=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));
    for(let i=0;i<=steps;i++){const t=steps?i/steps:0;rect(Math.round(x0+(x1-x0)*t),Math.round(y0+(y1-y0)*t),width,width,color);}
  }
  function poly(points,color) {
    const min=Math.floor(Math.min(...points.map(p=>p[1]))),max=Math.ceil(Math.max(...points.map(p=>p[1])));
    for(let y=min;y<=max;y++) {
      const hits=[];
      points.forEach(([x0,y0],i)=>{const [x1,y1]=points[(i+1)%points.length];
        if((y0<=y+.5&&y1>y+.5)||(y1<=y+.5&&y0>y+.5))hits.push(x0+(y+.5-y0)/(y1-y0)*(x1-x0));});
      hits.sort((a,b)=>a-b);
      for(let i=0;i<hits.length;i+=2)for(let x=Math.ceil(hits[i]);x<hits[i+1];x++)dot(x,y,color);
    }
  }
  function texture(name) {
    const result=new DataTexture(data,size,size,RGBAFormat);result.name=name;
    result.colorSpace=SRGBColorSpace;result.magFilter=NearestFilter;result.minFilter=NearestFilter;
    result.generateMipmaps=false;result.flipY=false;result.needsUpdate=true;return result;
  }
  return {data,dot,rect,line,poly,texture};
}
