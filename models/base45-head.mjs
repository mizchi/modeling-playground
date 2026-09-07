import { appendBase45Eyes, base45FaceDepth } from './base45-eyes.mjs';
import { appendContourColumns, bridgeContour } from './base45-contour.mjs';
import { base45JawPosition, base45NeckAttachmentY } from './base45-jaw.mjs';
import { appendBase45Ear } from './base45-ears.mjs';

/** Head-only shape authoring. Keep body proportions, sockets and shared neck intact. */
export function appendBase45Head(builder, torsoLoop) {
  const {vertex,bridge,cap}=builder;
  let last=torsoLoop;
  for(const [y,w,d,centerZ,weights] of [
    [1.65,.088,.076,-.018,[['Neck',1]]],
    [1.745,.072,.071,-.053,[['Neck',.45],['Head',.55]]],
  ]) {
    const current=Array.from({length:12},(_,i)=>{
      const angle=i*Math.PI/6;
      return vertex([Math.sin(angle)*w,y===1.745?base45NeckAttachmentY(Math.cos(angle)):y,centerZ+Math.cos(angle)*d],weights);
    });
    bridge(last,current,'Neck');last=current;
  }
  // One submental row spreads the turn beneath the jaw; otherwise a broad
  // flat quad runs directly from the chin edge to the narrow throat.
  const underJaw=Array.from({length:12},(_,i)=>{
    const outer=base45JawPosition('chin',Math.min(i,12-i),i<=6?1:-1),inner=builder.data.positions[last[i]];
    const p=inner.map((v,k)=>v*.4+outer[k]*.6);p[1]-=.003;
    return vertex(p,[['Neck',.15],['Head',.85]]);
  });
  bridge(last,underJaw,'Head.UnderJaw');last=underJaw;
  // Front/side/back heights lift the jaw toward the ear and occiput. Horizontal
  // lathe rings would leave a flat underside and a cylindrical nape.
  const rows=[
    {role:'chin'},
    {role:'jaw'},
    {role:'lowerCheek',y:1.81,side:1.848,backY:1.862,w:.146,front:.184,back:.196,columns:[.177,.164]},
    {role:'mouth',y:1.825,side:1.865,backY:1.875,w:.161,front:.177,back:.21,mouth:.006},
    {role:'nose',y:1.89,side:1.935,backY:1.925,w:.201,front:.18,back:.24,nose:.050},
    {role:'eye',y:1.935,side:1.975,backY:1.975,w:.211,front:.178,back:.245,nose:.014},
    {role:'brow',y:1.985,side:2.01,backY:2.02,w:.218,front:.195,back:.245},
    {role:'forehead',y:2.049,side:2.057,backY:2.061,w:.211,front:.187,back:.236,columns:[.177,.145]},
    // Shorter forehead with a rounded shoulder, not a long conical slope.
    {role:'upperForehead',y:2.10,side:2.105,backY:2.11,w:.192,front:.166,back:.213,columns:[.155,.124]},
    {role:'crown',y:2.185,side:2.187,backY:2.187,w:.083,front:.053,back:.115},
  ];
  const eyeRows=[];
  const earRows=new Map();
  const neckLoop=last;let contour;
  for(const row of rows) {
    const eyePatch=['nose','eye','brow'].includes(row.role);
    const current=Array.from({length:12},(_,i)=>{
      const column=Math.min(i,12-i),jawPoint=base45JawPosition(row.role,column,i<=6?1:-1);
      if(jawPoint)return vertex(jawPoint,'Head');
      const angle=i*Math.PI/6,x=Math.sin(angle),c=Math.cos(angle);
      const y=c>=0?row.side+(row.y-row.side)*c:row.side+(row.backY-row.side)*-c;
      // Eyes have shallow frontal beds, not forward-projecting cheek wedges.
      const front=c>=0;
      const nose=front?(row.nose??0)*(column===0?1:0):0;
      const mouth=front?(row.mouth??0)*(column<=1?1:0):0;
      let z=c*(front?row.front:row.back)+nose+mouth;
      // Give the lower facial border enough depth to connect the cheek band
      // into the chin, instead of snapping back onto a narrow lathed underside.
      if(column>=1&&column<=2&&row.columns)z=row.columns[column-1];
      // The eye beds must join the face, not become raised islands. Blend their
      // lower edge into the cheek; keep the center nose/mouth relief unchanged.
      if(row.role==='mouth'&&column>0&&column<=2)z=base45FaceDepth(x*row.w,y);
      if(eyePatch&&column===2)z=base45FaceDepth(x*row.w,y);
      if(row.role==='brow'&&column===1)z=base45FaceDepth(x*row.w,y)+.001;
      return vertex([x*row.w,y,z],'Head');
    });
    const earOpening=['nose','eye'].includes(row.role);
    bridge(last,current,row===rows[0]?'Head.UnderJaw':'Head',[2,9,...(eyePatch?[0,1,10,11]:[]),...(earOpening?[3,8]:[])]);
    if(['mouth','nose','eye'].includes(row.role))earRows.set(row.role,current);
    const nextContour=appendContourColumns(builder,current);
    bridgeContour(builder,contour,nextContour,neckLoop);contour=nextContour;
    if(eyePatch||row.role==='mouth')eyeRows.push(current);
    last=current;
  }
  cap(contour.perimeter,'Head','Head',[0,2.20,-.03]);
  appendBase45Eyes(builder,eyeRows);
  for(const side of [1,-1]) {
    const [front,back]=side===1?[3,4]:[9,8];
    const low=earRows.get('mouth'),mid=earRows.get('nose'),high=earRows.get('eye');
    appendBase45Ear(builder,[low[front],low[back],mid[back],high[back],high[front],mid[front]],side);
  }
}
