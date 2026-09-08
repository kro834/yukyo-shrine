import type {Position,Obstacle} from './movement.ts';
export const RIFT={windup:1.6,cooldown:14,minRange:12,maxRange:22} as const;
/** Transfers only end at a clear node with enough separation to react. */
export function riftDestination(nodes:Iterable<Position>,memory:Position,player:Position,blockers:Obstacle[],serial:number){
 let chosen:Position|null=null,best=-Infinity;
 for(const p of nodes){const d=Math.hypot(p.x-player.x,p.z-player.z),toMemory=Math.hypot(p.x-memory.x,p.z-memory.z);if(d<RIFT.minRange||d>RIFT.maxRange||toMemory>26||blockers.some(w=>p.x>w.minX-.44&&p.x<w.maxX+.44&&p.z>w.minZ-.44&&p.z<w.maxZ+.44))continue;
  const score=-Math.abs(d-16)+Math.sin(p.x*.71+p.z*.39+serial*2.31)*3;if(score>best){chosen=p;best=score;}
 }
 return chosen?{...chosen}:null;
}
export function crusherPhase(time:number){const t=Math.max(0,time)%5.2;return t<1.3?'windup':t<2.5?'rush':'recover';}
