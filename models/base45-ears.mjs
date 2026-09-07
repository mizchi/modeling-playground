/** Six shared skull vertices -> six-vertex helix -> inset bowl. The opening
 * replaces two side panels, preserving one watertight all-quad surface. */
export function appendBase45Ear(builder,root,side) {
  const name=`Head.${side===1?'Left':'Right'}Ear`;
  const outline=[
    [.224,1.894,.048],[.247,1.900,.005],[.277,1.948,-.005],
    [.257,1.991,.010],[.223,1.988,.054],[.214,1.944,.078],
  ].map(([x,y,z])=>[side*x,y,z]);
  const rim=outline.map(p=>builder.vertex(p,'Head'));
  builder.bridge(root,rim,name+'.Root');
  const inner=outline.map(([x,y,z])=>builder.vertex([
    side*.241+(x-side*.241)*.57-side*.007,1.944+(y-1.944)*.57,.037+(z-.037)*.57-.010,
  ],'Head'));
  builder.bridge(rim,inner,name+'.Rim');
  builder.cap(inner,name+'.Bowl','Head',[side*.234,1.944,.027]);
}
