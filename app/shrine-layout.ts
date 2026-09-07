import {seededRandom} from './seeded-random.ts';
import {expandAreas} from './expansion-areas.ts';
export type Cell = {x:number;z:number;h:number;kind:'hall'|'passage'|'stone'|'factory'|'bath'|'cistern'|'shop'|'cave'|'field'|'yokocho'};
export type Wall = {x:number;z:number;alongX:boolean;h:number;insideX:number;insideZ:number;twoSided?:boolean;kind?:Cell['kind']};
export type Room = {id:string;themeId?:string;bead?:boolean;x1:number;x2:number;z1:number;z2:number;style:'tatami'|'store'|'ritual'|'stone';h:number};
export type DoorSpec = {id:string;x:number;z:number;alongX:boolean;room:string;rooms?:string[];floor?:number};
export const CELL=4;
export const SPAWN={x:0,z:14};
export function createLayout(seed=1) {
  const random=seededRandom(seed);
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
    {id:'entry-west',x1:-5,x2:-3,z1:-1,z2:1,h:3.8,style:'tatami'},
    {id:'entry-east',x1:3,x2:5,z1:-1,z2:1,h:3.8,style:'tatami'},
    {id:'annex-a',x1:15,x2:17,z1:1,z2:3,h:3.6,style:'tatami'},
    {id:'annex-b',x1:18,x2:20,z1:1,z2:3,h:3.6,style:'tatami'},
    {id:'annex-c',x1:15,x2:17,z1:4,z2:6,h:3.6,style:'tatami'},
    {id:'annex-d',x1:18,x2:20,z1:4,z2:6,h:3.6,style:'tatami'},
    {id:'old-tatami',x1:7,x2:9,z1:1,z2:3,h:3.6,style:'tatami'},
    {id:'west-guest',x1:-11,x2:-7,z1:-34,z2:-30,h:3.8,style:'tatami'},
    {id:'east-archive',x1:7,x2:11,z1:-34,z2:-30,h:3.8,style:'store'},
    {id:'west-ritual',x1:-11,x2:-7,z1:-39,z2:-35,h:5.6,style:'ritual'},
    {id:'east-water',x1:7,x2:11,z1:-39,z2:-35,h:5.6,style:'stone'},
    {id:'west-retreat',x1:-21,x2:-17,z1:-23,z2:-19,h:3.4,style:'tatami'},
    {id:'east-reliquary',x1:17,x2:21,z1:-23,z2:-19,h:4.4,style:'ritual'},
  ];
  rect(-22,-21,-11,-21);rect(11,-21,22,-21);
  rect(-4,-3,-4,-1);rect(4,-3,4,-1);
  rect(12,0,23,8,9,'hall');rect(6,5,12,5);rect(9,-3,14,-3);rect(14,-3,14,0);
  for(const x of [-12,-6,6,12])rect(x,-39,x,-29);
  for(const r of rooms)rect(r.x1,r.z1,r.x2,r.z2,r.h,r.style==='stone'?'stone':'hall');
  // Broad cloister courts with solid central sanctuaries: four routes around each.
  const courts=[{x:0,z:-34,rx:4,rz:5,h:8.4},{x:-17,z:-14,rx:3,rz:3,h:6.2},{x:17,z:-14,rx:3,rz:3,h:6.2}];
  for(const c of courts){
    rect(c.x-c.rx,c.z-c.rz,c.x+c.rx,c.z+c.rz,c.h,'stone');
    for(let x=c.x-1;x<=c.x+1;x++)for(let z=c.z-1;z<=c.z+1;z++)grid.delete(key(x,z));
  }
  // Fold the long outer galleries into alcoved doglegs instead of endless straight tubes.
  for(const side of [-1,1]){
    for(let z=-36;z<=-32;z++)grid.delete(key(side*22,z));
    rect(Math.min(side*20,side*22),-37,Math.max(side*20,side*22),-37);
    rect(side*20,-37,side*20,-31);
    rect(Math.min(side*20,side*22),-31,Math.max(side*20,side*22),-31);
  }
  // Three enclosed wings, each connected at two distant entrances and internally looped.
  const stages=[
    {id:'shop',x1:-24,x2:-12,z1:-1,z2:8,kind:'shop' as const},
    {id:'cave',x1:-47,x2:-25,z1:-8,z2:8,kind:'cave' as const},
    {id:'field',x1:25,x2:48,z1:-7,z2:8,kind:'field' as const},
    {id:'factory',x1:25,x2:41,z1:-38,z2:-16,kind:'factory' as const},
    {id:'bath',x1:-22,x2:22,z1:-70,z2:-47,kind:'bath' as const},
    {id:'cistern',x1:-48,x2:-25,z1:-46,z2:-10,kind:'cistern' as const},
  ];
  rect(-24,-1,-12,8,4.5,'shop');rect(-12,1,-8,1);rect(-12,5,-8,5);
  for(const side of [-1,1]){
    if(side===1){
      rect(22,-17,46,-17);rect(22,-37,40,-37);ring(27,-37,40,-17);ring(30,-33,37,-21);
      rect(27,-27,40,-27);rect(27,-31,40,-31);rect(33,-37,33,-17);rect(27,-17,27,-7);rect(46,-17,46,-7);
      for(const x of [29,36])for(const z of [-35,-25])rect(x,z,x+2,z+2,3.6,'hall');continue;
    }
    const a=Math.min(side*22,side*48),b=Math.max(side*22,side*48);
    rect(a,-17,b,-17);rect(a,-37,b,-37);
    const left=Math.min(side*27,side*46),right=Math.max(side*27,side*46);
    ring(left,-45,right,-11);ring(left+3,-41,right-3,-15);
    rect(left,-25,right,-25);rect(left,-33,right,-33);
    for(const x of [left+6,right-6])rect(x,-45,x,-11);
    rect(left+2,-31,right-2,-27,6.5,'hall');
    rect(left+2,-23,left+7,-19,5,'hall');rect(right-7,-23,right-2,-19,5,'hall');
    rect(left+2,-41,left+7,-35,7,'hall');rect(right-7,-41,right-2,-35,7,'hall');
  }
  rect(-16,-50,-16,-43);rect(16,-50,16,-43);
  ring(-21,-69,21,-49);ring(-15,-65,15,-53);
  rect(-21,-59,21,-59);rect(0,-69,0,-49);
  rect(-9,-69,-9,-49);rect(9,-69,9,-49);
  rect(-7,-63,7,-55,6.8,'hall');
  for(const x of [-18,18])rect(x-2,-64,x+2,-54,4.2,'hall');
  // Bath basin is a solid island with walkable promenades on every side.
  for(let x=-2;x<=2;x++)for(let z=-61;z<=-57;z++)grid.delete(key(x,z));
  // Southern karst caverns: irregular inner chambers, two cistern mouths and
  // two passages into the market. Rock islands stay solid in every seed.
  ring(-47,-8,-27,8);ring(-43,-4,-31,4);
  const caveCross=random()<.5?-1:1,caveSpine=random()<.5?-39:-35;
  rect(-47,caveCross,-27,caveCross,5.8,'cave');rect(caveSpine,-8,caveSpine,8,5.8,'cave');
  for(let x=-43;x<=-31;x++)for(let z=-4;z<=4;z++)if(((x+37)/6)**2+(z/4)**2<1)rect(x,z,x,z,7,'cave');
  for(const [x,z] of [[-40,-2],[-34,2]])for(let dx=0;dx<=1;dx++)for(let dz=0;dz<=1;dz++)grid.delete(key(x+dx,z+dz));
  rect(-46,-11,-46,-8);rect(-27,-11,-27,-8);rect(-27,1,-24,1);rect(-27,5,-24,5);
  // Open, water-filled paddies encircled by walkable earthen berms. Each path
  // joins another path; no unmarked exit leads outside the stage.
  rect(26,-7,48,8,8,'field');rect(27,-11,27,-7);rect(46,-11,46,-7);rect(23,1,26,1);rect(23,7,26,7);
  const paddies:{x1:number;x2:number;z1:number;z2:number}[]=[];
  for(const [x1,x2] of [[28,32],[35,39],[42,46]])for(const [z1,z2] of [[-5,-2],[1,4]]){
    paddies.push({x1,x2,z1,z2});for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++)grid.delete(key(x,z));
  }
  const expansionAreas=expandAreas(grid,rooms,courts);
  // Unroofed back alleys: three cross-linked lanes behind tightly packed shops.
  for(const x of [29,34,39,44,48])rect(x,14,x,48,4.5,'yokocho');
  for(const z of [14,22,31,40,48])rect(29,z,48,z,4.5,'yokocho');
  rect(22,14,29,14);rect(22,48,29,48);rect(29,45,34,48,5.5,'yokocho');
  // Generate new loops between the fixed landmark rooms. A passage always joins
  // two existing routes, so random generation cannot introduce a dead end.
  const protectedCell=(x:number,z:number)=>
    (x>=25&&x<=49&&z>=-8&&z<=9)||(x>=-48&&x<=-25&&z>=-9&&z<=9)||
    (Math.abs(x)<=14&&z>-27)||
    (Math.abs(x)<=3&&z>=-62&&z<=-56)||
    rooms.some(r=>x>=r.x1-1&&x<=r.x2+1&&z>=r.z1-1&&z<=r.z2+1)||
    courts.some(c=>Math.abs(x-c.x)<=c.rx&&Math.abs(z-c.z)<=c.rz);
  const starts=[...grid.values()].map(c=>({c,order:random()})).sort((a,b)=>a.order-b.order);
  let loops=0;
  for(const {c} of starts){
    if(loops>=38)break;
    for(const [dx,dz] of [[1,0],[0,1]]){
      const length=3+Math.floor(random()*5),end=grid.get(key(c.x+dx*length,c.z+dz*length));
      if(!end||random()>.55)continue;
      const cells=Array.from({length:length-1},(_,i)=>({x:c.x+dx*(i+1),z:c.z+dz*(i+1)}));
      if(cells.some(p=>grid.has(key(p.x,p.z))||protectedCell(p.x,p.z)))continue;
      for(const p of cells)grid.set(key(p.x,p.z),{...p,h:3.6,kind:'passage'});loops++;
    }
  }
  for(const c of grid.values()){
    const s=stages.find(s=>c.x>=s.x1&&c.x<=s.x2&&c.z>=s.z1&&c.z<=s.z2);
    if(s){c.kind=s.kind;c.h=Math.max(c.h,s.kind==='factory'?3.9:s.kind==='cistern'?4.6:s.kind==='cave'?5.8:3.8);}
  }
  // Clip only single-cell stubs; circulation and all rooms remain connected.
  let removed=true;
  while(removed){removed=false;for(const [k,c] of grid){
    const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid.has(key(c.x+dx,c.z+dz))).length;
    if(neighbors<2){grid.delete(k);removed=true;}
  }}
  const walls:Wall[]=[];
  const doors:DoorSpec[]=[];
  const obstacles:{minX:number;maxX:number;minZ:number;maxZ:number;maxY?:number}[]=[];
  for(const c of grid.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if(grid.has(key(c.x+dx,c.z+dz)))continue;
    const x=c.x*CELL+dx*CELL/2,z=c.z*CELL+dz*CELL/2,alongX=!!dz;
    const basin=c.kind==='bath'&&c.x+dx>=-2&&c.x+dx<=2&&c.z+dz>=-61&&c.z+dz<=-57;
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
  return {cells:[...grid.values()],grid,walls,obstacles,narrows,rooms,doors,courts,stages,paddies,expansionAreas};
}
