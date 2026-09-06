import type {Obstacle,Position} from './movement.ts';
import {segmentBlocked} from './shrine-gameplay.ts';
export const GOAL={x:0,z:15.5};
export const ALTAR={x:-2.8,z:13.3};
export const GOAL_WALLS:Obstacle[]=[
 {minX:-4,maxX:-1.8,minZ:15.35,maxZ:15.75},{minX:1.8,maxX:4,minZ:15.35,maxZ:15.75},
 {minX:-4.15,maxX:-3.85,minZ:15.5,maxZ:18},{minX:3.85,maxX:4.15,minZ:15.5,maxZ:18},
 {minX:-4.15,maxX:4.15,minZ:17.75,maxZ:18},
 {minX:-3.65,maxX:-1.95,minZ:12.9,maxZ:13.7},
];
const CLOSED:Obstacle[]=[{minX:-1.8,maxX:1.8,minZ:15.4,maxZ:15.65}],OPEN:Obstacle[]=[];
export class ShrineGoal {
 progress=0;completed=false;
 readonly required=5;blueOffered=0;redOffered=0;
 get unlocked(){return this.blueOffered>=5||this.redOffered>=1;}
 nearAltar(player:Position,yaw:number,floor:number,walls:Obstacle[]){
  const dx=ALTAR.x-player.x,dz=ALTAR.z-player.z,d=Math.hypot(dx,dz);
  // Test the reachable front edge, not the centre inside the altar pedestal.
  const edge={x:ALTAR.x,z:ALTAR.z-.85};
  return Math.abs(floor)<.4&&d<2.5&&(d<1.2||(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/d>.1)&&!segmentBlocked(player,edge,walls.filter(w=>w!==GOAL_WALLS[GOAL_WALLS.length-1]));
 }
 offer(inventory:{blue:number;red:number}){
  const used={blue:0,red:0};if(this.unlocked)return used;
  if(inventory.red>=1){used.red=1;this.redOffered=1;}
  else {used.blue=Math.min(Math.max(0,inventory.blue),5-this.blueOffered);this.blueOffered+=used.blue;}
  return used;
 }
 blockers(){return this.progress<.98?CLOSED:OPEN;}
 update(dt:number,player:Position,floor:number){
  if(this.completed)return;
  const ready=this.unlocked;
  if(ready)this.progress=Math.min(1,this.progress+Math.max(0,Math.min(dt,.05))*.9);
  if(ready&&this.progress>=.98&&Math.abs(floor)<.4&&Math.abs(player.x)<1.5&&player.z>16.5&&player.z<17.45)this.completed=true;
 }
}
