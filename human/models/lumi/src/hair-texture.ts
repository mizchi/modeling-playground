import { LinearFilter } from 'three';
import { pixelPainter } from '../../../../modeling/pixel-atlas.ts';

/** Root-to-tip (V) and edge-to-edge (U) shading shared by every closed lock.
 * Low-amplitude pigment variation, not transparency or a normal/displacement map. */
export function createLumiHairTexture() {
  const size=128,p=pixelPainter(size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/(size-1),v=y/(size-1);
    const dome=Math.sin(Math.PI*u)**2;
    const shine=10*Math.exp(-(((v-.34)/.18)**2))*dome;
    const flow=1.2*Math.sin((u+.035*Math.sin(v*3))*Math.PI*12)*Math.sin(Math.PI*v);
    const lift=5*dome+shine+flow;
    const rgb=[201+8*v+lift,174+7*v+lift,103+5*v+lift*.8];
    p.dot(x,y,'#'+rgb.map(n=>Math.round(n).toString(16).padStart(2,'0')).join(''));
  }
  const texture=p.texture('LUMI hair / soft blonde flow');
  texture.magFilter=LinearFilter;texture.minFilter=LinearFilter;
  return texture;
}
