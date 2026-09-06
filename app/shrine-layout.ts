export type Cell = {x:number;z:number;h:number;kind:'hall'|'passage'|'stone'};
export type Wall = {x:number;z:number;alongX:boolean;h:number;insideX:number;insideZ:number;twoSided?:boolean};
export type Room = {id:string;x1:number;x2:number;z1:number;z2:number;style:'tatami'|'store'|'ritual'|'stone';h:number};
export type DoorSpec = {id:string;x:number;z:number;alongX:boolean;room:string};
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
  // Second exits for every former side room.
  rect(-2,8,6,8);rect(6,5,6,8);
  rect(9,-3,9,2);rect(-8,-10,-8,-8);
  rect(-8,-25,-8,-23);rect(13,-5,13,-3);rect(-13,-8,-13,-3);
  // Three interlocked outer circuits, with cross-passages and offsets.
  const ring=(x1:number,z1:number,x2:number,z2:number)=>{rect(x1,z1,x2,z1);rect(x1,z2,x2,z2);rect(x1,z1,x1,z2);rect(x2,z1,x2,z2);};
  ring(-22,-43,22,-27);ring(-16,-39,16,-29);ring(-22,-27,-11,-10);ring(11,-27,22,-10);
  rect(-22,-17,-11,-17);rect(11,-17,22,-17);
  rect(0,-43,0,-25);rect(-22,-32,22,-32);rect(-22,-37,22,-37);
  rect(-16,-43,-16,-39);rect(16,-43,16,-39);
  rect(-22,-10,-14,-10);rect(14,-10,22,-10);
  rect(-16,-27,-16,-22);rect(-16,-22,-11,-22);
  rect(16,-27,16,-22);rect(11,-22,16,-22);
  const rooms:Room[]=[
    {id:'west-guest',x1:-11,x2:-7,z1:-34,z2:-30,h:3.8,style:'tatami'},
    {id:'east-archive',x1:7,x2:11,z1:-34,z2:-30,h:3.8,style:'store'},
    {id:'west-ritual',x1:-11,x2:-7,z1:-39,z2:-35,h:5.6,style:'ritual'},
    {id:'east-water',x1:7,x2:11,z1:-39,z2:-35,h:5.6,style:'stone'},
    {id:'west-retreat',x1:-21,x2:-17,z1:-23,z2:-19,h:3.4,style:'tatami'},
    {id:'east-reliquary',x1:17,x2:21,z1:-23,z2:-19,h:4.4,style:'ritual'},
  ];
  rect(-22,-21,-11,-21);rect(11,-21,22,-21);
  for(const x of [-12,-6,6,12])rect(x,-39,x,-29);
  for(const r of rooms)rect(r.x1,r.z1,r.x2,r.z2,r.h,r.style==='stone'?'stone':'hall');
  // Clip only single-cell stubs; circulation and all rooms remain connected.
  let removed=true;
  while(removed){removed=false;for(const [k,c] of grid){
    const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid.has(key(c.x+dx,c.z+dz))).length;
    if(neighbors<2){grid.delete(k);removed=true;}
  }}
  const walls:Wall[]=[];
  const doors:DoorSpec[]=[];
  const obstacles:{minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
  for(const c of grid.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if(grid.has(key(c.x+dx,c.z+dz)))continue;
    const x=c.x*CELL+dx*CELL/2,z=c.z*CELL+dz*CELL/2,alongX=!!dz;
    walls.push({x,z,alongX,h:c.h,insideX:-dx,insideZ:-dz});
    obstacles.push({minX:x-(alongX?2:.18),maxX:x+(alongX?2:.18),minZ:z-(alongX?.18:2),maxZ:z+(alongX?.18:2)});
  }
  for(const r of rooms){
    const middleZ=(r.z1+r.z2)/2;
    for(let x=r.x1;x<=r.x2;x++)for(let z=r.z1;z<=r.z2;z++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz;
      if(nx>=r.x1&&nx<=r.x2&&nz>=r.z1&&nz<=r.z2)continue;
      if(!grid.has(key(nx,nz)))continue; // Existing outer envelope already closes this edge.
      const wx=x*CELL+dx*2,wz=z*CELL+dz*2;
      if(dx!==0&&z===middleZ){doors.push({id:r.id+(dx<0?'-west':'-east'),x:wx,z:wz,alongX:false,room:r.id});continue;}
      if(walls.some(w=>w.x===wx&&w.z===wz))continue;
      walls.push({x:wx,z:wz,alongX:!!dz,h:r.h,insideX:-dx,insideZ:-dz,twoSided:true});
      obstacles.push({minX:wx-(dz?2:.18),maxX:wx+(dz?2:.18),minZ:wz-(dz?.18:2),maxZ:wz+(dz?.18:2)});
    }
  }
  const narrows:{x:number;z:number;alongX:boolean}[]=[];
  for(const c of grid.values()){
    if(c.kind!=='passage'||!(c.x===-11||c.x===7||c.z===-23))continue;
    const ew=grid.has(key(c.x-1,c.z))&&grid.has(key(c.x+1,c.z));
    const ns=grid.has(key(c.x,c.z-1))&&grid.has(key(c.x,c.z+1));
    const degree=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid.has(key(c.x+dx,c.z+dz))).length;
    if(ew===ns||degree!==2)continue;
    const x=c.x*CELL,z=c.z*CELL;narrows.push({x,z,alongX:ew});
    for(const sign of [-1,1])obstacles.push(ew
      ?{minX:x-2,maxX:x+2,minZ:z+sign*1.68-.32,maxZ:z+sign*1.68+.32}
      :{minX:x+sign*1.68-.32,maxX:x+sign*1.68+.32,minZ:z-2,maxZ:z+2});
  }
  return {cells:[...grid.values()],grid,walls,obstacles,narrows,rooms,doors};
}
