import type { ClipSpec, WindowSpec } from '../contracts/asset.ts';
export interface TimelineEvent { kind: WindowSpec['kind']; id: string; time: number; edge: 'start' | 'end' }
/** Clip-local windows are half-open. Seeking queries state, never dispatches hits. */
export function activeWindows(clip: ClipSpec,time: number): WindowSpec[] {
  if(!Number.isFinite(time)||time<0)throw new Error('Invalid clip time');
  const local=clip.mode==='repeat'?time%clip.duration:time;
  return clip.windows.filter(w=>local>=w.start&&local<w.end);
}

/** Edges crossed in (from, to], using unwrapped animation time, not wall time. */
export function crossedEvents(clip: ClipSpec,from: number,to: number): TimelineEvent[] {
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from)throw new Error('Expected finite forward animation time');
  if(!clip.windows.length)return [];
  const first=clip.mode==='repeat'?Math.max(0,Math.floor(from/clip.duration)-1):0;
  const last=clip.mode==='repeat'?Math.floor(to/clip.duration):0;
  if(last-first>4096)throw new Error('Too many animation cycles in one event query');
  const events: TimelineEvent[]=[];
  for(let cycle=first;cycle<=last;cycle++)for(const window of clip.windows)for(const edge of ['start','end'] as const) {
    const time=cycle*clip.duration+window[edge];
    if(time>from&&time<=to)events.push({kind:window.kind,id:window.id,time,edge});
  }
  // Close before reopening when two intervals meet at a loop boundary.
  return events.sort((a,b)=>a.time-b.time||(a.edge===b.edge?0:a.edge==='end'?-1:1));
}
