import { pixelPainter } from '../modeling/pixel-atlas.mjs';
import { paintAshleyFace } from './ashley-face.mjs';

// Keep texture islands and model UV authoring in one explicit, shared contract.
export const ASHLEY_TILES=Object.freeze(Object.fromEntries(Object.entries({
  face:[0,0,96,96],skin:[96,0,64,96],hair:[160,0,96,96],
  bib:[0,96,64,80],leather:[64,96,64,80],steel:[128,96,64,80],cloth:[192,96,64,80],
  boot:[0,176,64,80],belt:[64,176,64,32],sole:[64,208,64,48],back:[128,176,64,80],ear:[192,176,64,80],
  ivoryHem:[14,140,34,35],neck:[114,4,28,22],
  waistLeather:[70,183,18,22],waistBuckle:[91,180,17,24],
}).map(([key,value])=>[key,Object.freeze(value)])));

/** Hand-authored pixel atlas, not a crop of copyrighted game textures. */
export function createAshleyAtlas() {
  const p=pixelPainter(256);p.rect(0,0,256,256,'#39302a');
  const colors={face:'#b9a17b',skin:'#b69a70',hair:'#684321',bib:'#b4b4a5',leather:'#8a5b2c',
    steel:'#303535',cloth:'#223b42',boot:'#89612f',belt:'#765124',sole:'#333029',back:'#b69a70',ear:'#b59a74'};
  // Restrained 2px clusters, broad painted shadows, no high-frequency white noise.
  for(const [id,[ox,oy,w,h]] of Object.entries(ASHLEY_TILES)) {
    if(!colors[id])continue; // Intentional sub-regions of an existing island.
    const base=[1,3,5].map(i=>parseInt(colors[id].slice(i,i+2),16));
    for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2) {
      const n=((x*17+y*37+x*y*3)%19-9)*.65;
      const edge=-12*Math.abs(x/w-.5)*2+5*Math.cos(y/h*Math.PI);
      const color='#'+base.map(v=>Math.max(0,Math.min(255,Math.round(v+n+edge))).toString(16).padStart(2,'0')).join('');
      p.rect(ox+x,oy+y,2,2,color);
    }
  }
  paintAshleyFace(p);
  // Skin tile: painted muscles, collarbone / elbow shading.
  p.poly([[106,42],[115,50],[116,72],[111,80],[106,67]],'#c3a87d');
  p.poly([[145,44],[140,53],[141,73],[147,83],[151,65]],'#9a8059');
  p.line(112,85,141,87,'#8a7352',2);
  // Hair bands follow each lock's V direction, with an amber bevel on one edge.
  for(let i=0;i<12;i++) {
    const x=161+i*8;p.poly([[x,0],[x+5,0],[x+2,43],[x+5,95],[x+1,95],[x-2,44]],i%3?'#76502a':'#4e341e');
    p.line(x+4,2,x+1,43,'#916331');p.line(x+1,43,x+5,93,'#82582b');
  }
  // Ivory halter: collar piping, chain clasp, folds and laced side borders.
  p.poly([[1,96],[12,111],[9,146],[13,175],[3,175],[0,137]],'#72766f');
  p.poly([[63,96],[52,111],[55,146],[50,175],[62,175]],'#85887e');
  p.poly([[10,124],[25,129],[54,123],[51,128],[23,134],[10,131]],'#989e93');
  p.poly([[12,150],[36,146],[52,149],[52,153],[31,152],[12,156]],'#94988b');
  p.line(9,97,24,111,'#555d57',2);p.line(54,97,38,112,'#555d57',2);
  for(let j=0;j<5;j++) {
    const y=104+j*4;p.line(29-j, y,33+j,y+3,'#555951',2);p.line(33+j,y,29-j,y+3,'#d2d0b9');
  }
  for(let y=133;y<173;y+=6){p.line(2,y,8,y+3,'#343b36',2);p.line(61,y,55,y+3,'#343b36',2);}
  // Leather skirt panels: inset borders, edge wear, seam ladder, rivets.
  p.rect(67,98,3,75,'#4d371f');p.rect(121,98,3,75,'#4d371f');
  p.rect(71,100,2,70,'#ad7c3b');p.rect(117,100,2,70,'#b28545');
  p.rect(73,166,44,3,'#ba9153');p.rect(73,170,46,3,'#493826');
  p.poly([[78,103],[84,104],[83,153],[89,164],[77,164]],'#996a33');
  p.line(96,104,96,164,'#4e3c27',2);
  for(let y=105;y<165;y+=7){p.line(92,y,99,y+4,'#c1a16b');p.rect(74,y,2,2,'#c9af73');p.rect(115,y,2,2,'#c9af73');}
  // Gauntlets are dark banded plates, not shiny modern chrome.
  for(let y=98;y<175;y+=16) {
    p.rect(129,y,62,3,'#171f23');p.rect(133,y+4,52,2,'#59615b');
    p.line(135,y+7,147,y+11,'#424c4a',2);p.line(147,y+11,181,y+7,'#424c4a',2);
  }
  p.rect(130,97,3,78,'#1c2528');p.rect(186,97,3,78,'#1c2528');
  p.line(145,109,150,118,'#757770');p.line(176,139,172,145,'#696d64');
  // Blue-black undershorts with a faded edge and diagonal seam.
  p.poly([[195,99],[209,109],[214,168],[202,174]],'#29464b');
  p.poly([[252,99],[239,108],[233,173],[250,173]],'#152e35');
  p.line(202,101,227,166,'#56605a');p.line(224,168,250,170,'#9e9575',2);
  // Boots: ochre shin braces and criss-cross leather straps.
  p.rect(4,179,3,73,'#4d3923');p.rect(56,179,3,73,'#4d3923');
  p.poly([[22,180],[41,180],[39,214],[32,229],[24,214]],'#a17638');
  for(const y of [182,198,216,235]) {
    p.line(8,y,52,y+12,'#493a29',4);p.line(8,y+2,52,y+14,'#b18a4c');
    p.line(52,y,9,y+11,'#503b24',3);p.line(52,y,9,y+11,'#ad8144');
  }
  p.rect(70,182,52,4,'#b48b49');p.rect(70,202,52,3,'#422f1e');
  p.rect(91,180,17,24,'#2b302c');p.rect(94,183,11,18,'#b3a47b');p.rect(97,186,5,12,'#654c29');
  for(let y=212;y<255;y+=8)p.line(66,y,126,y,'#504731',2);
  // Back and ears get their own regions; do not repeat the face on the skull.
  p.poly([[130,181],[148,193],[151,222],[144,241],[134,245]],'#9e825b');
  p.poly([[189,181],[171,193],[168,222],[175,241],[185,245]],'#9e825b');
  p.line(159,188,159,248,'#937a57',2);
  p.poly([[207,186],[236,183],[245,201],[230,235],[211,231],[203,210]],'#947b58');
  p.poly([[213,194],[232,191],[236,204],[223,220],[215,214]],'#786347');
  p.line(211,195,212,218,'#c6ae86',3);
  return p.texture('Ashley • hand-painted 256px atlas');
}
