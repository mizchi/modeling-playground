// Mechanical interface contract. Y-up, meters, +Z forward; left/right are the
// machine's own sides (left is +X). Compatible variants keep these hardpoints.
const freeze=value=>{if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const options=entries=>entries.map(([id,label])=>({id,label}));
const heads=options([['sensor','H01 · 低背センサー'],['command','H02 · 指揮通信型']]);
const cores=options([['fortress','C01 · 重装傾斜装甲'],['patrol','C02 · 哨戒装甲']]);
const arms=options([['armored','A01 · 重装マニピュレータ'],['utility','A02 · 作業用フレーム']]);
const legs=options([['siege','L01 · 重装接地脚'],['field','L02 · 野戦脚']]);
const weapons=options([['rifle','W01 · 長砲身ライフル'],['gatling','W02 · 回転機関砲'],['none','装備なし']]);
const shoulders=options([['missiles','S01 · 6連装ミサイル'],['cannon','S02 · 肩部榴弾砲'],['none','装備なし']]);
export const BASTION_SLOTS=freeze([
  {id:'core',label:'胴体',position:[0,3.54,0],options:cores},
  {id:'head',label:'頭部',position:[0,4.35,.12],options:heads},
  {id:'leftArm',label:'左腕',position:[1.37,4.02,0],options:arms},
  {id:'rightArm',label:'右腕',position:[-1.37,4.02,0],options:arms},
  {id:'leftLeg',label:'左脚',position:[.66,2.5,-.10],options:legs},
  {id:'rightLeg',label:'右脚',position:[-.66,2.5,-.10],options:legs},
  {id:'backpack',label:'背部',position:[0,3.65,-.72],options:options([['reactor','B01 · 双発動力パック'],['cooler','B02 · 冷却パック']])},
  {id:'leftWeapon',label:'左手武装',position:[1.63,2.68,.30],options:weapons},
  {id:'rightWeapon',label:'右手武装',position:[-1.63,2.68,.30],options:weapons},
  {id:'leftShoulder',label:'左肩武装',position:[1.05,4.12,-.40],options:shoulders},
  {id:'rightShoulder',label:'右肩武装',position:[-1.05,4.12,-.40],options:shoulders},
]);
export const DEFAULT_LOADOUT=freeze({core:'fortress',head:'sensor',leftArm:'armored',rightArm:'armored',
  leftLeg:'siege',rightLeg:'siege',backpack:'reactor',leftWeapon:'gatling',rightWeapon:'rifle',
  leftShoulder:'missiles',rightShoulder:'cannon'});

export function validateLoadout(loadout) {
  if(!loadout || typeof loadout!=='object' || Array.isArray(loadout))throw new Error('Invalid loadout');
  for(const id of Object.keys(loadout))if(!BASTION_SLOTS.some(s=>s.id===id))throw new Error(`Unknown slot: ${id}`);
  for(const slot of BASTION_SLOTS)if(!slot.options.some(p=>p.id===loadout[slot.id]))throw new Error(`Incompatible part: ${slot.id}/${loadout[slot.id]}`);
  return {...loadout};
}
