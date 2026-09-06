import type {Obstacle,Position} from './movement.ts';
export const GOAL={x:0,z:15.5};
export const GOAL_WALLS:Obstacle[]=[
 {minX:-4,maxX:-1.8,minZ:15.35,maxZ:15.75},{minX:1.8,maxX:4,minZ:15.35,maxZ:15.75},
 {minX:-4.15,maxX:-3.85,minZ:15.5,maxZ:18},{minX:3.85,maxX:4.15,minZ:15.5,maxZ:18},
 {minX:-4.15,maxX:4.15,minZ:17.75,maxZ:18},
];
const CLOSED:Obstacle[]=[{minX:-1.8,maxX:1.8,minZ:15.4,maxZ:15.65}],OPEN:Obstacle[]=[];
export class ShrineGoal {
 progress=0;completed=false;
 readonly required:number;
 constructor(required:number){this.required=required;}
 blockers(){return this.progress<.98?CLOSED:OPEN;}
 update(dt:number,collected:number,player:Position,floor:number){
  if(this.completed)return;
  const ready=this.required>0&&collected>=this.required;
  if(ready&&(this.progress>0||(Math.abs(floor)<.4&&Math.hypot(player.x-GOAL.x,player.z-GOAL.z)<5)))this.progress=Math.min(1,this.progress+Math.max(0,Math.min(dt,.05))*.9);
  if(ready&&this.progress>=.98&&Math.abs(floor)<.4&&Math.abs(player.x)<1.5&&player.z>16.5&&player.z<17.45)this.completed=true;
 }
}
