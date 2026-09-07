/** Swept fringe guides in BASE-45 world coordinates (+Z forward).
 * Each row is [x, y, z, half-width multiplier]. Shared ordered boundaries,
 * unequal widths and staggered tips keep five locks readable without overlap. */
export function lumiForeheadZ(x,y) {
  // Hair volume is independent of the skull: a convex frontal envelope.
  const section=1-(x/.315)**2-((y-2.04)/.275)**2;
  return section>=0?-.01+.31*Math.sqrt(section):undefined;
}

// Shared cross-row borders partition the front envelope. Adjacent closed
// locks meet at their edges instead of weaving through one another. Only
// the staggered tips separate; the scalp is covered above the parting gaps.
const bands=[
  {y:2.300,edges:[-.082,-.053,-.022,.013,.048,.082]},
  {y:2.245,edges:[-.215,-.130,-.055,.025,.120,.215]},
  {y:2.125,edges:[-.275,-.180,-.075,.055,.170,.275]},
  {y:2.025,edges:[-.252,-.170,-.062,.085,.180,.253]},
];
const tips=[[-.205,1.880,.185],[-.130,1.947,.210],[.028,1.943,.218],
  [.125,1.985,.225],[.215,1.900,.180]];

export const LUMI_FRINGE=tips.map((tip,i)=>({
  width:1,
  rows:[...bands.map(({y,edges})=>{
    const x=(edges[i]+edges[i+1])/2;
    return [x,y,lumiForeheadZ(x,y),(edges[i+1]-edges[i])/2];
  }),[...tip,0]],
}));
