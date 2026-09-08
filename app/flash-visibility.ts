import type {Obstacle,Position} from './movement.ts';
import {nearbyObstacles} from './spatial.ts';
import {inFlashCone} from './flash-cone.ts';
type Point3=Position&{y:number};
/** Height-aware light occlusion; walking still uses the full floor footprint. */
export function lightBlocked(a:Point3,b:Point3,obstacles:Obstacle[]){
 return nearbyObstacles(obstacles,Math.min(a.x,b.x),Math.min(a.z,b.z),Math.max(a.x,b.x),Math.max(a.z,b.z)).some(o=>{
  let lo=0,hi=1;
  for(const [origin,direction,min,max] of [[a.x,b.x-a.x,o.minX,o.maxX],[a.y,b.y-a.y,o.minY??-100,o.maxY??100],[a.z,b.z-a.z,o.minZ,o.maxZ]]){
   if(Math.abs(direction)<1e-9){if(origin<min||origin>max)return false;continue;}
   let t1=(min-origin)/direction,t2=(max-origin)/direction;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
 });
}
export function flashHits(origin:Point3,target:Position,floor:number,targetFloor:number,yaw:number,pitch:number,walls:Obstacle[],bodyHeights:readonly number[]=[1.5,2.1,.85],terrain?:(z:number)=>number){
 // Different storeys stay separate, while nearby enemies on a staircase can
 // be illuminated. Sample the visible body rather than only its centre.
 if(Math.abs(targetFloor-floor)>3||Math.hypot(target.x-origin.x,target.z-origin.z)>10)return false;
 for(const height of bodyHeights){
  const point={...target,y:targetFloor+height};
  const worldOrigin=terrain?{...origin,y:origin.y+terrain(origin.z)}:origin,worldPoint=terrain?{...point,y:point.y+terrain(point.z)}:point;
  if(inFlashCone(worldOrigin,worldPoint,yaw,pitch)&&!lightBlocked(origin,point,walls))return true;
 }
 return false;
}
