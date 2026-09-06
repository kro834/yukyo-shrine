export type Cell = {x:number;z:number;h:number;kind:'hall'|'passage'|'stone'};
export type Wall = {x:number;z:number;alongX:boolean;h:number;insideX:number;insideZ:number};
export const CELL=4;
export const SPAWN={x:0,z:14};
export function createLayout() {
  const grid=new Map<string,Cell>();
  const key=(x:number,z:number)=>x+','+z;
  const rect=(x1:number,z1:number,x2:number,z2:number,h=3.6,kind:Cell['kind']='passage')=>{
    for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){
      const old=grid.get(key(x,z));
      if(!old||h>old.h)grid.set(key(x,z),{x,z,h,kind});
    }
  };
  rect(-2,-5,2,4,7,'hall');
  rect(0,-20,0,-6); rect(-3,-12,3,-8,8,'hall');
  rect(-13,-3,13,-3); rect(-11,-17,11,-17);
  rect(-11,-17,-11,-3); rect(11,-17,11,-3);
  rect(-8,-1,-3,-1);rect(-8,-1,-8,5);rect(-8,5,6,5);rect(6,-3,6,5);
  rect(-14,-10,-4,-10);rect(-6,-17,-6,-5);rect(-11,-5,-6,-5);
  rect(4,-7,14,-7);rect(7,-17,7,-7);rect(3,-12,7,-12);
  rect(-14,-12,-12,-8,5,'stone');rect(12,-9,14,-5,5,'hall');
  rect(-12,-19,-10,-16,5.8,'hall');rect(10,-19,12,-16,5.8,'hall');
  rect(-5,-23,5,-23);rect(-5,-23,-5,-17);rect(5,-23,5,-17);
  rect(-2,-25,2,-20,6.5,'stone');
  rect(-11,-25,-11,-19);rect(-11,-25,-5,-25);rect(-5,-25,-5,-23);
  rect(11,-24,11,-19);rect(5,-24,11,-24);rect(5,-24,5,-23);
  rect(-3,6,0,8,4.8,'hall');rect(-2,5,-2,6);
  // Side chambers: storehouse, tatami room, bell room.
  rect(-8,-8,-7,-6,3.6,'hall');rect(-7,-6,-6,-6);
  rect(7,1,9,3,3.6,'hall');rect(6,2,7,2);
  rect(-9,-23,-8,-21,5,'hall');rect(-11,-22,-9,-22);
  const walls:Wall[]=[];
  const obstacles:{minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
  for(const c of grid.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if(grid.has(key(c.x+dx,c.z+dz)))continue;
    const x=c.x*CELL+dx*CELL/2,z=c.z*CELL+dz*CELL/2,alongX=!!dz;
    walls.push({x,z,alongX,h:c.h,insideX:-dx,insideZ:-dz});
    obstacles.push({minX:x-(alongX?2:.18),maxX:x+(alongX?2:.18),minZ:z-(alongX?.18:2),maxZ:z+(alongX?.18:2)});
  }
  const narrows:{x:number;z:number;alongX:boolean}[]=[];
  for(const c of grid.values()){
    if(c.kind!=='passage'||!(c.x===-11||c.x===7||c.z===-23))continue;
    const ew=grid.has(key(c.x-1,c.z))&&grid.has(key(c.x+1,c.z));
    const ns=grid.has(key(c.x,c.z-1))&&grid.has(key(c.x,c.z+1));
    if(ew===ns)continue;
    const x=c.x*CELL,z=c.z*CELL;narrows.push({x,z,alongX:ew});
    for(const sign of [-1,1])obstacles.push(ew
      ?{minX:x-2,maxX:x+2,minZ:z+sign*1.68-.32,maxZ:z+sign*1.68+.32}
      :{minX:x+sign*1.68-.32,maxX:x+sign*1.68+.32,minZ:z-2,maxZ:z+2});
  }
  return {cells:[...grid.values()],grid,walls,obstacles,narrows};
}
