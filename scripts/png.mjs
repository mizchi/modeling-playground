import { deflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,bytes) {
  const body=Buffer.concat([Buffer.from(type),bytes]),header=Buffer.alloc(4),crc=Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(body));return Buffer.concat([header,body,crc]);
}

/** PNG boundary: tightly packed, top-down RGBA8 only; no canvas/native dependency. */
export function encodeRgbaPng({data,width,height},flipY=false) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||
    !(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||data.length!==width*height*4)
    throw new Error('PNG requires tightly packed RGBA8 pixels, dimensions 1..4096');
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) {
    const source=(flipY?height-1-y:y)*width*4;
    rows.set(data.subarray(source,source+width*4),y*(width*4+1)+1);
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),
    chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
