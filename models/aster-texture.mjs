import { pixelPainter } from '../modeling/pixel-atlas.mjs';
import { LinearFilter } from 'three';
import { ASTER } from './aster-definition.mjs';

export const ASTER_ATLAS=Object.freeze({version:1,size:256,active:'Neutral',
  tiles:['Neutral','Happy','Angry','Surprised','Blink','Wink'].map((name,i)=>({name,rect:[i%3*80,Math.floor(i/3)*80,80,80]}))});
export const asterFaceUV=(x,y)=>[(x+.27)/.54,(y-1.54)/.46];

/** Editable front design: painted eyes, restrained nose accent, and small mouth. */
export function createAsterAtlas() {
  const p=pixelPainter(256);
  for(const {name,rect:[ox,oy,w,h]} of ASTER_ATLAS.tiles) {
    p.rect(ox,oy,w,h,ASTER.palette.skin);
    const xy=([x,y])=>{const [u,v]=asterFaceUV(x,y);return [ox+.5+u*(w-1),oy+.5+(1-v)*(h-1)];};
    const poly=(points,color)=>p.poly(points.map(xy),color);
    const line=(points,color,width=1)=>points.slice(1).forEach((b,i)=>p.line(...xy(points[i]),...xy(b),color,width));
    const oval=(x,y,rx,ry,color)=>poly(Array.from({length:24},(_,i)=>[x+rx*Math.cos(i*Math.PI/12),y+ry*Math.sin(i*Math.PI/12)]),color);
    for(const side of [-1,1]) {
      const x=side*.116,y=1.786,happy=name==='Happy',angry=name==='Angry',wide=name==='Surprised';
      const closed=name==='Blink'||happy||name==='Wink'&&side===1;
      oval(x+side*.020,1.72,.033,.012,'#edb5a3');
      if(closed)line([[x-.05,y],[x,y+(happy?.017:-.009)],[x+.05,y]],'#433c3a',2);
      else {
        const tilt=angry?side*.012:side*.003,top=wide?.043:.033;
        const eye=[[-.057,0],[-.040,top],[.012,top+.002],[.051,.015],[.055,-.009],[.027,-.030],[-.016,-.034],[-.048,-.017]];
        poly(eye.map(([a,b])=>[x+a,y+b+tilt*a/.055]),'#fff5df');
        oval(x,y-.001,.027,wide?.037:.030,'#416169');
        oval(x,y-.014,.021,.016,'#81b7ad');
        oval(x,y+.003,.012,.026,'#293d48');
        oval(x-.011,y+.018,.009,.010,'#fffbea');
        oval(x+.014,y-.018,.004,.005,'#e1eada');
        line(eye.slice(0,4).map(([a,b])=>[x+a,y+b+tilt*a/.055]),'#393735',2);
        line([[x+side*.049,y+.011+tilt*side],[x+side*.066,y+.026+tilt*side]],'#393735');
        line([[x-.033,y-.029],[x+.018,y-.034],[x+.045,y-.02]],'#9e7365');
      }
      line([[x-.039,1.859-(angry?side*.012:0)],[x+.002,1.867],[x+.043,1.859+(angry?side*.012:0)]],'#855b45');
    }
    line([[.003,1.727],[.011,1.716],[.003,1.712]],'#d6a78e');
    if(name==='Surprised')oval(0,1.663,.015,.022,'#925e55');
    else if(name==='Happy') {
      poly([[-.035,1.682],[.035,1.682],[.021,1.650],[0,1.644],[-.024,1.657]],'#88554f');
      line([[-.018,1.654],[.012,1.652]],'#d99284');
    } else line([[-.024,1.670],[0,name==='Angry'?1.675:1.664],[.027,1.674]],'#9c6b5d');
  }
  const texture=p.texture('Aster · face design / six expressions');
  texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;
  return texture;
}
