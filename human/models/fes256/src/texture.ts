import type { Vec2, Tile } from '../../../../modeling/types.ts';
import { pixelPainter } from '../../../../modeling/pixel-atlas.ts';
import { EXPRESSION_NAMES } from './definition.ts';
export const FES256_ATLAS=Object.freeze({version:1,size:256,active:'Neutral',tiles:['Neutral',...EXPRESSION_NAMES].map((name,i)=>({name,rect:[i%3*80,Math.floor(i/3)*80,80,80] as Tile}))});
export const faceUV=(x: number,y: number): Vec2=>[(x+.26)/.52,(y-1.10)/.40];

/** Editable pixel drawing, not a crop from the reference artwork. */
export function createFes256Atlas() {
  const painter=pixelPainter(FES256_ATLAS.size);
  for(const {name,rect:[ox,oy,w,h]} of FES256_ATLAS.tiles) {
    const toPixel=([x,y]: number[]): Vec2=>{const [u,v]=faceUV(x,y);return [ox+.5+u*(w-1),oy+.5+(1-v)*(h-1)];};
    const poly=(points: number[][],color: string)=>painter.poly(points.map(toPixel),color);
    const line=(points: number[][],color: string,width=1)=>points.slice(1).forEach((p,i)=>painter.line(...toPixel(points[i]),...toPixel(p),color,width));
    const ellipse=(x: number,y: number,rx: number,ry: number,color: string)=>poly(Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return [x+rx*Math.cos(a),y+ry*Math.sin(a)];}),color);
    const happy=name==='Happy',angry=name==='Angry',surprised=name==='Surprised';
    for(const side of [-1,1]) {
      const x=side*.122,y=1.31,closed=name==='Blink'||name==='Wink'&&side===1||happy;
      const arc=(width: number,height: number,tilt=0)=>Array.from({length:17},(_,i)=>{const t=i/16,s=-Math.cos(t*Math.PI);return [x+s*width,y+Math.sin(t*Math.PI)*height+tilt*s];});
      if(closed)line(arc(.060,happy?.018:-.007),'#282a35',2);
      else {
        const tilt=angry?side*.012:0,top=surprised?.054:.045,bottom=surprised?.045:.037;
        poly([...arc(.065,top,tilt),...arc(.065,-bottom,tilt).reverse()],'#353344');
        poly([...arc(.058,top-.007,tilt),...arc(.058,-bottom+.005,tilt).reverse()],'#fff8ec');
        ellipse(x,y,.028,.034,'#7a663d');ellipse(x,y-.003,.023,.030,'#d2a953');
        ellipse(x,y-.014,.021,.016,'#efd37d');ellipse(x,y+.002,.008,.023,'#333445');
        ellipse(x-.010,y+.017,.008,.009,'#fffdf2');ellipse(x+.012,y-.014,.004,.004,'#fff7d9');
        line(arc(.065,top,tilt),'#292b39',2);
        line([[x+side*.052,y+.021+tilt*side],[x+side*.073,y+.035+tilt*side]],'#292b39');
      }
      const by=surprised?1.40:1.378,tilt=angry?side*.013:happy?-side*.006:0;
      line([[x-.045,by-tilt],[x,by+.003],[x+.045,by+tilt]],'#65717d');
      if(happy||name==='Wink') {
        line([[x+side*.030,1.264],[x+side*.037,1.250]],'#deae9d');
        line([[x+side*.045,1.264],[x+side*.052,1.250]],'#deae9d');
      }
    }
    if(surprised)ellipse(0,1.222,.018,.025,'#77535a');
    else if(happy) {
      poly([[-.047,1.229],[0,1.219],[.047,1.229],[.031,1.205],[0,1.198],[-.031,1.205]],'#79535a');
      ellipse(0,1.204,.020,.005,'#ce918e');
    } else line([[-.028,1.225],[0,angry?1.229:1.218],[.028,1.225]],'#846361');
  }
  return painter.texture('Lila · six hand-drawn expressions');
}
