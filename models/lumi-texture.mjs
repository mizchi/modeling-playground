import { LinearFilter } from 'three';
import { pixelPainter } from '../modeling/pixel-atlas.mjs';

export const LUMI_SKIN='#efd6b9';
export const LUMI_EYE_CENTER_X=.092;
export const lumiFaceUV=([x,y])=>[.5+x/.48,(2.23-y)/.48];

export function createLumiTexture() {
  const p=pixelPainter(256);p.rect(0,0,256,256,LUMI_SKIN);
  const xy=v=>lumiFaceUV(v).map(n=>n*256);
  const poly=(points,color)=>p.poly(points.map(xy),color);
  const line=(points,color,width=1)=>points.slice(1).forEach((b,i)=>p.line(...xy(points[i]),...xy(b),color,width));
  const oval=(x,y,rx,ry,color)=>poly(Array.from({length:24},(_,i)=>[x+rx*Math.cos(i*Math.PI/12),y+ry*Math.sin(i*Math.PI/12)]),color);
  const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const hex=rgb=>'#'+rgb.map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
  function iris(x,y) {
    oval(x,y,.027,.030,'#345359');
    const [cx,cy]=xy([x,y]),rx=.0245/.48*256,ry=.028/.48*256;
    for(let j=Math.floor(cy-ry);j<=cy+ry;j++)for(let i=Math.floor(cx-rx);i<=cx+rx;i++) {
      const u=(i-cx)/rx,v=(j-cy)/ry,r=u*u+v*v;if(r>1)continue;
      const t=(v+1)/2;
      let rgb=t<.48?mix([36,62,70],[61,135,143],t/.48):mix([61,135,143],[158,225,202],(t-.48)/.52);
      // Lower bounced light and a darker limbal edge read as a curved iris.
      const glow=Math.max(0,1-(u/.75)**2-((v-.52)/.48)**2)*.24;
      rgb=mix(rgb,[211,247,211],glow);
      rgb=mix(rgb,[36,70,76],Math.max(0,(r-.72)/.28)*.42);
      p.dot(i,j,hex(rgb));
    }
    oval(x,y+.003,.007,.0105,'#233d47');
    oval(x-.010,y+.015,.009,.010,'#a9e5df');
    oval(x-.011,y+.017,.0065,.0075,'#ffffff');
    oval(x+.011,y+.011,.0035,.0045,'#fffdf3');
    oval(x+.011,y-.018,.0045,.0025,'#d6f5d8');
  }
  for(const side of [-1,1]) {
    const x=side*LUMI_EYE_CENTER_X,y=1.932;
    oval(x+side*.018,y-.05,.029,.009,'#e8b5a2');
    const eye=[[-.052,-.001],[-.040,.021],[-.012,.031],[.018,.029],[.045,.012],[.053,-.005],[.029,-.025],[-.013,-.029],[-.042,-.015]];
    poly(eye.map(([a,b])=>[x+a,y+b]),'#fff9e9');
    poly([[-.050,0],[-.040,.021],[-.012,.031],[.018,.029],[.045,.012],[.051,-.001],[.020,.017],[-.014,.020],[-.040,.011]].map(([a,b])=>[x+a,y+b]),'#d4c9bc');
    iris(x,y);
    // A tapered polygon gives the upper liner thickness without a full black
    // outline around the eye. Mirror its outer wing, not the highlight light.
    poly([[-.054,-.002],[-.041,.020],[-.016,.034],[.020,.033],[.047,.014],[.065,.025],[.055,.002],[.047,.006],[.019,.024],[-.014,.026],[-.039,.013]].map(([u,v])=>[x+side*u,y+v]),'#49302b');
    line([[x+side*.021,y-.028],[x+side*.039,y-.019],[x+side*.052,y-.005]],'#b58b79');
    line([[x-side*.039,1.980],[x,1.988],[x+side*.038,1.981]],'#8c7049',1);
  }
  oval(-.004,1.889,.006,.0035,'#fff0d8');
  line([[.007,1.885],[.010,1.879],[.004,1.876]],'#d6ae94');
  line([[-.022,1.819],[0,1.814],[.023,1.820]],'#96675c',2);
  // Isolated constant-color samples: plain training suit, boots and skin.
  p.rect(0,0,16,16,'#284c59');p.rect(16,0,16,16,'#273847');
  p.rect(48,0,16,16,'#e3bfa4'); // Subtle ear bowl tint; painted facial features stay intact.
  const texture=p.texture('LUMI face / neutral');texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;
  return texture;
}
