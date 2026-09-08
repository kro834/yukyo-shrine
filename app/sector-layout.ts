import {prepareMountainLayout} from './mountain-plan.ts';
import {circusWallHeight} from './circus-enclosure.ts';
import {seededRandom} from './seeded-random.ts';
import type {Cell,Room} from './shrine-layout.ts';
import {NEW_HORROR_AREAS} from './horror-areas.ts';
import {assignOuterAreas} from './outer-areas.ts';
import {assignOrchestraRooms} from './orchestra-layout.ts';
import {assignErrorRooms} from './error-stage.ts';
import {assignParallelRooms,parallelHeight} from './parallel-world.ts';
import {encloseLayout} from './layout-envelope.ts';
import {STAGES,sectorConnections,type StageId} from './stage-profile.ts';
import {planOuterLandforms} from './outer-landform-plan.ts';
import {SECOND_DECK} from './vertical-layout.ts';
export type Sector={id:string;row:number;col:number;x1:number;x2:number;z1:number;z2:number;kind:Cell['kind'];rotation:number;variant:number};
export function createSectorLayout(seed=1,stage:StageId='shrine'){
 const profile=STAGES[stage],random=seededRandom(seed^profile.salt),grid=new Map<string,Cell>(),rooms:Room[]=[],sectors:Sector[]=[],paddies:{x1:number;x2:number;z1:number;z2:number}[]=[];
 const key=(x:number,z:number)=>x+','+z;
 const rect=(x1:number,z1:number,x2:number,z2:number,h=3.6,kind:Cell['kind']='passage')=>{for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++){const old=grid.get(key(x,z));if(!old||old.h<h)grid.set(key(x,z),{x,z,h,kind});}};
 const ring=(x1:number,z1:number,x2:number,z2:number,h:number,kind:Cell['kind'])=>{rect(x1,z1,x2,z1,h,kind);rect(x1,z2,x2,z2,h,kind);rect(x1,z1,x1,z2,h,kind);rect(x2,z1,x2,z2,h,kind);};
 const mix=<T>(input:readonly T[])=>{const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 // Two fixed landing sectors retain the three-storey stair anchors; all other regions shuffle.
 const pool=Object.entries(profile.counts).flatMap(([kind,count])=>Array<Cell['kind']>(count).fill(kind as Cell['kind']));
 const kinds:Cell['kind'][]=[],remaining=new Map<Cell['kind'],number>();
 for(const kind of pool)remaining.set(kind,(remaining.get(kind)??0)+1);
 const assign=(index:number):boolean=>{
   if(index===25)return true;
   const fixed=index===12||index===13,choices=fixed?['hall' as const]:mix([...remaining.keys()].filter(k=>remaining.get(k)!>0));
   for(const kind of choices){
     if(index%5&&kinds[index-1]===kind&&index!==13||index>=5&&kinds[index-5]===kind)continue;
     kinds[index]=kind;if(!fixed)remaining.set(kind,remaining.get(kind)!-1);
     if(assign(index+1))return true;
     if(!fixed)remaining.set(kind,remaining.get(kind)!+1);
   }
   return false;
 };
 if(!assign(0))throw new Error('Cannot arrange stage sectors');
 const connections=sectorConnections(random,profile.links);
 const fourRooms=new Set(mix(Array.from({length:25},(_,i)=>i).filter(i=>i!==13)).slice(0,12));
 for(let row=0;row<5;row++)for(let col=0;col<5;col++){
  const index=row*5+col,cx=(col-2)*19,cz=(row-2)*19,kind=kinds[index],h=stage==='orchestra'?(kind==='cave'?3.8:kind==='hall'||kind==='stone'?5.8:4.6):stage==='abyss'?(kind==='cistern'?5.2:kind==='cave'||kind==='field'?3.15:3.4):kind==='cave'?4.8:kind==='field'?7.5:kind==='yokocho'?4.5:3.8;
  const sector:Sector={id:`sector-${row+1}-${col+1}`,row,col,x1:cx-8,x2:cx+8,z1:cz-8,z2:cz+8,kind,rotation:Math.floor(random()*4),variant:Math.floor(random()*3)};sectors.push(sector);
  ring(cx-8,cz-8,cx+8,cz+8,h,kind);
  if(stage==='outer'&&kind==='field')rect(cx-7,cz-7,cx+7,cz+7,h,kind);
  rect(cx-8,cz,cx+8,cz,h,kind);rect(cx,cz-8,cx,cz+8,h,kind);
  if(col<4&&connections.has(index+':'+(index+1)))rect(cx+8,cz,cx+11,cz,h,kind);if(row<4&&connections.has(index+':'+(index+5)))rect(cx,cz+8,cx,cz+11,h,kind);
  if(index===13){rect(11,-5,27,-5,h,kind);for(const x of [14,19,24])rect(x,-8,x,8,h,kind);rect(12,0,23,8,9,'hall');}
  else for(const offset of [-4,4]){rect(cx-8,cz+offset,cx+8,cz+offset,h,kind);rect(cx+offset,cz-8,cx+offset,cz+8,h,kind);}
  const corners=index===13?[[-5,-5],[0,-5],[5,-5]]:mix([[-4,-4],[-4,4],[4,-4],[4,4]]).slice(0,fourRooms.has(index)?4:3);
  for(const [dx,dz] of corners){const x=cx+dx,z=cz+dz,w=kind==='factory'||index===13?3:random()>.6?4:3,d=kind==='factory'||index===13?3:random()>.6?4:3;
    rect(x-1,z-1,x+w-2,z+d-2,h,kind);
    rooms.push({id:'pending-'+rooms.length,x1:x-1,x2:x+w-2,z1:z-1,z2:z+d-2,h:Math.min(h,4.2),style:'tatami'});}
 }
 // Preserve the stair landing and the upper annex bridge as continuous clear volumes.
 rect(19,8,21,13,9.2,'hall');
 const blue=rooms.filter(r=>{const s=sectors.find(s=>r.x1>=s.x1&&r.x2<=s.x2&&r.z1>=s.z1&&r.z2<=s.z2)!;return s.kind==='hall'||s.kind==='stone';});
 const beadRooms=new Set(mix(blue).slice(0,13));
 const roomSpecs=mix(Array.from({length:87},(_,i)=>({id:'expansion-'+String(i+1).padStart(2,'0'),themeId:i>=57?NEW_HORROR_AREAS[i-57].id:undefined,style:['tatami','ritual','store','stone'][i%4] as Room['style']})));
 rooms.forEach((r,i)=>Object.assign(r,roomSpecs[i],{bead:beadRooms.has(r)}));
 // Vary the spare corner into an open bay; each bay joins the surrounding routes.
 for(const s of sectors){if(s.row===2&&s.col===3)continue;const cx=(s.col-2)*19,cz=(s.row-2)*19;
  const roomAt=(x:number,z:number)=>rooms.some(r=>x>=r.x1&&x<=r.x2&&z>=r.z1&&z<=r.z2);
  const corners=[[-4,-4],[-4,4],[4,-4],[4,4]].filter(([x,z])=>!roomAt(cx+x,cz+z));
  for(const [dx,dz] of corners){if(['cave','field','yokocho','shop'].includes(s.kind)){rect(cx+dx-2,cz+dz-2,cx+dx+2,cz+dz+2,s.kind==='cave'?5.8:s.kind==='field'?(stage==='abyss'?3.15:7.5):4.2,s.kind);}}
  if(s.variant>0){const d=s.rotation%2?2:-2;if(s.rotation<2)rect(cx-4,cz+d,cx+4,cz+d,3.8,s.kind);else rect(cx+d,cz-4,cx+d,cz+4,3.8,s.kind);}
 }
 // Water belongs to the outer landscape basins. Other stages retain dry voids;
 // the old spare-cell rectangles created unrelated, uncontained rice paddies.
 if(stage==='outer')for(const room of rooms)for(let x=room.x1;x<=room.x2;x++)for(let z=room.z1;z<=room.z2;z++){
  const cell=grid.get(key(x,z));
  if(cell?.kind==='field')Object.assign(cell,{kind:'hall',h:room.h});
 }
 // Narrow shrine corridors share collision and scenery; preserve the broad stair hall.
  for(const c of grid.values())if(stage!=='circus'&&c.kind==='hall'&&!(c.x>=11&&c.x<=27&&c.z>=0&&c.z<=13)&&!rooms.some(r=>c.x>=r.x1&&c.x<=r.x2&&c.z>=r.z1&&c.z<=r.z2))c.kind='passage';
  const landformPlan=stage==='outer'?planOuterLandforms(grid,sectors,rooms,c=>SECOND_DECK.grid.has(key(c.x,c.z))):null;
  if(landformPlan)for(const cellKey of grid.keys())if(!landformPlan.grid.has(cellKey))grid.delete(cellKey);
  if(stage==='parallel'){
    for(const c of grid.values())if(c.h<8)c.h=parallelHeight(c.kind);
    assignParallelRooms(rooms,grid);
  }
  if(stage==='mountain')prepareMountainLayout(grid,rooms);
  const envelope=encloseLayout(grid,rooms,paddies,stage==='outer');
  if(stage==='circus'){const byCenter=new Map(envelope.obstacles.map(o=>[((o.minX+o.maxX)/2)+','+((o.minZ+o.maxZ)/2),o]));for(const w of envelope.walls){w.h=circusWallHeight(w,rooms);const o=byCenter.get(w.x+','+w.z);if(o)o.maxY=w.h;}}
 assignOuterAreas(rooms,seed,stage);
 assignOrchestraRooms(rooms,seed,stage);
 if(stage==='error')assignErrorRooms(rooms,seed);
 return {cells:[...grid.values()],grid,...envelope,rooms,doors:envelope.doors,courts:[] as {x:number;z:number;rx:number;rz:number;h:number}[],stages:sectors,paddies,expansionAreas:rooms,sectors,stage,connections,landforms:landformPlan?.regions??[]};
}
