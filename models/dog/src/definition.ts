import type { BoneRow, Point } from '../../../modeling/types.ts';
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export type DogPreset = Omit<typeof DOG,'face'|'palette'> & {
  palette: Record<keyof typeof DOG.palette,string>;
  face?: {eyeHeight:number;depthOffset:number};
};
export const DOG = freeze({
  id: 'dog', name: 'MUGI', meshName: 'Mugi', title: 'MUGI · little low-poly dog', triangleBudget: 800, byteBudget: 32 * 1024,
  palette: Object.freeze({ coat: '#b96930', back: '#92502b', cream: '#ecd9b3', nose: '#262a2c', ear: '#7d4438', collar: '#376863' }),
  shape: { bodyLength: 1, bodyWidth: 1, legHeight: 1,
    headScale: [1,1,1], earScale: [1,1,1], pawScale: [1,1,1] },
  tailRows: [[0,.73,-.47,.105,.105],[0,.91,-.66,.105,.105],[0,1.085,-.66,.095,.095],
    [.025,1.17,-.48,.09,.09],[.055,1.105,-.31,.079,.08],[.08,.97,-.34,.064,.065],[.09,.99,-.46,.025,.025]],
  tailBlend: [.89,.17], tailTip: [0,1.03,-.62],
});

/** A breed is a compact preset, not another modeling/rigging implementation. */
export const CORGI = freeze({
  id: 'corgi', name: 'PON', meshName: 'Pon', title: 'PON · compact corgi',
  triangleBudget: DOG.triangleBudget, byteBudget: DOG.byteBudget,
  palette: { ...DOG.palette, coat: '#c88b45', back: '#aa7038', cream: '#f1e4c9', ear: '#9c6652', collar: '#964b43' },
  shape: { bodyLength: 1.65, bodyWidth: 1.15, legHeight: .55,
    headScale: [1.06,.96,.94], earScale: [1.16,1.5,1], pawScale: [1.1,.82,.95] },
  tailRows: [[0,.73,-.47,.10,.10],[0,.77,-.59,.075,.075],[0,.80,-.65,.026,.026]],
  tailBlend: [.73,.07], tailTip: [0,.78,-.60],
});
export const CORGI_CHIBI = freeze({
  ...CORGI,
  id: 'corgi-chibi', name: 'PON Mini', meshName: 'PonMini', title: 'PON Mini · chibi corgi',
  shape: { bodyLength: 1.15, bodyWidth: 1.3, legHeight: .42,
    headScale: [1.4,1.25,1.05], earScale: [1.25,1.1,1], pawScale: [1.25,.8,1] },
  face: { eyeHeight: 1.5, depthOffset: 0 },
});
export const DOG_PRESETS = Object.freeze({ dog: DOG, corgi: CORGI, 'corgi-chibi': CORGI_CHIBI });

/** Piece-specific morph in bind space. Colors/weights stay in the shared authoring coordinates. */
export function dogPoint(preset: DogPreset, region: string, point: Point) {
  if (preset === DOG) return point;
  const s = preset.shape, [x,y,z] = point, drop = .42 * (1 - s.legHeight);
  const body = [x*s.bodyWidth, y-drop, z*s.bodyLength];
  const head = (p: Point)=> [p[0]*s.headScale[0], .83-drop+(p[1]-.83)*s.headScale[1], .49*s.bodyLength+(p[2]-.49)*s.headScale[2]];
  if (region === 'head') return head(point);
  // Enlarge the eyes along their face plane, without lifting them off the surface.
  if (region === 'eyes') return head(preset.face ? [x,1.10+(y-1.10)*preset.face.eyeHeight,z] : point);
  if (region === 'ears') return head([
    Math.sign(x)*.20+(x-Math.sign(x)*.20)*s.earScale[0], 1.16+(y-1.16)*s.earScale[1], .53+(z-.53)*s.earScale[2],
  ]);
  if (region === 'neck') {
    const target = head(point), t = Math.max(0, Math.min(1, (y-.65)/.22));
    return body.map((v,i)=>v+(target[i]-v)*t);
  }
  if (region.endsWith('Leg') || region.endsWith('Paw')) {
    const centerZ = region.startsWith('front') ? .37 : -.37;
    if (region.endsWith('Paw')) {
      const centerX = Math.sign(x)*.22;
      return [centerX*s.bodyWidth+(x-centerX)*s.pawScale[0], y*s.pawScale[1], centerZ*s.bodyLength+(z-centerZ)*s.pawScale[2]];
    }
    return [x*s.bodyWidth, y<.42 ? y*s.legHeight : y-drop, centerZ*s.bodyLength+(z-centerZ)];
  }
  return body;
}
export const DOG_BONES = Object.freeze(([
  ['Root', null, [0, 0, 0]], ['Body', 'Root', [0, .62, 0]],
  ['Head', 'Body', [0, .83, .49]],
  ['TailBase', 'Body', [0, .74, -.47]], ['TailTip', 'TailBase', [0, 1.03, -.62]],
  ...['Front', 'Hind'].flatMap<BoneRow>(end => [1, -1].flatMap<BoneRow>(side => {
    const name = end + (side === 1 ? 'Left' : 'Right'), z = end === 'Front' ? .37 : -.37;
    return [[`${name}Upper`, 'Body', [side * .19, .62, z]],
      [`${name}Lower`, `${name}Upper`, [side * .22, .32, z + (end === 'Front' ? 0 : .06)]],
      [`${name}Paw`, `${name}Lower`, [side * .22, .12, z + (end === 'Front' ? .01 : -.08)]]];
  })),
] satisfies BoneRow[]).map(([name, parent, position]) => Object.freeze({ name, parent, position: Object.freeze(position) })));

export function dogBones(preset: DogPreset = DOG) {
  if (preset === DOG) return DOG_BONES;
  return DOG_BONES.map(bone => {
    const region = bone.name === 'Head' ? 'head' : bone.name.startsWith('Front') ? 'frontLeg'
      : bone.name.startsWith('Hind') ? 'hindLeg' : 'body';
    const position = bone.name === 'Root' ? bone.position
      : dogPoint(preset, region, bone.name === 'TailTip' ? preset.tailTip : bone.position);
    return { ...bone, position };
  });
}
