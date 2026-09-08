/** Continue skull columns behind the ear instead of pulling an inset polygon
 * out of the broad side panel. The first narrow strip is the ear opening. */
export function appendPostauricularColumns(builder,original) {
  const result={};
  for(const [side,front,back,key] of [[1,3,4,'positive'],[-1,9,8,'negative']]){
    const a=builder.data.positions[original[front]],b=builder.data.positions[original[back]];
    const added=[.28,.65].map(t=>{
      const angle=t*Math.PI/6,depth=Math.sin(angle)/.5,width=(1-Math.cos(angle))/(1-Math.cos(Math.PI/6));
      return builder.vertex([a[0]+(b[0]-a[0])*width,a[1]+(b[1]-a[1])*depth*depth,a[2]+(b[2]-a[2])*depth],'Head');
    });
    const chain=[original[front],...added,original[back]];
    result[key]=side===1?chain:chain.toReversed();
  }
  return result;
}

export function bridgePostauricular(builder,previous,next,neckLoop,earOpening) {
  for(const [key,name,index,opening] of [['positive','Left',3,0],['negative','Right',8,2]]){
    const b=next[key],region=`Head.${name}Postauricular`;
    if(previous){
      const a=previous[key];
      for(let i=0;i<3;i++)if(!earOpening||i!==opening)builder.face([a[i],a[i+1],b[i+1],b[i]],region);
    }else{
      const a=neckLoop[index],c=neckLoop[index+1];
      builder.face([a,c,b[3],b[2]],'Head.UnderJaw');
      builder.face([a,b[2],b[1],b[0]],'Head.UnderJaw');
    }
  }
}
