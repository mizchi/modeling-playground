import { LinearFilter } from 'three';
import { pixelPainter } from '../modeling/pixel-atlas.mjs';

export const LUMI_SKIN='#efd6b9';
export const lumiFaceUV=([x,y])=>[.5+x/.48,(2.23-y)/.48];

export function createLumiTexture() {
  const p=pixelPainter(256);p.rect(0,0,256,256,LUMI_SKIN);
  const xy=v=>lumiFaceUV(v).map(n=>n*256);
  const poly=(points,color)=>p.poly(points.map(xy),color);
  const line=(points,color,width=1)=>points.slice(1).forEach((b,i)=>p.line(...xy(points[i]),...xy(b),color,width));
  const oval=(x,y,rx,ry,color)=>poly(Array.from({length:24},(_,i)=>[x+rx*Math.cos(i*Math.PI/12),y+ry*Math.sin(i*Math.PI/12)]),color);
  for(const side of [-1,1]) {
    const x=side*.102,y=1.932;
    oval(x+side*.018,y-.05,.029,.009,'#e8b5a2');
    const eye=[[-.052,-.001],[-.040,.021],[-.012,.031],[.018,.029],[.045,.012],[.053,-.005],[.029,-.025],[-.013,-.029],[-.042,-.015]];
    poly(eye.map(([a,b])=>[x+a,y+b]),'#fff9e9');
    oval(x,y,.024,.028,'#416f7a');oval(x,y-.012,.020,.015,'#7bb6bc');
    oval(x,y+.003,.010,.022,'#293f50');
    oval(x-.009,y+.015,.0075,.0085,'#ffffff');oval(x+.012,y-.013,.0035,.004,'#d7eeed');
    line(eye.slice(0,6).map(([a,b])=>[x+a,y+b]),'#51463f',2);
    line([[x+side*.045,y+.012],[x+side*.062,y+.026]],'#51463f');
    line([[x-.032,y-.024],[x+.006,y-.029],[x+.035,y-.020]],'#bc9581');
    line([[x-.038,1.982],[x,1.987],[x+.04,1.980]],'#9a7b4d',1);
  }
  line([[.006,1.872],[.010,1.864],[.005,1.862]],'#d6ae94');
  line([[-.022,1.819],[0,1.814],[.023,1.820]],'#b17b70',1);
  // Isolated constant-color samples: plain training suit, boots and skin.
  p.rect(0,0,16,16,'#284c59');p.rect(16,0,16,16,'#273847');
  const texture=p.texture('LUMI face / neutral');texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;
  return texture;
}
