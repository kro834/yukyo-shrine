import {BOUNDS,type Obstacle,type Position} from './movement.ts';
import {segmentBlocked,type Enemy,type HearOptions} from './shrine-gameplay.ts';
import {isFinale} from './enemy-traits.ts';
import {placeNotes} from './lore.ts';
import {nearbyObstacles} from './spatial.ts';
import {floorBand} from './vertical-layout.ts';
export type ItemKind='bell'|'ward';
export const ITEM_CAPS={bell:3,ward:2} as const;
const capped=(kind:ItemKind,n:number)=>Math.max(0,Math.min(ITEM_CAPS[kind],Math.floor(Number.isFinite(n)?n:0)));
/** The visitor's 鈴 and 御札. A capture empties the bag; wards already on the floor stay. */
export class ItemBag{
 bell:number;ward:number;selected:ItemKind='bell';
 constructor(start:{bell?:number;ward?:number}={}){this.bell=capped('bell',start.bell??1);this.ward=capped('ward',start.ward??0);}
 /** Returns how many were actually added under the cap. */
 grant(kind:ItemKind,count=1){const before=this[kind];this[kind]=capped(kind,before+Math.max(0,Math.floor(count)));return this[kind]-before;}
 select(kind:ItemKind){this.selected=kind;}
 cycle(){this.selected=this.selected==='bell'?'ward':'bell';return this.selected;}
 take(kind:ItemKind){if(this[kind]<=0)return false;this[kind]--;return true;}
 loseCarried(){this.bell=0;this.ward=0;}
 snapshot(){return {bell:this.bell,ward:this.ward,selected:this.selected};}
}
/** Speed is 13, not the drafted 10.5: with 12 m/s² gravity and a .18 rad loft a level
 * throw from standing eye height then lands 9.6 m out (14.1 m at +.3 rad) instead of 7.2 m. */
export const THROW={speed:13,gravity:12,loft:.18,minPitch:-.35,maxPitch:.75,substep:.2,maxSeconds:2,cooldown:.8,restSeconds:30} as const;
export type ThrowPath={points:(Position&{y:number})[];landing:Position;seconds:number};
// A fixed time step whose travel never exceeds `substep`, even at the fastest point of a 2 s fall.
const STEP=THROW.substep/(THROW.speed+THROW.gravity*THROW.maxSeconds);
/** Samples are evenly spaced in time (the last may be shorter). Walls without a
 * vertical extent are full height; low furniture with minY/maxY can be cleared. */
export function throwArc(origin:Position&{y:number},yaw:number,pitch:number,walls:Obstacle[],floorY:(p:Position)=>number):ThrowPath{
 const angle=Math.max(THROW.minPitch,Math.min(THROW.maxPitch,Number.isFinite(pitch)?pitch:0))+THROW.loft,level=Math.cos(angle)*THROW.speed;
 let vx=-Math.sin(yaw)*level,vz=-Math.cos(yaw)*level,vy=Math.sin(angle)*THROW.speed,t=0;
 const reach=THROW.speed*THROW.maxSeconds,near=nearbyObstacles(walls,origin.x-reach,origin.z-reach,origin.x+reach,origin.z+reach);
 const tall=near.filter(o=>o.minY===undefined&&o.maxY===undefined),low=near.filter(o=>o.minY!==undefined||o.maxY!==undefined);
 const blocked=(a:Position&{y:number},b:Position&{y:number})=>b.x<BOUNDS.minX||b.x>BOUNDS.maxX||b.z<BOUNDS.minZ||b.z>BOUNDS.maxZ||segmentBlocked(a,b,tall)
  ||low.some(o=>(o.minY??-Infinity)<=Math.max(a.y,b.y)&&(o.maxY??Infinity)>=Math.min(a.y,b.y)&&segmentBlocked(a,b,[o]));
 let p={x:origin.x,y:origin.y,z:origin.z};const points=[{...p}];
 while(t<THROW.maxSeconds-1e-9){
  const h=Math.min(STEP,THROW.maxSeconds-t),fall=THROW.gravity*h*h/2;
  let next={x:p.x+vx*h,y:p.y+vy*h-fall,z:p.z+vz*h};
  // A wall stops the flight; the bell drops straight down from the last free point.
  if((vx||vz)&&blocked(p,next)){vx=0;vz=0;vy=Math.min(vy,0);next={x:p.x,y:p.y+vy*h-fall,z:p.z};}
  vy-=THROW.gravity*h;t+=h;
  const ground=floorY(next);
  if(next.y<=ground+.05){next.y=ground;points.push(next);return {points,landing:{x:next.x,z:next.z},seconds:t};}
  points.push(next);p=next;
 }
 p.y=floorY(p);
 return {points,landing:{x:p.x,z:p.z},seconds:t};
}
function pointAt(path:ThrowPath,t:number){
 const last=path.points.length-1;if(last<1||t>=path.seconds)return {...path.points[last]};
 const f=Math.max(0,t)/path.seconds*last,i=Math.min(last-1,Math.floor(f)),u=f-i,a=path.points[i],b=path.points[i+1];
 return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
}
export type FlyingBell={path:ThrowPath;t:number;floor:number;landed:boolean;heard:boolean;rest:number};
/** Flight runs on real time like the visitor's own hand; the ring waits for live time,
 * so a bell thrown during a time stop is heard when time resumes. */
