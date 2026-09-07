import type {createSectorLayout} from './sector-layout.ts';
import {fieldFoliageRoots} from './field-landscape.ts';
import type {Obstacle} from './movement.ts';
export type ShrubPlacement={x:number;y:number;z:number;yaw:number;variant:number};
/** Ground cover stays outside the traversable grid, on stable, dry bank shoulders. */
export function shrubPlacements(layout:ReturnType<typeof createSectorLayout>,seed:number,height:(x:number,z:number)=>number,obstacles:Obstacle[]){
 if(layout.stage!=='outer')return [];
 const candidates=fieldFoliageRoots(layout,seed,()=>0,obstacles,height).roots.filter(r=>r.kind==='verge');
 const placed:ShrubPlacement[]=[];
 for(const p of candidates){
  if(placed.length>=120)break;
  let clear=true;
  for(let x=Math.floor((p.x-.85+2)/4);x<=Math.floor((p.x+.85+2)/4);x++)for(let z=Math.floor((p.z-.85+2)/4);z<=Math.floor((p.z+.85+2)/4);z++)if(layout.grid.has(x+','+z))clear=false;
  if(!clear||p.y<-.95||placed.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<4.5))continue;
  const h=height(p.x,p.z),samples=[[.35,0],[-.35,0],[0,.35],[0,-.35]].map(([x,z])=>height(p.x+x,p.z+z));
  if(samples.some(y=>Math.abs(y-h)>.18))continue;
  placed.push({x:p.x,y:h-.035,z:p.z,yaw:p.yaw,variant:p.variant%4});
 }
 return placed;
}
