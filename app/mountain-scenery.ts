import * as THREE from 'three';
import type {Cell,Room,Wall} from './shrine-layout.ts';
import type {CircusPlan} from './circus-types.ts';
import {mountainArea,mountainOutdoor} from './mountain-plan.ts';
import {surfaceUV} from './surface-uv.ts';
type Mat='rock'|'earth'|'concrete'|'concreteWall'|'steel'|'rust'|'wood'|'planks'|'roofMetal'|'light'|'coolLight'|'gold'|'water'|'black';
export type MountainAdd=(g:THREE.BufferGeometry,m:Mat)=>void;
type Fixture=(x:number,y:number,z:number,color:string)=>void;
const box=(add:MountainAdd,x:number,y:number,z:number,w:number,h:number,d:number,m:Mat)=>add(new THREE.BoxGeometry(w,h,d,1,1,Math.max(1,Math.ceil(d/2))).translate(x,y,z),m);
function rod(add:MountainAdd,a:THREE.Vector3,b:THREE.Vector3,r:number,m:Mat){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);}
export function buildMountainCell(c:Cell,grid:Map<string,Cell>,add:MountainAdd,fixture:Fixture){
 const x=c.x*4,z=c.z*4,a=mountainArea(c),open=mountainOutdoor(c),ew=grid.has((c.x+1)+','+c.z)&&grid.has((c.x-1)+','+c.z);
 box(add,x,-.19,z,4,.38,4,a==='shelter'?'planks':open?'earth':'concrete');
 if(open){
  box(add,x,-.045,z,ew?4:2.3,.07,ew?2.3:4,'concrete');
  if((c.x+c.z)%6===0){box(add,x+1.55,.64,z+1.55,.10,1.28,.10,'steel');box(add,x+1.55,1.32,z+1.55,.22,.17,.20,'coolLight');fixture(x+1.55,1.25,z+1.55,'#a7bdc2');}
  return;
 }
 if(a==='mine'||a==='reservoir'){
  // A closed backing joins vaults at four-way intersections.
  box(add,x,3.96,z,4,.24,4,'rock');
  // Irregular rock vault with structural steel ribs, no flat wooden ceiling.
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let row=0;row<3;row++)for(let j=0;j<=14;j++){const angle=j/14*Math.PI,t=Math.cos(angle)*2,y=2.35+Math.sin(angle)*1.45+Math.sin(j*2.7+c.x*.6+c.z*.9)*.09;pos.push(x+(ew?row*2-2:t),y,z+(ew?t:row*2-2));uv.push(angle*1.6,row*1.5);}
  for(let row=0;row<2;row++)for(let j=0;j<14;j++){const i=row*15+j;idx.push(i,i+15,i+1,i+1,i+15,i+16);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add(g,'rock');
  if((c.x+c.z)%2===0){const path=[];for(let j=0;j<=20;j++){const angle=j/20*Math.PI;path.push(new THREE.Vector3(x+(ew?0:Math.cos(angle)*1.84),2.28+Math.sin(angle)*1.40,z+(ew?Math.cos(angle)*1.84:0)));}add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),24,.065,6,false),'rust');for(const side of [-1,1])box(add,x+(ew?0:side*1.84),1.14,z+(ew?side*1.84:0),.10,2.28,.10,'rust');}
  if((c.x+c.z)%5===0){box(add,x,2.96,z,.36,.13,.26,'steel');box(add,x,2.85,z,.23,.06,.18,'light');fixture(x,2.75,z,'#c6af83');}
 }else{
  box(add,x,3.90,z,4,.22,4,'roofMetal');
  if((c.x+c.z)%4===0){box(add,x,3.35,z,.6,.16,.32,'steel');box(add,x,3.23,z,.48,.04,.24,'light');fixture(x,3.12,z,'#cdbfaa');}
 }
}
export function buildMountainWall(w:Wall,kind:string,add:MountainAdd){
 const c={kind,x:Math.round((w.x+w.insideX*2)/4),z:Math.round((w.z+w.insideZ*2)/4)},open=mountainOutdoor(c)&&!w.twoSided,a=mountainArea(c);
 const p=(t:number,y:number,u:number,ww:number,h:number,d:number,m:Mat)=>box(add,w.x+(w.alongX?t:w.insideX*u),y,w.z+(w.alongX?w.insideZ*u:t),w.alongX?ww:d,h,w.alongX?d:ww,m);
 if(open){p(0,.13,0,4,.26,.3,'rock');for(const t of [-1.93,0,1.93])p(t,.62,0,.07,1.24,.07,'steel');for(const y of [.45,.8,1.2])p(0,y,0,4,.03,.04,'rust');return;}
 p(0,1.92,-.08,4,3.84,.46,a==='mine'||a==='reservoir'?'rock':'concreteWall');
 if(a==='shelter'||a==='ore'){p(0,.5,.17,4,1,.06,'roofMetal');for(const t of [-1.6,-.8,0,.8,1.6])p(t,.52,.22,.026,.95,.025,'steel');p(0,2.05,.17,2.3,1.2,.04,'black');for(const t of [-1.17,0,1.17])p(t,2.05,.21,.04,1.3,.06,'rust');for(const y of [1.4,2.7])p(0,y,.21,2.4,.06,.06,'steel');}
 else if(Math.round(w.x+w.z)%8===0){p(0,.31,.20,4,.07,.07,'rust');p(0,2.45,.2,4,.045,.045,'black');}
}
export function buildMountainRoom(r:Room,add:MountainAdd,block:(x:number,z:number,w:number,d:number,h?:number)=>void,reserved:boolean){
 if(reserved)return;const a=r.themeId?.slice(9),x=(r.x1+r.x2)*2+(r.x2-r.x1+1)*2-1.6,z=(r.z1+r.z2)*2+(r.z2-r.z1+1)*2-1.6;
 if(a==='ridge'||a==='guide'||a==='summit')return;
 if(a==='shelter'){box(add,x,.30,z,2.3,.6,1.1,'wood');box(add,x,.65,z,2.2,.12,1,'planks');block(x,z,2.4,1.2,.8);}
 else{for(const dx of [-.45,.45]){box(add,x+dx,.43,z,.8,.86,.85,'rust');box(add,x+dx,.88,z,.83,.06,.88,'steel');}block(x,z,1.9,1.1,1);}
}
export function buildMountainRail(plan:CircusPlan,add:MountainAdd,fixture:Fixture){
 const points=plan.track;
 for(let i=0;i<points.length;i+=2){const a=points[i],b=points[(i+2)%points.length],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(!l)continue;
  const nx=-dz/l,nz=dx/l;
  for(const side of [-1,1])rod(add,new THREE.Vector3(a.x+nx*.41*side,.075,a.z+nz*.41*side),new THREE.Vector3(b.x+nx*.41*side,.075,b.z+nz*.41*side),.026,'steel');
  const sleeper=new THREE.BoxGeometry(1.25,.07,.16).rotateY(Math.atan2(dx,dz)).translate(a.x,.014,a.z);add(sleeper,'wood');
 }
 for(const s of plan.stations){const x=s.exit.x,z=s.exit.z;box(add,x,.01,z,.55,.02,3,'gold');box(add,x,1.1,z+2,.08,2.2,.08,'steel');box(add,x,2.27,z+2,.40,.24,.3,'coolLight');fixture(x,2.12,z+2,'#b5cace');}
}
export function buildMountainLandscape(grid:Map<string,Cell>,add:MountainAdd,seed:number){
 const n=110,step=4,positions:number[]=[],uv:number[]=[],indices:number[]=[];
 const occupied=(x:number,z:number)=>grid.has(Math.round(x/4)+','+Math.round(z/4));
 for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
  const x=(ix-n/2)*step,z=(iz-n/2)*step;let clearance=0;
  for(let radius=0;radius<=24;radius+=4){if([[0,1],[0,-1],[1,0],[-1,0],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]].some(([dx,dz])=>occupied(x+dx*radius,z+dz*radius)))break;clearance=radius;}
  const wave=Math.sin(x*.041+seed)*Math.cos(z*.036)+.45*Math.sin(x*.096+z*.073)+.20*Math.cos(x*.23-z*.19),edge=Math.min(1,clearance/16);
  positions.push(x,-.4+edge*(-10+wave*18),z);uv.push(x/2.7,z/2.7);
 }
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const a=iz*(n+1)+ix;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceUV='authored';add(g,'rock');
 // Close crags occupy only voids. Radius tests keep every path and room clear.
 for(let x=-188;x<=188;x+=8)for(let z=-188;z<=188;z+=8){
  if(Math.abs(Math.sin(x*1.17+z*.39+seed))<.86)continue;
  if(Array.from({length:16},(_,i)=>i*Math.PI/8).some(a=>occupied(x+Math.cos(a)*5,z+Math.sin(a)*5))||occupied(x,z))continue;
  const h=8+9*(.5+.5*Math.sin(x*.1-z*.17)),crag=new THREE.IcosahedronGeometry(1,1);crag.scale(3.25,h/2,3.25);crag.rotateY(x*.07+z*.1);crag.translate(x,h/2-2.5,z);surfaceUV(crag,.37);add(crag,'rock');
 }
 // A continuous fractured ridgeline avoids isolated cone-shaped mountains.
 const ridgeP:number[]=[],ridgeUV:number[]=[],ridgeI:number[]=[],angles=256,rings=12;
 for(let r=0;r<=rings;r++)for(let j=0;j<=angles;j++){
  const a=j/angles*Math.PI*2,rr=192+r*13;
  const profile=Math.sin(Math.PI*r/rings)**1.5;
  const peaks=75+25*Math.sin(a*5+.8)+17*Math.sin(a*11+seed*.1)+8*Math.sin(a*23+2);
  const fracture=Math.sin(a*37+r*1.8)*2.3+Math.cos(a*53-r*.6)*1.4;
  const radius=rr+Math.sin(a*7)*8*Math.sin(Math.PI*r/rings);
  ridgeP.push(Math.cos(a)*radius,-15+profile*peaks+fracture*profile,Math.sin(a)*radius);ridgeUV.push(a*80,r*5);
 }
 for(let r=0;r<rings;r++)for(let j=0;j<angles;j++){const i=r*(angles+1)+j;ridgeI.push(i,i+1,i+angles+1,i+1,i+angles+2,i+angles+1);}
 const ridge=new THREE.BufferGeometry();ridge.setAttribute('position',new THREE.Float32BufferAttribute(ridgeP,3));ridge.setAttribute('uv',new THREE.Float32BufferAttribute(ridgeUV,2));ridge.setIndex(ridgeI);ridge.computeVertexNormals();ridge.userData.surfaceUV='authored';add(ridge,'rock');
}
