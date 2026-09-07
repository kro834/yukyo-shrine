import type {Position,Obstacle} from './movement.ts';
import {segmentBlocked} from './shrine-gameplay.ts';
export type MirrorPickup={id:string;position:Position;floor:number;collected:boolean};
export class MirrorInventory {
 count=0;remaining=0;
 readonly pickups:MirrorPickup[];
 constructor(pickups:MirrorPickup[]){this.pickups=pickups;}
 get active(){return this.remaining>0;}
 grant(count:number){this.count+=Math.max(0,Math.floor(count));}
 use(){if(this.count===0||this.active)return false;this.count--;this.remaining=12;return true;}
 step(dt:number){this.remaining=Math.max(0,this.remaining-Math.max(0,dt));}
 collect(p:Position,floor:number,walls:Obstacle[]){let found=0;for(const m of this.pickups)if(!m.collected&&Math.abs(floor-m.floor)<.6&&Math.hypot(p.x-m.position.x,p.z-m.position.z)<1.45&&!segmentBlocked(p,m.position,walls)){m.collected=true;this.count++;found++;}return found;}
 reset(){this.count=0;this.remaining=0;for(const m of this.pickups)m.collected=false;}
 snapshot(){return {count:this.count,remaining:this.remaining};}
}
