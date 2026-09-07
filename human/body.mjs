/** Same cage and joint vocabulary, independently authored body proportions.
 * This is one stylized female preset, not a universal anatomical definition. */
const widths=[[0,1],[.16,1],[.585,1.02],[.90,1.10],[1.025,1.12],
  [1.115,1.08],[1.24,.82],[1.40,.92],[1.46,.90],[1.535,.88],[1.61,.90],[1.65,1]];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const bell=(x,c,r)=>Math.exp(-(((x-c)/r)**2));
function widthAt(y) {
  for(let i=1;i<widths.length;i++)if(y<=widths[i][0]) {
    const [a,wa]=widths[i-1],[b,wb]=widths[i];return wa+(wb-wa)*smooth((y-a)/(b-a));
  }
  return 1;
}

export function shapeBodyPoint(point,model,kind='body') {
  if(model!=='base45-female'||kind==='hair'||point[1]>=1.65)return point;
  const [x,y,z]=point,ax=Math.abs(x),w=widthAt(y);
  // Move shoulder anchors together with the arms, then preserve most arm length.
  const px=Math.sign(x)*(ax<=.29?ax*w:.29*w+(ax-.29)*.94);
  const arm=smooth((ax-.28)/.10)*smooth((y-1.30)/.13);
  const py=y+(1.535-y)*arm*.10;
  let pz=z*(1-arm*.12);
  if(kind==='body') {
    const torso=1-smooth((ax-.22)/.08),front=smooth(z/.10),back=smooth(-z/.10);
    pz*=1-.12*bell(y,1.24,.105)*torso;
    pz+=.039*bell(ax,.09,.075)*bell(y,1.43,.080)*front*torso;
    pz-=.022*bell(y,1.055,.105)*back*torso;
  }
  return [px,py,pz];
}
