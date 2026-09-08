import type { TopologyBuilder } from '../../../../modeling/quad-topology.ts';
import type { Weight } from '../../../../modeling/types.ts';
import { appendBase45Eyes, base45FaceDepth } from './eyes.ts';
import { appendContourColumns, bridgeContour } from './contour.ts';
import { base45JawPosition, base45NeckAttachmentY } from './jaw.ts';
import { appendBase45Ear } from './ears.ts';
import { shapeBase45Nape } from './nape.ts';
import { relaxBase45Cheek } from './cheek.ts';
import { appendPostauricularColumns, bridgePostauricular } from './postauricular.ts';

/** Head-only shape authoring. Keep body proportions, sockets and shared neck intact. */
export function appendBase45Head(builder: TopologyBuilder, torsoLoop: number[]) {
  const {vertex,bridge,cap}=builder;
  let last=torsoLoop;
  for(const [role,y,w,d,centerZ,weights] of [
    ['neckBase',1.65,.088,.076,-.018,[['Chest',.2],['Neck',.8]]],
    ['neckMiddle',1.715,.080,.074,-.014,[['Neck',.82],['Head',.18]]],
    // Keep the attachment behind the ear, but above/slightly forward of the
    // lower neck. The old -.053 center tilted the throat backward in profile.
    ['neckUpper',1.745,.072,.071,-.010,[['Neck',.4],['Head',.6]]],
  ] as [string,number,number,number,number,Weight[]][]) {
    const current=Array.from({length:12},(_,i)=>{
      const angle=i*Math.PI/6;
      const rear=[0,role==='neckUpper'?base45NeckAttachmentY(-1):y,centerZ-d];
      const p=[Math.sin(angle)*w,role==='neckUpper'?base45NeckAttachmentY(Math.cos(angle)):y,centerZ+Math.cos(angle)*d];
      return vertex(shapeBase45Nape(role,p,Math.min(i,12-i),rear),weights);
    });
    bridge(last,current,'Neck');last=current;
  }
  // One submental row spreads the turn beneath the jaw; otherwise a broad
  // flat quad runs directly from the chin edge to the narrow throat.
  const underRear=builder.data.positions[last[6]].map((v,k)=>v*.4+base45JawPosition('chin',6,1)![k]*.6);underRear[1]-=.003;
  const underJaw=Array.from({length:12},(_,i)=>{
    const outer=base45JawPosition('chin',Math.min(i,12-i),i<=6?1:-1)!,inner=builder.data.positions[last[i]];
    const p=inner.map((v,k)=>v*.4+outer[k]*.6);p[1]-=.003;
    return vertex(shapeBase45Nape('underJaw',p,Math.min(i,12-i),underRear),[['Neck',.15],['Head',.85]]);
  });
  bridge(last,underJaw,'Head.UnderJaw');last=underJaw;
  // Front/side/back heights lift the jaw toward the ear and occiput. Horizontal
  // lathe rings would leave a flat underside and a cylindrical nape.
  const rows=[
    {role:'chin'},
    {role:'jaw'},
    {role:'lowerCheek',y:1.81,side:1.848,backY:1.862,w:.146,front:.184,back:.196,columns:[.173,.153]},
    {role:'mouth',y:1.825,side:1.865,backY:1.875,w:.161,front:.177,back:.21,mouth:.006},
    {role:'nose',y:1.89,side:1.935,backY:1.925,w:.201,front:.18,back:.24,nose:.050},
    {role:'eye',y:1.935,side:1.975,backY:1.975,w:.211,front:.178,back:.245,nose:.014},
    {role:'brow',y:1.985,side:2.01,backY:2.02,w:.218,front:.195,back:.245},
    {role:'forehead',y:2.049,side:2.057,backY:2.061,w:.211,front:.187,back:.236,columns:[.169,.130]},
    // Shorter forehead with a rounded shoulder, not a long conical slope.
    {role:'upperForehead',y:2.10,side:2.105,backY:2.11,w:.192,front:.166,back:.213,columns:[.151,.118]},
    {role:'domeShoulder',y:2.151,side:2.155,backY:2.158,w:.153,front:.124,back:.171,columns:[.111,.083]},
    {role:'crown',y:2.185,side:2.187,backY:2.187,w:.083,front:.053,back:.115},
  ];
  const eyeRows=[];
  const earRows=new Map<string,{current:number[];postauricular:ReturnType<typeof appendPostauricularColumns>}>();
  const neckLoop=last;let contour: ReturnType<typeof appendContourColumns> | undefined,postauricular: ReturnType<typeof appendPostauricularColumns> | undefined,perimeter: number[]=[];
  for(const row of rows) {
    const eyePatch=['nose','eye','brow'].includes(row.role);
    const current=Array.from({length:12},(_,i)=>{
      const column=Math.min(i,12-i),jawPoint=base45JawPosition(row.role,column,i<=6?1:-1);
      if(jawPoint)return vertex(shapeBase45Nape(row.role,jawPoint,column,base45JawPosition(row.role,6,1)!), 'Head');
      if (row.y===undefined || row.side===undefined || row.backY===undefined || row.w===undefined || row.front===undefined || row.back===undefined) throw new Error(`Incomplete head row: ${row.role}`);
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
      return vertex(shapeBase45Nape(row.role,[x*row.w,y,z],column,[0,row.backY,-row.back]),'Head');
    });
    const earOpening=['nose','eye'].includes(row.role);
    bridge(last,current,row===rows[0]?'Head.UnderJaw':'Head',[2,3,8,9,...(eyePatch?[0,1,10,11]:[])]);
    const nextPostauricular=appendPostauricularColumns(builder,current);
    bridgePostauricular(builder,postauricular,nextPostauricular,neckLoop,earOpening);postauricular=nextPostauricular;
    if(['mouth','nose','eye'].includes(row.role))earRows.set(row.role,{current,postauricular});
    const nextContour=appendContourColumns(builder,current);
    bridgeContour(builder,contour,nextContour,neckLoop);contour=nextContour;
    perimeter=contour.perimeter.flatMap(id=>id===current[3]?[id,...nextPostauricular.positive.slice(1,3)]:id===current[8]?[id,...nextPostauricular.negative.slice(1,3)]:[id]);
    if(eyePatch||row.role==='mouth')eyeRows.push(current);
    last=current;
  }
  cap(perimeter,'Head','Head',[0,2.20,-.03]);
  appendBase45Eyes(builder,eyeRows);
  for(const side of [1,-1]) {
    const [front,key,back]:[number,'positive'|'negative',number]=side===1?[3,'positive',1]:[9,'negative',2];
    const low=earRows.get('mouth')!,mid=earRows.get('nose')!,high=earRows.get('eye')!;
    appendBase45Ear(builder,[low.current[front],low.postauricular[key][back],mid.postauricular[key][back],high.postauricular[key][back],high.current[front],mid.current[front]],side);
  }
  relaxBase45Cheek(builder.data);
}
