import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { DataTexture, RGBAFormat, FloatType, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { encodeRgbaPng } from '../scripts/png.mjs';
import { exportGlb } from '../scripts/export_glb.mjs';

function decodeOwnPng(bytes) {
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),data=[],idat=[];
  for(let offset=8;offset<bytes.length;) {
    const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
    if(type==='IDAT')idat.push(bytes.subarray(offset+8,offset+8+length));offset+=length+12;
    if(type==='IEND')break; // GLB bufferViews can include trailing alignment bytes.
  }
  const raw=inflateSync(Buffer.concat(idat));
  for(let y=0;y<height;y++) {
    assert.equal(raw[y*(width*4+1)],0);
    data.push(...raw.subarray(y*(width*4+1)+1,(y+1)*(width*4+1)));
  }
  return {width,height,data};
}

test('PNG adapter preserves asymmetric RGBA rows, alpha, and explicit flipY',()=>{
  const image={width:2,height:2,data:new Uint8Array([255,0,0,255,0,255,0,128,0,0,255,64,21,42,63,0])};
  assert.deepEqual(decodeOwnPng(encodeRgbaPng(image)),{width:2,height:2,data:[...image.data]});
  assert.deepEqual(decodeOwnPng(encodeRgbaPng(image,true)).data,[...image.data.slice(8),...image.data.slice(0,8)]);
  assert.throws(()=>encodeRgbaPng({...image,width:3}),/RGBA8/);
  assert.throws(()=>encodeRgbaPng({...image,data:new Float32Array(16)}),/RGBA8/);
});

test('GLB adapter embeds shared PNG bytes without a browser, and restores FileReader on failure',async()=>{
  const map=new DataTexture(new Uint8Array([251,12,34,255,45,231,67,255]),1,2,RGBAFormat);
  const mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial({map}));
  const previous=globalThis.FileReader;
  const bytes=Buffer.from(await exportGlb(mesh));assert.equal(globalThis.FileReader,previous);
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+length));
  const view=json.bufferViews[json.images[0].bufferView],start=28+length+(view.byteOffset??0);
  assert.deepEqual(decodeOwnPng(bytes.subarray(start,start+view.byteLength)).data,[...map.image.data]);
  map.image.data=new Float32Array(8);map.type=FloatType;
  await assert.rejects(()=>exportGlb(mesh),/RGBA8/);assert.equal(globalThis.FileReader,previous);
});
