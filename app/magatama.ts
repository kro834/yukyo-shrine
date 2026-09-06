import type {Position,Obstacle} from './movement.ts';
import type {Room} from './shrine-layout.ts';
import {segmentBlocked} from './shrine-gameplay.ts';
export type Bead={id:string;position:Position;floor:number;collected:boolean};
export function placeMagatama(rooms:Room[],walls:Obstacle[],upperWalls:Obstacle[]):Bead[]{
  const spaces=[...rooms.map(r=>({id:r.id,x1:r.x1*4+1,x2:r.x2*4-1,z1:r.z1*4+1,z2:r.z2*4-1,floor:0})),
    {id:'upper-a',x1:60,x2:68,z1:4,z2:12,floor:4.8},{id:'upper-b',x1:72,x2:80,z1:4,z2:12,floor:4.8}];
  return spaces.map(r=>{
    const candidates:Position[]=[];
    for(let x=r.x1;x<=r.x2;x+=1)for(let z=r.z1;z<=r.z2;z+=1)candidates.push({x,z});
    const cx=(r.x1+r.x2)/2,cz=(r.z1+r.z2)/2;
    candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
    const position=candidates.find(p=>!(r.floor?upperWalls:walls).some(o=>p.x>o.minX-.8&&p.x<o.maxX+.8&&p.z>o.minZ-.8&&p.z<o.maxZ+.8));
    if(!position)throw new Error('No accessible magatama location: '+r.id);
    return {id:r.id,position,floor:r.floor,collected:false};
  });
}
export function collectMagatama(beads:Bead[],player:Position,floor:number,walls:Obstacle[]){
  let count=0;
  for(const b of beads)if(!b.collected&&Math.abs(b.floor-floor)<.5&&Math.hypot(b.position.x-player.x,b.position.z-player.z)<1.15&&!segmentBlocked(player,b.position,walls)){b.collected=true;count++;}
  return count;
}
