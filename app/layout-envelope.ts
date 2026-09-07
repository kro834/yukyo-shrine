import type {Cell,Wall,DoorSpec,Room} from './shrine-layout.ts';
const CELL=4;const key=(x:number,z:number)=>x+','+z;
export function encloseLayout(grid:Map<string,Cell>,rooms:Room[],paddies:{x1:number;x2:number;z1:number;z2:number}[]=[]){
  const walls:Wall[]=[];
  const doors:DoorSpec[]=[];
  const obstacles:{minX:number;maxX:number;minZ:number;maxZ:number;maxY?:number}[]=[];
  for(const c of grid.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if(grid.has(key(c.x+dx,c.z+dz)))continue;
    const x=c.x*CELL+dx*CELL/2,z=c.z*CELL+dz*CELL/2,alongX=!!dz;
    const basin=false;
    const paddy=c.kind==='field'&&paddies.some(p=>c.x+dx>=p.x1&&c.x+dx<=p.x2&&c.z+dz>=p.z1&&c.z+dz<=p.z2);
    const height=basin?1.1:paddy?.48:c.h;
    walls.push({x,z,alongX,h:height,insideX:-dx,insideZ:-dz,kind:c.kind});
    obstacles.push({minX:x-(alongX?2:.18),maxX:x+(alongX?2:.18),minZ:z-(alongX?.18:2),maxZ:z+(alongX?.18:2),maxY:height});
  }
  // Select real entrances on every connected side before building any partition.
  const openingMap=new Map<string,DoorSpec>();
  for(const r of rooms)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const candidates:{x:number;z:number;distance:number}[]=[];
    for(let x=r.x1;x<=r.x2;x++)for(let z=r.z1;z<=r.z2;z++){
      if(dx&&x!==(dx<0?r.x1:r.x2)||dz&&z!==(dz<0?r.z1:r.z2))continue;
      if(!grid.has(key(x+dx,z+dz)))continue;
      candidates.push({x:x*4+dx*2,z:z*4+dz*2,distance:dx?Math.abs(z-(r.z1+r.z2)/2):Math.abs(x-(r.x1+r.x2)/2)});
    }
    candidates.sort((a,b)=>a.distance-b.distance);const p=candidates[0];if(!p)continue;
    const k=key(p.x,p.z),old=openingMap.get(k);
    if(old){if(!old.rooms!.includes(r.id))old.rooms!.push(r.id);}
    else openingMap.set(k,{id:'door-'+k,x:p.x,z:p.z,alongX:!!dz,room:r.id,rooms:[r.id]});
  }
  doors.push(...openingMap.values());
  for(const r of rooms){
    for(let x=r.x1;x<=r.x2;x++)for(let z=r.z1;z<=r.z2;z++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz;
      if(nx>=r.x1&&nx<=r.x2&&nz>=r.z1&&nz<=r.z2)continue;
      if(!grid.has(key(nx,nz)))continue; // Existing outer envelope already closes this edge.
      const wx=x*CELL+dx*2,wz=z*CELL+dz*2;
      if(openingMap.has(key(wx,wz)))continue;
      if(walls.some(w=>w.x===wx&&w.z===wz))continue;
      walls.push({x:wx,z:wz,alongX:!!dz,h:r.h,insideX:-dx,insideZ:-dz,twoSided:true});
      obstacles.push({minX:wx-(dz?2:.18),maxX:wx+(dz?2:.18),minZ:wz-(dz?.18:2),maxZ:wz+(dz?.18:2)});
    }
  }
  const narrows:{x:number;z:number;alongX:boolean}[]=[];
  for(const c of grid.values()){
    if(!['passage','yokocho'].includes(c.kind))continue;
    const ew=grid.has(key(c.x-1,c.z))&&grid.has(key(c.x+1,c.z));
    const ns=grid.has(key(c.x,c.z-1))&&grid.has(key(c.x,c.z+1));
    const degree=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid.has(key(c.x+dx,c.z+dz))).length;
    if(ew===ns||degree!==2)continue;
    const x=c.x*CELL,z=c.z*CELL;narrows.push({x,z,alongX:ew});
    for(const sign of [-1,1])obstacles.push(ew
      ?{minX:x-2,maxX:x+2,minZ:z+sign*1.68-.32,maxZ:z+sign*1.68+.32}
      :{minX:x+sign*1.68-.32,maxX:x+sign*1.68+.32,minZ:z-2,maxZ:z+2});
  }
  return {walls,doors,obstacles,narrows};
}
