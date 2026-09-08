import { BASE45_BONES } from '../models/base45-definition.mjs';

export const SHAPE_FIELDS=Object.freeze({
  noseHeight:{label:'鼻の高さ',min:-1,max:1,step:.05},
  faceLength:{label:'顔の長さ',min:-1,max:1,step:.05},
  faceWidth:{label:'顔の幅',min:-1,max:1,step:.05},
  eyeSpacing:{label:'目の間隔',min:-1,max:1,step:.05},
});
export const BODY_SHAPE_FIELDS=Object.freeze({
  chestSize:{label:'胸の大きさ',min:-1,max:1,step:.05},
  waistWidth:{label:'腰の太さ（ウエスト）',min:-1,max:1,step:.05},
  muscularity:{label:'筋肉量',min:0,max:1,step:.05},
  legLength:{label:'脚の長さ',min:-1,max:1,step:.05},
  height:{label:'身長（全身倍率）',min:-1,max:1,step:.05},
});
const keys=(v,allowed)=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw new Error('未対応の設定項目があります');
};
export function presetRecipe(model) {
  if(!['base45','base45-female','lumi'].includes(model))throw new Error('未対応の素体です');
  return {version:1,model,hair:model==='lumi'?'lumi-short':'none',face:model==='lumi'?'lumi':'clay',
    shape:Object.fromEntries(Object.keys(SHAPE_FIELDS).map(k=>[k,0])),
    bodyShape:Object.fromEntries(Object.keys(BODY_SHAPE_FIELDS).map(k=>[k,0])),rig:null};
}
export function validateRig(value) {
  keys(value,['version','bones']);
  if(value.version!==1||!Array.isArray(value.bones)||value.bones.length!==BASE45_BONES.length)throw new Error('骨格は version 1・BASE-45互換の22ボーンが必要です');
  const bones=BASE45_BONES.map(reference=>{
    const b=value.bones.find(b=>b?.name===reference.name);keys(b,['name','parent','position']);
    if(b.parent!==reference.parent||!Array.isArray(b.position)||b.position.length!==3||b.position.some(v=>!Number.isFinite(v)||Math.abs(v)>10))throw new Error(`不正な骨格: ${reference.name}`);
    return {name:b.name,parent:b.parent,position:[...b.position]};
  });
  return {version:1,bones};
}
export function validateRecipe(value) {
  keys(value,['version','model','hair','face','shape','bodyShape','rig']);
  if(value.version!==1)throw new Error('設定の version は 1 が必要です');
  const result=presetRecipe(value.model);
  if(!['none','lumi-short','lumi-side-tail'].includes(value.hair)||!['clay','lumi'].includes(value.face))throw new Error('未対応の髪・顔です');
  keys(value.shape,Object.keys(SHAPE_FIELDS));
  for(const [key,{min,max}] of Object.entries(SHAPE_FIELDS)) {
    const n=value.shape[key];if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${key} は ${min}〜${max} の数値が必要です`);
    result.shape[key]=n;
  }
  // Two legacy v1 forms: absent bodyShape, or the complete original three-field
  // shape. Other partial objects, null and unknown fields remain errors.
  if(Object.hasOwn(value,'bodyShape')) {
    keys(value.bodyShape,Object.keys(BODY_SHAPE_FIELDS));
    const legacy=!Object.hasOwn(value.bodyShape,'legLength')&&!Object.hasOwn(value.bodyShape,'height');
    for(const [key,{min,max}] of Object.entries(BODY_SHAPE_FIELDS)) {
      if(legacy&&['legLength','height'].includes(key))continue;
      const n=value.bodyShape[key];if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${key} は ${min}〜${max} の数値が必要です`);
      result.bodyShape[key]=n;
    }
  }
  return {...result,hair:value.hair,face:value.face,rig:value.rig==null?null:validateRig(value.rig)};
}
