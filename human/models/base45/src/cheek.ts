import type { Vec3 } from '../../../../modeling/types.ts';
const smooth=(t: number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Relax the existing cheek cage in three dimensions, not a projected outline.
 * Feature beds, ears, neck, rear skull and face center remain authored anchors.
 * Jacobi passes use a snapshot; explicit mirroring handles the cage's asymmetric
 * quad diagonals at the chin-to-neck transition without changing topology. */
export function relaxBase45Cheek(data: import('../../../../contracts/base-topology.ts').BaseTopology) {
  const neighbors=data.positions.map(()=>new Set<number>()),fixed=new Set<number>();
  data.faces.forEach((face,i)=>{
    const region=data.regions[i];
    if(/Ear|Orbit|Lid|Eye/.test(region))face.forEach(id=>fixed.add(id));
    face.forEach((a,k)=>{const b=face[(k+1)%face.length];neighbors[a].add(b);neighbors[b].add(a);});
  });
  const weights=data.positions.map(([x,y,z],i)=>{
    if(fixed.has(i)||data.weights[i].length!==1||data.weights[i][0][0]!=='Head')return 0;
    return .65*smooth((Math.abs(x)-.055)/.055)*smooth((y-1.748)/.035)
      *(1-smooth((y-1.965)/.025))*smooth((z+.08)/.06)
      *(1-smooth((z-.140)/.025));
  });
  const key=([x,y,z]: number[])=>[Math.abs(x),y,z].map(v=>v.toFixed(6)).join();
  const positive=new Map(data.positions.flatMap((p,i)=>p[0]>0?[[key(p),i]]:[]));
  const mirror=data.positions.map(p=>p[0]<0?positive.get(key(p)):undefined);
  for(let pass=0;pass<2;pass++){
    const before=data.positions;
    data.positions=before.map((p,i)=>{
      const w=weights[i];if(!w||!neighbors[i].size)return p;
      const ids=[...neighbors[i]];
      // Retain the width/depth of the mandibular corner behind the cheek;
      // spreading its vertical turn must not shrink it to the neck radius.
      const corner=.35+.65*smooth((p[2]+.03)/.06);
      return p.map((v: number,k: number)=>v+(ids.reduce((sum,j)=>sum+before[j][k],0)/ids.length-v)*w*(k===1?1:corner)) as Vec3;
    });
    mirror.forEach((source,i)=>{
      if(source!==undefined&&weights[i]){
        const [x,y,z]=data.positions[source];data.positions[i]=[-x,y,z];
      }
    });
  }
}
