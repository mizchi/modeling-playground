import type { TopologyBuilder } from '../../../../modeling/quad-topology.ts';
/** A narrow six-vertex skull opening -> helix -> inset bowl. The posterior
 * columns belong to the skull; no long annulus stretches toward the occiput. */
export function appendBase45Ear(builder: TopologyBuilder,root: number[],side: number) {
  const name=`Head.${side===1?'Left':'Right'}Ear`;
  const outline=[
    [.224,1.894,.048],[.247,1.900,.005],[.277,1.948,-.005],
    [.257,1.991,.010],[.223,1.988,.054],[.214,1.944,.078],
  ].map(([x,y,z])=>[side*(.205+(x-.205)*.75),y,z-.015]);
  const rim=outline.map(p=>builder.vertex(p,'Head'));
  builder.bridge(root,rim,name+'.Root');
  const inner=outline.map(([x,y,z])=>builder.vertex([
    side*.232+(x-side*.232)*.57-side*.007,1.944+(y-1.944)*.57,.022+(z-.022)*.57-.010,
  ],'Head'));
  builder.bridge(rim,inner,name+'.Rim');
  builder.cap(inner,name+'.Bowl','Head',[side*.225,1.944,.012]);
}
