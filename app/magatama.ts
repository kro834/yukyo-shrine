import {RADIUS,type Position,type Obstacle} from './movement.ts';
import type {Room,Cell} from './shrine-layout.ts';
import {RED_AREAS} from './area-rules.ts';
import {segmentBlocked} from './shrine-gameplay.ts';
import {nearbyObstacles} from './spatial.ts';
export type Bead={id:string;position:Position;floor:number;collected:boolean;color:'blue'|'red'|'gold';offered:boolean;home:{x:number;z:number;floor:number};dropped?:boolean};
/** Keep the caller's area and random choice, preferring places visible from
 * several nearby walk nodes over blind pockets. Navigation nodes use 4 m cells.
 * One random sample is consumed; never move a bead outside its candidate set.
 */
export function chooseReadableMagatama(candidates:readonly Position[],nodes:Iterable<Position>,walls:Obstacle[],random:()=>number):Position{
 const nodeAt=new Map([...nodes].map(p=>[p.x+','+p.z,p]));
 const clearance=walls.map(o=>({...o,minX:o.minX-RADIUS,maxX:o.maxX+RADIUS,minZ:o.minZ-RADIUS,maxZ:o.maxZ+RADIUS}));
 const cardinal=[[1,0],[-1,0],[0,1],[0,-1]],diagonal=[[1,1],[1,-1],[-1,1],[-1,-1]];
 const scored=candidates.filter(p=>!nearbyObstacles(walls,p.x-.85,p.z-.85,p.x+.85,p.z+.85).some(o=>p.x>o.minX-.85&&p.x<o.maxX+.85&&p.z>o.minZ-.85&&p.z<o.maxZ+.85)).map(position=>{
  const visible=(directions:number[][])=>directions.reduce((count,[dx,dz])=>{
   const approach=nodeAt.get((position.x+dx*4)+','+(position.z+dz*4));
   return count+(approach&&!segmentBlocked(position,approach,clearance)?1:0);
  },0);
  const approaches=visible(cardinal),shortViews=visible(diagonal);
  return {position,approaches,weight:1+approaches*.20+shortViews*.08};
 });
 if(!scored.length)throw new Error('No accessible readable magatama location');
 const open=scored.filter(p=>p.approaches>=2);
 // A sparse area keeps its varied original choices instead of collapsing to
 // the sole junction. Broad areas can discard their least visible dead ends.
 const pool=open.length>=Math.min(4,scored.length)?open:scored;
 const total=pool.reduce((sum,p)=>sum+p.weight,0);let draw=Math.max(0,Math.min(1,random()))*total;
 for(const candidate of pool){draw-=candidate.weight;if(draw<0)return {...candidate.position};}
 return {...pool[pool.length-1].position};
}
export function placeMagatama(rooms:Room[],walls:Obstacle[],upperWalls:Obstacle[]):Bead[]{
  const spaces=[...rooms.filter(r=>r.bead??!r.id.startsWith('expansion-')).map(r=>({id:r.id,x1:r.x1*4+1,x2:r.x2*4-1,z1:r.z1*4+1,z2:r.z2*4-1,floor:0})),
    {id:'upper-a',x1:60,x2:68,z1:4,z2:12,floor:4.8},{id:'upper-b',x1:72,x2:80,z1:4,z2:12,floor:4.8}];
  return spaces.map(r=>{
    const candidates:Position[]=[];
    for(let x=r.x1;x<=r.x2;x+=1)for(let z=r.z1;z<=r.z2;z+=1)candidates.push({x,z});
    const cx=(r.x1+r.x2)/2,cz=(r.z1+r.z2)/2;
    candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
    const position=candidates.find(p=>!(r.floor?upperWalls:walls).some(o=>p.x>o.minX-.8&&p.x<o.maxX+.8&&p.z>o.minZ-.8&&p.z<o.maxZ+.8));
    if(!position)throw new Error('No accessible magatama location: '+r.id);
    return {id:r.id,position,floor:r.floor,collected:false,color:'blue' as const,offered:false,home:{...position,floor:r.floor}};
  });
}
export function placeRedMagatama(cells:Cell[],nodes:Iterable<Position>,walls:Obstacle[],random:()=>number):Bead[]{
 const kinds=new Map(cells.map(c=>[c.x+','+c.z,c.kind]));const points=[...nodes];
 return RED_AREAS.map(area=>{
  const candidates=points.filter(p=>kinds.get(Math.round(p.x/4)+','+Math.round(p.z/4))===area&&!walls.some(o=>p.x>o.minX-.85&&p.x<o.maxX+.85&&p.z>o.minZ-.85&&p.z<o.maxZ+.85));
  if(!candidates.length)throw new Error('No reachable red magatama location: '+area);
  const position=chooseReadableMagatama(candidates,points,walls,random);
  return {id:'red-'+area,position,floor:0,collected:false,color:'red',offered:false,home:{...position,floor:0}};
 });
}
export function beadInventory(beads:Bead[]){return {gold:beads.filter(b=>b.collected&&!b.offered&&b.color==='gold').length,blue:beads.filter(b=>b.collected&&!b.offered&&b.color==='blue').length,red:beads.filter(b=>b.collected&&!b.offered&&b.color==='red').length};}
export function spendBeads(beads:Bead[],used:{blue:number;red:number;gold?:number}){for(const color of ['blue','red','gold'] as const){let left=used[color]??0;for(const b of beads)if(left>0&&b.collected&&!b.offered&&b.color===color){b.offered=true;left--;}}}
/** A captured visitor's held beads fall in a small ring where they stood; the
 * caller supplies a point on walkable floor. Offered beads are never touched. */
export function dropHeld(beads:Bead[],point:Position,floor:number){
 const held=beads.filter(b=>b.collected&&!b.offered);
 held.forEach((b,i)=>{const a=i*Math.PI*2/held.length;b.collected=false;b.dropped=true;b.position={x:point.x+Math.cos(a)*.35,z:point.z+Math.sin(a)*.35};b.floor=floor;});
 return held.length;
}
/** An unrecovered bundle returns to its rooms when the visitor is caught again. */
export function scatterDropped(beads:Bead[]){
 let count=0;for(const b of beads)if(b.dropped&&!b.collected){b.dropped=false;b.position={x:b.home.x,z:b.home.z};b.floor=b.home.floor;count++;}
 return count;
}
export function collectMagatama(beads:Bead[],player:Position,floor:number,walls:Obstacle[]){
  let count=0;
  for(const b of beads)if(!b.collected&&Math.abs(b.floor-floor)<.5&&Math.hypot(b.position.x-player.x,b.position.z-player.z)<1.15&&!segmentBlocked(player,b.position,walls)){b.collected=true;count++;}
  return count;
}