export class ThrownBells{
 items:FlyingBell[]=[];cooldown=0;
 canThrow(){return this.cooldown<=1e-6;}
 throw(path:ThrowPath,floor:number){this.items.push({path,t:0,floor,landed:false,heard:false,rest:0});this.cooldown=THROW.cooldown;}
 step(dt:number,liveDt:number,onRing:(point:Position,floor:number)=>void){
  const real=Math.max(0,dt)||0,live=Math.max(0,liveDt)||0;
  this.cooldown=Math.max(0,this.cooldown-real);
  for(const b of this.items){
   if(!b.landed){b.t=Math.min(b.path.seconds,b.t+real);b.landed=b.t>=b.path.seconds;}
   if(b.heard)b.rest+=live;
   else if(b.landed&&live>1e-6){b.heard=true;onRing({...b.path.landing},b.floor);}
  }
  for(let i=this.items.length-1;i>=0;i--)if(this.items[i].rest>=THROW.restSeconds)this.items.splice(i,1);
 }
 positions(){return this.items.map(b=>pointAt(b.path,b.t));}
 reset(){this.items=[];this.cooldown=0;}
}
/** A landed bell: the two nearest same-floor listeners within a per-kind radius of
 * clamp(.3·hearing,10,45) m (hear() then applies difficulty.sense and the omen's
 * hearing) search briefly along one branch. `search` is difficulty.search; `red`
 * is whether the bell lies in a red area. */
export function bellHear(search=1,red=false):HearOptions{
 return {radius:(_e,raw)=>Math.max(10,Math.min(45,.3*raw)),limit:2,search:(_e,d)=>Math.max(14,d/3.6+6)*search*(red?1.3:1),branches:1,sameFloor:true};
}
export const WARD={arm:.6,radius:1.3,spacing:1.6,max:2,stun:6,bossStun:2.5,bossImmune:8} as const;
export type PlacedWard={position:Position;floor:number;arming:number;get armed():boolean};
/** Paper wards bind only a pursuer in full chase; patrols, searches and hunts walk over them. */
export class Wards{
 placed:PlacedWard[]=[];bossImmune=0;
 place(position:Position,floor:number,onRamp:boolean):'placed'|'ramp'|'near'|'full'{
  if(onRamp)return 'ramp';
  if(this.placed.length>=WARD.max)return 'full';
  if(this.placed.some(w=>Math.abs(w.floor-floor)<.3&&Math.hypot(w.position.x-position.x,w.position.z-position.z)<WARD.spacing))return 'near';
  this.placed.push({position:{x:position.x,z:position.z},floor,arming:WARD.arm,get armed(){return this.arming<=1e-6;}});
  return 'placed';
 }
 /** Arming runs on real time; triggers and the boss's immunity wait for live time.
  * The immunity counts down only once the boss is no longer stunned. */
 step(dt:number,liveDt:number,actors:readonly Enemy[],stun:(e:Enemy,seconds:number)=>void){
  for(const w of this.placed)w.arming=Math.max(0,w.arming-(Math.max(0,dt)||0));
  if(!(liveDt>1e-6))return [];
  if(!actors.some(e=>isFinale(e.kind)&&e.brain.mode==='stunned'))this.bossImmune=Math.max(0,this.bossImmune-liveDt);
  const hits:{ward:PlacedWard;enemy:Enemy}[]=[];
  for(const ward of [...this.placed]){
   if(!ward.armed)continue;
   let enemy:Enemy|null=null,best:number=WARD.radius;
   for(const e of actors){
    if(e.brain.mode!=='chase'||(isFinale(e.kind)&&this.bossImmune>0)||Math.abs(floorBand(e.floor)-ward.floor)>.3||hits.some(h=>h.enemy===e))continue;
    const d=Math.hypot(e.position.x-ward.position.x,e.position.z-ward.position.z);if(d<=best){best=d;enemy=e;}
   }
   if(!enemy)continue;
   const boss=isFinale(enemy.kind);stun(enemy,boss?WARD.bossStun:WARD.stun);if(boss)this.bossImmune=WARD.bossImmune;
   this.placed.splice(this.placed.indexOf(ward),1);hits.push({ward,enemy});
  }
  return hits;
 }
 snapshot(){return {placed:this.placed.length};}
 reset(){this.placed=[];this.bossImmune=0;}
}
export type ItemPickup={id:string;kind:ItemKind;position:Position;floor:number;collected:boolean};
/** Four supplies spread like the documents (three on the ground floor, 40 m apart),
 * alternating 鈴 and 御札 so each kind is split across the map. */
export function placeItemPickups(sites:readonly {point:Position;floor:number}[],keepout:readonly {position:Position;floor:number;radius:number}[],random:()=>number,count=4):ItemPickup[]{
 return placeNotes(sites,keepout,random,count,3,40).map((s,i)=>({id:'item-'+i,kind:i%2?'ward':'bell',position:s.point,floor:s.floor,collected:false}));
}
/** A full slot leaves the pickup where it lies. */
export function collectItems(pickups:ItemPickup[],bag:ItemBag,player:Position,floor:number,walls:Obstacle[]):ItemKind[]{
 const found:ItemKind[]=[];
 for(const p of pickups)if(!p.collected&&bag[p.kind]<ITEM_CAPS[p.kind]&&Math.abs(floor-p.floor)<.6&&Math.hypot(player.x-p.position.x,player.z-p.position.z)<1.45&&!segmentBlocked(player,p.position,walls)){p.collected=true;bag.grant(p.kind);found.push(p.kind);}
 return found;
}
