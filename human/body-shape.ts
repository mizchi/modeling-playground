import type { HumanBodyShape, HumanModel } from './contract.ts';
import type { PointKind, HumanPoint } from './shape.ts';
import { shapeBodyPoint } from './body.ts';

const smooth=(t: number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const bell=(x: number,c: number,r: number)=>Math.exp(-(((x-c)/r)**2));

// Centerlines follow the authored thigh/shin anchors, not the world origin;
// increasing muscle thickness must not push both legs apart or move the feet.
function legAxis(y: number,model: HumanModel) {
  const a=y>=.585?[.15,.585,.025]:[.17,.16,-.015];
  const b=y>=.585?[.12,1.025,0]:[.15,.585,.025];
  const t=Math.max(0,Math.min(1,(y-a[1])/(b[1]-a[1])));
  return shapeBodyPoint([a[0]+(b[0]-a[0])*t,y,a[2]+(b[2]-a[2])*t],model,'rig');
}

/** Continuous rest-space shape layer, after the body preset, before face edits.
 * Chest/limb volume changes affect the surface only; shoulder width and waist
 * proportions transform joint anchors too. Input is already contract-validated. */
export function applyBodyShape(point: HumanPoint,shape: HumanBodyShape,kind: PointKind,model: HumanModel): HumanPoint {
  const {chestSize,waistWidth,muscularity}=shape;
  if(kind==='hair'||point[1]>=1.65||point[1]<=.18||(!chestSize&&!waistWidth&&!muscularity))return point;
  const [x,y,z]=point,ax=Math.abs(x),sign=Math.sign(x);
  const neckFade=1-smooth((y-1.53)/.12);
  const torso=1-smooth((ax-.23)/.09);
  const waist=bell(y,1.24,.13)*torso;
  const shoulders=bell(y,1.535,.12)*neckFade*smooth(ax/.26);
  let px=x+sign*.035*muscularity*shoulders,py=y,pz=z;
  if(kind==='body') {
    const chest=bell(ax,.09,.10)*bell(y,1.435,.085)*torso*neckFade*smooth(z/.10);
    pz+=.065*chestSize*chest;
    pz*=1+.22*muscularity*bell(y,1.455,.14)*torso*neckFade;
    const arm=smooth((ax-.25)/.12)*bell(y,1.535,.16);
    const armVolume=muscularity*arm*(.32*bell(ax,.45,.15)+.22*bell(ax,.72,.12));
    py+=(y-1.535)*armVolume;pz+=z*armVolume;
    const legVolume=muscularity*(.22*bell(y,.83,.14)+.19*bell(y,.39,.12))*(1-smooth((y-1.00)/.10))*smooth((y-.18)/.12);
    const [cx,,cz]=legAxis(y,model);
    px+=(x-sign*cx)*legVolume;pz+=(z-cz)*legVolume;
  }
  px*=1+.32*waistWidth*waist;pz*=1+.24*waistWidth*waist;
  return [px,py,pz];
}
