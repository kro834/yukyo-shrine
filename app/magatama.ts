import type {Position,Obstacle} from './movement.ts';
import type {Room,Cell} from './shrine-layout.ts';
import {RED_AREAS} from './area-rules.ts';
import {segmentBlocked} from './shrine-gameplay.ts';
export type Bead={id:string;position:Position;floor:number;collected:boolean;color:'blue'|'red'|'gold';offered:boolean};
export function placeMagatama(rooms:Room[],walls:Obstacle[],upperWalls:Obstacle[]):Bead[]{
  const spaces=[...rooms.filter(r=>!r.id.startsWith('expansion-')).map(r=>({id:r.id,x1:r.x1*4+1,x2:r.x2*4-1,z1:r.z1*4+1,z2:r.z2*4-1,floor:0})),
    {id:'upper-a',x1:60,x2:68,z1:4,z2:12,floor:4.8},{id:'upper-b',x1:72,x2:80,z1:4,z2:12,floor:4.8}];
  return spaces.map(r=>{
    const candidates:Position[]=[];
    for(let x=r.x1;x<=r.x2;x+=1)for(let z=r.z1;z<=r.z2;z+=1)candidates.push({x,z});
    const cx=(r.x1+r.x2)/2,cz=(r.z1+r.z2)/2;
    candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
    const position=candidates.find(p=>!(r.floor?upperWalls:walls).some(o=>p.x>o.minX-.8&&p.x<o.maxX+.8&&p.z>o.minZ-.8&&p.z<o.maxZ+.8));
    if(!position)throw new Error('No accessible magatama location: '+r.id);
    return {id:r.id,position,floor:r.floor,collected:false,color:'blue' as const,offered:false};
  });
}
export function placeRedMagatama(cells:Cell[],nodes:Iterable<Position>,walls:Obstacle[],random:()=>number):Bead[]{
 const kinds=new Map(cells.map(c=>[c.x+','+c.z,c.kind]));const points=[...nodes];
 return RED_AREAS.map(area=>{
  const candidates=points.filter(p=>kinds.get(Math.round(p.x/4)+','+Math.round(p.z/4))===area&&!walls.some(o=>p.x>o.minX-.85&&p.x<o.maxX+.85&&p.z>o.minZ-.85&&p.z<o.maxZ+.85));
  if(!candidates.length)throw new Error('No reachable red magatama location: '+area);
  const position={...candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]};
  return {id:'red-'+area,position,floor:0,collected:false,color:'red',offered:false};
 });
}
export function beadInventory(beads:Bead[]){return {gold:beads.filter(b=>b.collected&&!b.offered&&b.color==='gold').length,blue:beads.filter(b=>b.collected&&!b.offered&&b.color==='blue').length,red:beads.filter(b=>b.collected&&!b.offered&&b.color==='red').length};}
export function spendBeads(beads:Bead[],used:{blue:number;red:number;gold?:number}){for(const color of ['blue','red','gold'] as const){let left=used[color]??0;for(const b of beads)if(left>0&&b.collected&&!b.offered&&b.color===color){b.offered=true;left--;}}}
export function collectMagatama(beads:Bead[],player:Position,floor:number,walls:Obstacle[]){
  let count=0;
  for(const b of beads)if(!b.collected&&Math.abs(b.floor-floor)<.5&&Math.hypot(b.position.x-player.x,b.position.z-player.z)<1.15&&!segmentBlocked(player,b.position,walls)){b.collected=true;count++;}
  return count;
}
