/** Shared anatomical landmarks for both vertex relief and painted face features. */
export const FACE_ANATOMY=Object.freeze({bottom:1.608,top:1.856,eyeY:1.736,browY:1.753,
  noseTipY:1.692,noseBaseY:1.675,mouthY:1.657});

// Eye aperture/UV contract shared with the feature loops. Both ocular surfaces
// face +Z; their orientation is independent of the cheek's curved envelope.
export const EYE_SURFACE=Object.freeze({centerX:.41,centerY:FACE_ANATOMY.eyeY-.003,
  innerRadii:Object.freeze([.245,.009]),outerRadii:Object.freeze([.30,.020]),apexZ:.081});

function forwardEyeDepth(x,y,envelopeZ) {
  const eye=EYE_SURFACE,dx=Math.abs(x)-eye.centerX,dy=y-eye.centerY;
  const inner=Math.hypot(dx/eye.innerRadii[0],dy/eye.innerRadii[1]);
  const outer=Math.hypot(dx/eye.outerRadii[0],dy/eye.outerRadii[1]);
  if(outer>=1)return envelopeZ;
  const t=inner<=1?1:(1-outer)/(inner-outer),weight=t*t*(3-2*t);
  const ocularZ=eye.apexZ-.006*(dx/eye.innerRadii[0])**2-.002*(dy/eye.innerRadii[1])**2;
  return envelopeZ+(ocularZ-envelopeZ)*weight;
}

// Shape contract, independent of the topology: [Y, half-width, front Z, nose,
// rear depth, mandibular side rise, mandibular rear rise].
export const FACE_SECTIONS=Object.freeze([
  [FACE_ANATOMY.bottom,.066,.096,0,.060,.018,.043],[1.629,.090,.100,0,.077,.011,.043],
  [1.650,.095,.103,.002,.090,.012,.032],[FACE_ANATOMY.noseBaseY,.099,.102,.005,.092,.014,.025],
  [FACE_ANATOMY.noseTipY,.104,.102,.035,.100,.012,.022],[1.712,.106,.104,.023,.104,.006,.017],
  [FACE_ANATOMY.eyeY,.105,.100,.015,.109,0,.010],[FACE_ANATOMY.browY,.105,.102,.017,.109,0,.005],
  [1.793,.103,.099,.007,.111,0,0],[1.829,.091,.086,0,.103,0,0],[FACE_ANATOMY.top,.067,.061,0,.079,0,0],
].map(Object.freeze));

/** Sample the continuous shape at a face-local UV coordinate (normalized X, Y). */
export function facialPoint(x,y) {
  const upper=FACE_SECTIONS.findIndex(row=>row[0]>=y);
  if(upper<0||y<FACE_ANATOMY.bottom||Math.abs(x)>1)throw new RangeError('Outside facial envelope');
  const a=FACE_SECTIONS[Math.max(0,upper-1)],b=FACE_SECTIONS[upper];
  const t=a===b?0:(y-a[0])/(b[0]-a[0]);
  const [,rx,z,nose,,rise]=a.map((v,i)=>v+(b[i]-v)*t);
  return [x*rx,y+rise*Math.max(0,(Math.abs(x)-.45)/.55),
    forwardEyeDepth(x,y,z*facialFrontFactor(x)+nose*Math.exp(-((x/.23)**2))+facialRelief(x,y))];
}
const bell=(value,center,width)=>Math.exp(-(((value-center)/width)**2));
const pixelY=y=>Math.round((FACE_ANATOMY.top-y)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)*95);

/** One continuous facial envelope; no eye-height-specific forward extrusion. */
export function facialFrontFactor(x) {
  return 1-Math.abs(x)**3;
}

/** X is normalized to the half-width of the corresponding facial ring. */
export function facialRelief(x,y) {
  const lateral=Math.abs(x);
  // A deeper medial/upper socket contrasts with the unchanged nasal ridge.
  // Keep a broad socket floor, then fade out before the cheek's main plane.
  // The midline mask preserves the nose itself exactly.
  const socketY=FACE_ANATOMY.eyeY+.002;
  const verticalFalloff=y>socketY?bell(y,socketY,.009):Math.exp(-(((y-socketY)/.018)**4));
  const socket=-.018*bell(lateral,.42,.25)*verticalFalloff
    *(1-bell(lateral,0,.16));
  return socket
    -.0025*bell(lateral,.43,.25)*bell(y,1.721,.009)*(1-bell(lateral,0,.16)) // soften the lower lid-to-cheek rim
    +.002*bell(lateral,.46,.25)*bell(y,FACE_ANATOMY.browY,.011)
    -.003*bell(lateral,.75,.20)*bell(y,1.679,.025) // broad lateral cheek hollow, not an isolated cheekbone bump
    +.001*bell(lateral,.70,.28)*bell(y,1.650,.023);
}

