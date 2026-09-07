/** Version 1: meters, Y-up, +Z forward; faces index positions/weights directly. */
export function validateBaseTopology(data) {
  if(data?.version!==1||!Array.isArray(data.positions)||!data.positions.length||!Array.isArray(data.faces)||!Array.isArray(data.weights)||data.weights.length!==data.positions.length||!Array.isArray(data.regions)||data.regions.length!==data.faces.length||data.regions.some(r=>typeof r!=='string'||!r))throw new Error('Invalid base topology contract');
  for(const p of data.positions)if(p.length!==3||!p.every(Number.isFinite))throw new Error('Invalid position');
  for(const weights of data.weights)if(!weights.length||weights.length>4||weights.some(([name,w])=>typeof name!=='string'||!Number.isFinite(w)||w<=0)||Math.abs(weights.reduce((s,[,w])=>s+w,0)-1)>1e-6)throw new Error('Invalid weights');
  const edges=new Map(),adj=data.positions.map(()=>new Set());
  for(const face of data.faces) {
    if(![3,4].includes(face.length)||new Set(face).size!==face.length||face.some(i=>!Number.isInteger(i)||i<0||i>=data.positions.length))throw new Error('Invalid face');
    for(let k=0;k<face.length;k++) {
      const a=face[k],b=face[(k+1)%face.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
      const edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);adj[a].add(b);adj[b].add(a);
    }
  }
  for(const edge of edges.values())if(edge.count!==2||edge.direction!==0)throw new Error('Expected closed, consistently oriented edge');
  const seen=new Set([0]),queue=[0];for(const v of queue)for(const next of adj[v])if(!seen.has(next)){seen.add(next);queue.push(next);}
  if(seen.size!==data.positions.length)throw new Error('Disconnected topology');
  if(data.positions.length-edges.size+data.faces.length!==2)throw new Error('Expected a sphere-topology base');
  return data;
}
