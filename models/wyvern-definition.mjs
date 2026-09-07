const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

/** Authoring contract: meters, Y-up, +Z forward, anatomical left is +X. Static threat pose. */
export const WYVERN=freeze({
  id:'wyvern',name:'CINDERWING',limbs:4,triangleBudget:4500,
  palette:{skin:'#516567',ridge:'#829391',dark:'#2b3d43',belly:'#c3b38c',membrane:'#b9844a',membraneLight:'#dab57a',horn:'#ded4ae',claw:'#292d34',mouth:'#302022',eye:'#ffa62d'},
  shoulder:[.48,3.45,-.04],elbow:[2.02,3.82,-.38],wrist:[3.86,4.88,.25],
  fingers:[[7.30,5.62,-1.10],[6.36,3.96,-2.47],[4.72,2.92,-3.04],[2.63,2.41,-2.72],[.50,2.48,-.47]],
  body:[[0,1.74,-.48,.29,.31],[0,2.10,-.38,.39,.42],[0,2.55,-.26,.34,.43],
    [0,3.08,-.09,.49,.58],[0,3.51,-.04,.56,.62],[0,3.79,.02,.36,.41]],
  neck:[[0,3.60,.05,.32,.34],[0,4.02,-.07,.28,.30],[0,4.36,.03,.23,.27],
    [0,4.62,.33,.23,.28],[0,4.69,.65,.28,.32]],
  tail:[[0,1.92,-.51,.31,.31],[0,1.74,-1.14,.29,.27],[0,1.51,-2.07,.22,.23],
    [0,1.34,-3.12,.16,.19],[.22,1.58,-4.17,.12,.14],[.59,2.12,-4.92,.07,.10],[.80,2.80,-5.32,.015,.022]],
});
