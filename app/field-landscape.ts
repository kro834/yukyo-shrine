import type * as THREE from 'three';
import type {createSectorLayout} from './sector-layout.ts';
import type {Obstacle} from './movement.ts';
import {nearbyObstacles} from './spatial.ts';
import {STAIRS} from './annex.ts';
import {HIGH_STAIRS} from './vertical-layout.ts';
import {belowUpperDeck} from './ground-clearance.ts';
import {makeFoliageGeometry,foliageHash,FOLIAGE_LIMITS,type FoliageKind} from './field-foliage.ts';
type Layout=ReturnType<typeof createSectorLayout>;
type Root={kind:FoliageKind;x:number;y:number;z:number;priority:number;variant:number;yaw:number};

/** Plants grow around occupied ground, never creating new collision or hiding crouched enemies. */
export function fieldFoliageRoots(layout:Layout,seed:number,height:(x:number,z:number)=>number,obstacles:Obstacle[],vergeHeight:(x:number,z:number)=>number=()=>-.25){
 const candidates:Root[]=[],hash=(x:number,z:number,salt:number)=>foliageHash(x,z,seed,salt);
 const protectedAt=(x:number,z:number,r:number)=>{
  if(belowUpperDeck(x-r,x+r,z-r,z+r))return true;
  if([...STAIRS,...HIGH_STAIRS].some(s=>x>=s.minX-.6-r&&x<=s.maxX+.6+r&&z>=s.minZ-1.5-r&&z<=s.maxZ+1.5+r))return true;
  if(layout.rooms.some(s=>x>=s.x1*4-2-r&&x<=s.x2*4+2+r&&z>=s.z1*4-2-r&&z<=s.z2*4+2+r))return true;
  return layout.doors.some(d=>Math.hypot(d.x-x,d.z-z)<2+r);
 };
 const vacant=(x:number,z:number,r:number)=>{
  for(let cx=Math.floor((x-r+2)/4);cx<=Math.floor((x+r+2)/4);cx++)for(let cz=Math.floor((z-r+2)/4);cz<=Math.floor((z+r+2)/4);cz++)if(layout.grid.has(cx+','+cz))return false;
  return true;
 };
 const add=(kind:FoliageKind,x:number,y:number,z:number,salt:number)=>{
  const ix=Math.round(x*100),iz=Math.round(z*100);
  candidates.push({kind,x,y,z,priority:hash(ix,iz,salt),variant:Math.floor(hash(ix,iz,salt+1)*12),yaw:hash(ix,iz,salt+2)*Math.PI*2});
 };
 for(const c of layout.cells)if(c.kind==='field'){
  const sectorX=Math.round(c.x/19)*76,sectorZ=Math.round(c.z/19)*76;
  for(let ix=0;ix<3;ix++)for(let iz=0;iz<3;iz++){
   const hx=c.x*3+ix,hz=c.z*3+iz;
   const x=c.x*4-2+(ix+.5)*4/3+(hash(hx,hz,1)-.5)*.8,z=c.z*4-2+(iz+.5)*4/3+(hash(hx,hz,2)-.5)*.8;
   const patch=hash(Math.floor(x/5),Math.floor(z/5),90);
   if(hash(hx,hz,3)>.06+.18*patch||Math.min(...[-32,-16,0,16,32].flatMap(t=>[Math.abs(x-sectorX-t),Math.abs(z-sectorZ-t)]))<.75||protectedAt(x,z,.1))continue;
   if(nearbyObstacles(obstacles,x-.1,z-.1,x+.1,z+.1).some(o=>x>=o.minX-.1&&x<=o.maxX+.1&&z>=o.minZ-.1&&z<=o.maxZ+.1))continue;
   add('short',x,height(x,z)-.002,z,101);
  }
 }
 if(layout.stage==='outer')for(const w of layout.walls)if(w.kind==='field'&&!w.twoSided&&w.h<2){
  for(let band=0;band<4;band++)for(let i=0;i<8;i++){
   const hx=Math.round(w.x*4)+i,hz=Math.round(w.z*4)+band,salt=w.alongX?411:513;
   const t=-1.75+i*.5+(hash(hx,hz,salt)-.5)*.36,d=.85+band*.5+(hash(hx,hz,salt+1)-.5)*.24;
   const x=w.x+(w.alongX?t:0)-w.insideX*d,z=w.z+(w.alongX?0:t)-w.insideZ*d;
   const patch=hash(Math.floor(x/3),Math.floor(z/3),601);
   if(patch<.62||hash(hx,hz,salt+2)>.8||!vacant(x,z,.45)||protectedAt(x,z,.45)||Math.max(Math.abs(x),Math.abs(z))>219.5)continue;
   add('verge',x,vergeHeight(x,z)-.002,z,701);
  }
 }
 for(const p of layout.paddies){
  const x1=p.x1*4-2,x2=p.x2*4+2,z1=p.z1*4-2,z2=p.z2*4+2;
  for(let x=x1+.7;x<x2-.7;x+=.8)for(let z=z1+.7;z<z2-.7;z+=.8){
   const ix=Math.round(x*10),iz=Math.round(z*10),px=x+(hash(ix,iz,801)-.5)*.25,pz=z+(hash(ix,iz,802)-.5)*.25;
   if(Math.min(px-x1,x2-px,pz-z1,z2-pz)>1.5||hash(ix,iz,803)>.15||protectedAt(px,pz,.35))continue;
   add('reed',px,-.06,pz,901);
  }
 }
 candidates.sort((a,b)=>a.priority-b.priority);const counts={short:0,verge:0,reed:0},buckets=new Map<string,Root[]>(),roots:Root[]=[];
 for(const p of candidates){
  if(counts[p.kind]>=FOLIAGE_LIMITS[p.kind].count)continue;
  const bx=Math.floor(p.x/.22),bz=Math.floor(p.z/.22);let crowded=false;
  for(let x=bx-1;x<=bx+1;x++)for(let z=bz-1;z<=bz+1;z++)if(buckets.get(x+','+z)?.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<.22))crowded=true;
  if(crowded)continue;const key=bx+','+bz;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(p);roots.push(p);counts[p.kind]++;
 }
 return {roots,counts};
}
export function buildFieldFoliage(layout:Layout,seed:number,height:(x:number,z:number)=>number,obstacles:Obstacle[],add:(geometry:THREE.BufferGeometry)=>void,vergeHeight?:(x:number,z:number)=>number){
 const {roots,counts}=fieldFoliageRoots(layout,seed,height,obstacles,vergeHeight),cache=new Map<string,THREE.BufferGeometry>();
 for(const p of roots){const key=p.kind+':'+p.variant;if(!cache.has(key))cache.set(key,makeFoliageGeometry(p.kind,seed^Math.imul(p.variant+1,7331)));const g=cache.get(key)!.clone();g.rotateY(p.yaw);g.translate(p.x,p.y,p.z);add(g);}
 cache.forEach(g=>g.dispose());return counts;
}
