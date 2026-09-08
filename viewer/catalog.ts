export interface CatalogEntry {id: string; label: string; filename: string; url: string; definitionUrl?: string; direction: number[]; defaultWireframe?: boolean}
// Discover model-owned products, excluding diagnostic part exports in output/parts/.
const files = import.meta.glob<string>(['../human/models/*/output/*.glb', '../robot/models/*/output/*.glb', '../models/*/output/*.glb'], { eager: true, query: '?url', import: 'default' });
const definitions = import.meta.glob<string>(['../human/models/*/output/*.asset.json', '../robot/models/*/output/*.asset.json', '../models/*/output/*.asset.json'], { eager: true, query: '?url', import: 'default' });
const metadata: Record<string, Pick<CatalogEntry,'label' | 'direction' | 'defaultWireframe'>> = {
  lumi: { label: 'LUMI · BASE-45＋顔・レイヤーショート', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-tripo': { label: 'LUMI Tripo H3.1 · 生成比較（リグなし）', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-tripo-rig': { label: 'LUMI Tripo · Meshyリグ', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-tripo-rig-walking': { label: 'LUMI Tripo · Meshy歩行（比較用）', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-tripo-jump': { label: 'LUMI Tripo · HY-Motionジャンプ', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-tripo-girl': { label: 'LUMI Tripo · 女の子の頭部＋元の胴体', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-meshy-v2-relaxed': { label: 'LUMI Meshy v2 · 軽く握った手（標準形状）', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-meshy-v2-walking-relaxed': { label: 'LUMI Meshy v2 · 歩行／軽く握った手', direction: [1.2,.55,2.4], defaultWireframe: false },
  'lumi-meshy-v2-running-relaxed': { label: 'LUMI Meshy v2 · 走行／軽く握った手', direction: [1.2,.55,2.4], defaultWireframe: false },
  base45: { label: 'BASE-45 · 顔テクスチャ用素体', direction: [1, .65, 2.4], defaultWireframe: true },
  'base45-face-check': { label: 'BASE-45 · 仮の目／顔形状チェック', direction: [1.4, .35, 2.4] },
  aster: { label: 'ASTER · 金髪ロングの4等身', direction: [1.3, 1.35, 2.4] },
  fes256: { label: 'LILA-256 · 表情付き3等身', direction: [.8, .28, 2.4] },
  corgi: { label: 'PON · 軽量コーギー', direction: [1.7, .75, 2.2] },
  'corgi-chibi': { label: 'PON Mini · ちびコーギー', direction: [1.7, .75, 2.2] },
  dog: { label: 'MUGI · 軽量ローポリ犬', direction: [1.7, .75, 2.2] },
  wyvern: { label: 'CINDERWING · ローポリワイバーン', direction: [1.2, .65, 2.7] },
  bastion: { label: 'BASTION-06 · 重装モジュール機', direction: [1.3, .65, 2.5] },
  strix: { label: 'STRIX-04 · 四脚歩行機', direction: [1.3, .80, 2.3] },
  ashley: { label: 'Ashley Riot · ローポリ研究', direction: [.7, .13, 2.4] },
  raven: { label: 'RAVEN-03 · 飛行型ロボット', direction: [.95, .28, 2.4] },
  suzu: { label: 'Suzu · アニメキャラクター', direction: [.35, .10, 2.4] },
  'little-town': { label: 'Petit Quartier · 町並み', direction: [1, .85, 1.4] },
  traveler: { label: 'Milo · 旅人', direction: [.7, .25, 2.2] },
  'traveler-walk': { label: 'Milo · 歩行', direction: [.9, .28, 2.2] },
  'traveler-ik': { label: 'Milo · IKポーズ', direction: [.9, .28, 2.2] },
};

/** @type {Array<{id: string, label: string, filename: string, url: string, definitionUrl?: string, direction: number[], defaultWireframe?: boolean}>} */
export const catalog: CatalogEntry[] = Object.entries(files).map(([path, url]) => {
  const filename = path.split('/').at(-1)!;
  const id = filename.slice(0, -4);
  return { id, filename, url, definitionUrl: definitions[path.replace(/\.glb$/, '.asset.json')],
    label: metadata[id]?.label ?? filename, direction: metadata[id]?.direction ?? [1, .55, 1.8], defaultWireframe: metadata[id]?.defaultWireframe };
}).sort((a, b) => a.id.localeCompare(b.id));

export const defaultModel = catalog.find(model => model.id === 'raven') ?? catalog.find(model => model.id === 'suzu') ?? catalog[0];