/** Low-resolution tonal painting: anatomy first, line details last. */
export function paintAshleyFace(p) {
  const eye=pixelY(FACE_ANATOMY.eyeY),brow=pixelY(FACE_ANATOMY.browY);
  const tip=pixelY(FACE_ANATOMY.noseTipY),base=pixelY(FACE_ANATOMY.noseBaseY),mouth=pixelY(FACE_ANATOMY.mouthY);
  for(let y=0;y<96;y++)for(let x=0;x<96;x++) {
    // Broad tonal fields are quantized to texels, not large flat cheek polygons.
    const grain=(((Math.floor(x/2)*13+Math.floor(y/2)*7)%11)-5)*.30;
    let light=4*bell(x,48,27)*bell(y,24,21)-17*(Math.abs(x-47.5)/47.5)**2;
    for(const cx of [28,67]) {
      light-=30*bell(x,cx,14)*bell(y,eye-2,5); // shallow orbital shadow under the brow
      light-=6*bell(x,cx,14)*bell(y,eye+6,4);
      light+=8*bell(x,cx-3,12)*bell(y,pixelY(1.712),8); // broad cheekbone transition
      light-=7*bell(x,cx-3,12)*bell(y,pixelY(1.680),9); // gentle cheek hollow
      light+=5*bell(x,cx-2,10)*bell(y,pixelY(1.650),4); // mandibular plane
    }
    light+=7*bell(x,48,19)*bell(y,89,7); // chin, without a graphic outline
    light+=14*bell(x,49,3.5)*bell(y,tip-8,12);
    light-=26*bell(x,42,4)*bell(y,tip-6,11);
    light-=12*bell(x,48,9)*bell(y,base,2.2);
    light-=5*bell(x,48,10)*bell(y,mouth+5,2);
    const warm=3*bell(y,tip+1,9);
    const rgb=[185+light+grain+warm,161+light+grain,126+light+grain-warm];
    p.dot(x,y,'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v/2)*2)).toString(16).padStart(2,'0')).join(''));
  }
  for(const side of [0,1]) {
    const mirror=x=>side?95-x:x;
    const poly=(points,color)=>p.poly(points.map(([x,y])=>[mirror(x),y]),color);
    // A tapered outer tail and a low, defined inner brow frame a larger almond.
    poly([[13,brow+1],[23,brow-1],[31,brow],[41,brow+2],[40,brow+4],[31,brow+2],[23,brow+1]],'#4b3b27');
    p.line(mirror(30),brow+1,mirror(39),brow+3,'#403322');
    poly([[17,eye+1],[23,eye-1],[32,eye-1],[39,eye+1],[35,eye+4],[27,eye+5],[20,eye+3]],'#888771');
    // Keep the narrower horizontal iris; extend its height with the opening.
    poly([[25,eye-2],[32,eye-2],[33,eye+3],[29.5,eye+4],[26,eye+3]],'#50523e');
    poly([[28,eye-2],[31,eye-2],[31,eye+3],[28,eye+3]],'#34362c');
    poly([[16,eye+1],[23,eye-2],[32,eye-2],[40,eye+1],[38,eye+2],[31,eye],[24,eye],[18,eye+2]],'#413527');
    p.line(mirror(20),eye+4,mirror(27),eye+5,'#a18b6c');
    p.line(mirror(32),eye+5,mirror(38),eye+2,'#978163');
    p.dot(mirror(29),eye,'#797b60'); // small muted reflection, not a white highlight
  }
  // Small nostril/alar accents sit below the nose tip, aligned to the mesh.
  p.line(41,base-2,43,base-2,'#897054');p.line(53,base-2,55,base-2,'#897054');
  p.line(46,base-1,49,base,'#a48a67');
  p.poly([[36,mouth+2],[41,mouth],[45,mouth-1],[48,mouth],[52,mouth-1],[57,mouth],[61,mouth+2],
    [54,mouth+2],[48,mouth+1],[41,mouth+2]],'#a1886b');
  p.line(38,mouth+1,58,mouth+1,'#7e6954');
  p.line(44,mouth+3,53,mouth+3,'#bba17e');
}
