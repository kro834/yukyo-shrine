import * as THREE from 'three';
import type {Cell,Wall,Room} from './shrine-layout.ts';
import {surfaceUV} from './surface-uv.ts';

export const PARALLEL_AREAS={office:'不在の事務棟',hotel:'午前零時のホテル',pool:'閉館後の屋内プール',service:'配管の臓腑',station:'終点のない地下駅',home:'誰かの帰宅を待つ家',arcade:'裏返った商店街',bridge:'宙吊りの渡り場',garden:'空に置き忘れた庭園'} as const;
export type ParallelArea=keyof typeof PARALLEL_AREAS;
export function parallelArea(kind:string):ParallelArea{return ({hall:'office',passage:'office',stone:'hotel',bath:'pool',factory:'service',cistern:'station',shop:'home',yokocho:'arcade',cave:'bridge',field:'garden'} as Record<string,ParallelArea>)[kind]??'office';}
export const PARALLEL_MATERIALS={
 parallelPaint:{color:'#b4b09d',roughness:.94},parallelCarpet:{color:'#a3976d',roughness:1},parallelVelvet:{color:'#594049',roughness:1},
 parallelTiles:{color:'#b6c4bd',roughness:.28},parallelBlue:{color:'#467d82',roughness:.25},parallelCeiling:{color:'#b4b6ad',roughness:.98},
 parallelWindow:{color:'#758797',emissive:'#425465',emissiveIntensity:.14,roughness:.3,metalness:.25},parallelGreen:{color:'#354d38',roughness:1},
} as const;
export type ParallelMaterial=keyof typeof PARALLEL_MATERIALS|'concrete'|'steel'|'black'|'gold'|'planks'|'wood'|'glass'|'coolLight'|'water'|'earth'|'light'|'pottery';
export type ParallelAdd=(g:THREE.BufferGeometry,m:ParallelMaterial)=>void;
export type ParallelFixture=(x:number,y:number,z:number,color:string)=>void;
const put=(add:ParallelAdd,x:number,y:number,z:number,w:number,h:number,d:number,m:ParallelMaterial)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
function rod(add:ParallelAdd,a:THREE.Vector3,b:THREE.Vector3,r:number,m:ParallelMaterial){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);}
export function parallelHeight(kind:string){const a=parallelArea(kind);return a==='pool'||a==='station'?4.1:a==='office'?2.95:a==='service'?3.3:a==='home'?3.25:3.7;}
export const parallelOpen=(kind:string)=>['bridge','garden'].includes(parallelArea(kind));

function vault(add:ParallelAdd,x:number,z:number,alongX:boolean,base:number,material:ParallelMaterial){
 const p:number[]=[],uv:number[]=[],idx:number[]=[];
 for(let row=0;row<2;row++)for(let j=0;j<=16;j++){const a=j/16*Math.PI,t=Math.cos(a)*2,y=base+Math.sin(a)*1.22;p.push(x+(alongX?(row?2:-2):t),y,z+(alongX?t:(row?2:-2)));uv.push(a*2,(row?4:0));}
 for(let j=0;j<16;j++){const a=j,b=j+17;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.userData.surfaceUV='authored';add(g,material);
}
/** Architectural shells share the original floor footprint and keep overhead work above 2.4 m. */
export function buildParallelCell(c:Cell,grid:Map<string,Cell>,add:ParallelAdd,fixture:ParallelFixture,floor=0){
 const a=parallelArea(c.kind),x=c.x*4,z=c.z*4,h=parallelHeight(c.kind),ew=grid.has((c.x+1)+','+c.z)&&grid.has((c.x-1)+','+c.z),p=(dx:number,y:number,dz:number,w:number,hh:number,d:number,m:ParallelMaterial)=>put(add,x+dx,floor+y,z+dz,w,hh,d,m);
 const finish:ParallelMaterial=a==='office'?'parallelCarpet':a==='hotel'?'parallelVelvet':a==='pool'||a==='station'?'parallelTiles':a==='home'?'planks':a==='garden'?'earth':'concrete';
 p(0,-.18,0,4,.36,4,finish);
 if(a==='bridge'||a==='garden'){
  p(0,-.48,0,3.8,.23,3.8,'concrete');
  if(a==='bridge'){for(const side of [-1,1])rod(add,new THREE.Vector3(x+(ew?-2:side*1.55),floor-.6,z+(ew?side*1.55:-2)),new THREE.Vector3(x+(ew?2:side*1.55),floor-1.6,z+(ew?side*1.55:2)),.055,'steel');p(0,.005,0,ew?4:1.9,.01,ew?1.9:4,'parallelTiles');}
  if(a==='garden'){p(0,.01,0,ew?4:1.7,.02,ew?1.7:4,'parallelTiles');if((c.x+c.z)%6===0){p(1.5,.65,1.5,.09,1.3,.09,'steel');p(1.5,1.4,1.5,.2,.28,.2,'light');fixture(x+1.5,floor+1.45,z+1.5,'#e0ccaa');}}
  return;
 }
 if(a==='pool'||a==='station'){vault(add,x,z,ew,floor+2.85,'parallelTiles');p(0,h+.16,0,4,.24,4,'concrete');}
 else p(0,h+.08,0,4,.16,4,a==='office'?'parallelCeiling':a==='service'?'concrete':'parallelPaint');
 if(a==='office'){
  for(let t=-2;t<=2;t+=.8){p(t,h-.01,0,.018,.028,4,'steel');p(0,h-.01,t,4,.028,.018,'steel');}
  if((c.x+c.z)%3===0){p(0,h-.08,0,1.52,.08,.62,'steel');p(0,h-.13,0,1.42,.025,.52,'coolLight');fixture(x,floor+h-.20,z,'#c3d0b1');}
 }else if(a==='service'){
  for(const side of [-1,1]){rod(add,new THREE.Vector3(x+(ew?-2:side*.95),floor+2.70,z+(ew?side*.95:-2)),new THREE.Vector3(x+(ew?2:side*.95),floor+2.70,z+(ew?side*.95:2)),.10,side<0?'steel':'parallelBlue');}
  p(0,2.90,0,ew?4:.65,.24,ew?.65:4,'steel');
  if((c.x+c.z)%4===0){p(0,2.48,0,.3,.12,.3,'light');fixture(x,floor+2.39,z,'#d0b280');}
 }else if((c.x+c.z)%4===0){
  p(0,h-.22,0,a==='home'?.5:1.45,.12,.24,'steel');p(0,h-.31,0,a==='home'?.44:1.34,.03,.18,a==='hotel'?'light':'coolLight');fixture(x,floor+h-.40,z,a==='hotel'||a==='home'?'#e0bea0':a==='pool'?'#a6d4ce':'#b6c6ce');
 }
}

/** All cladding is behind the original collision face; no decorative pillar narrows the route. */
export function buildParallelWall(w:Wall,kind:string,add:ParallelAdd,floor=0){
 const a=parallelArea(kind),h=parallelHeight(kind),open=parallelOpen(kind)&&!w.twoSided;
 const p=(t:number,y:number,u:number,width:number,height:number,depth:number,m:ParallelMaterial)=>put(add,w.x+(w.alongX?t:w.insideX*u),floor+y,w.z+(w.alongX?w.insideZ*u:t),w.alongX?width:depth,height,w.alongX?depth:width,m);
 if(open){
  p(0,.12,0,4,.24,.30,'concrete');p(0,1.1,0,4,.07,.08,'steel');
  for(const t of [-1.93,-.65,.65,1.93])p(t,.59,0,.05,1.1,.05,'steel');
  for(const y of [.38,.68])p(0,y,0,4,.025,.025,'steel');return;
 }
 p(0,h/2,-.01,4,h,.28,a==='pool'||a==='station'?'parallelTiles':a==='service'?'concrete':'parallelPaint');
 p(0,.07,.155,4,.14,.025,a==='hotel'?'gold':'steel');
 if(a==='office'){
  p(0,1.3,.16,4,.035,.026,'parallelBlue');
  for(const t of [-1.9,1.9])p(t,1.5,.16,.025,2.8,.03,'steel');
  if(Math.abs(Math.round(w.x+w.z))%12===0){p(.8,1.85,.16,1.45,1.4,.04,'parallelWindow');for(const t of [.08,.8,1.52])p(t,1.85,.19,.028,1.45,.035,'steel');}
 }else if(a==='hotel'){
  p(0,.65,.16,4,1.15,.04,'parallelVelvet');
  for(const y of [.18,1.23,2.97])p(0,y,.185,4,.04,.035,'gold');
  for(const t of [-1.6,1.6]){p(t,1.9,.17,.03,1.35,.02,'gold');}p(0,2.58,.17,3.23,.03,.02,'gold');
 }else if(a==='pool'||a==='station'){
  p(0,1.23,.15,4,.22,.035,'parallelBlue');p(0,.32,.15,4,.055,.035,'parallelBlue');
  if(a==='station')for(const t of [-1.9,1.9])p(t,1.6,.17,.12,3.2,.10,'steel');
 }else if(a==='service'){
  if(Math.abs(Math.round(w.x+w.z))%8===0){p(.9,1.5,.14,1.08,1.62,.10,'steel');p(.9,1.5,.20,.85,1.4,.04,'parallelPaint');for(const y of [1.10,1.45,1.8])p(.9,y,.225,.60,.025,.025,'black');}
 }else if(a==='home'){
  p(0,1.9,.15,1.85,1.4,.03,'parallelWindow');
  for(const t of [-.95,0,.95])p(t,1.9,.19,.05,1.5,.045,'parallelPaint');for(const y of [1.17,2.64])p(0,y,.18,2,.05,.065,'parallelPaint');p(0,1.14,.22,2.1,.07,.12,'parallelPaint');
 }else if(a==='arcade'){
  p(0,1.40,.14,3.60,2.65,.035,'steel');for(let y=.18;y<2.65;y+=.14)p(0,y,.178,3.62,.018,.018,'parallelPaint');p(0,3.05,.13,3.7,.42,.08,'parallelBlue');
 }else {p(0,1.25,.15,4,.18,.04,'parallelBlue');}
}

export function assignParallelRooms(rooms:Room[],grid:Map<string,Cell>){for(const r of rooms){const c=grid.get(Math.round((r.x1+r.x2)/2)+','+Math.round((r.z1+r.z2)/2));r.themeId='parallel-'+parallelArea(c?.kind??'hall');r.style='stone';r.h=parallelHeight(c?.kind??'hall');}}
export function buildParallelRoom(room:Room,add:ParallelAdd,block:(x:number,z:number,w:number,d:number,h?:number)=>void,reserved=false){
 if(reserved)return;
 const a=room.themeId?.slice(9) as ParallelArea,cx=(room.x1+room.x2)*2,cz=(room.z1+room.z2)*2,dx=(room.x2-room.x1+1)*2-1.7,dz=(room.z2-room.z1+1)*2-1.7;
 for(const side of [-1,1]){
  const x=cx+side*dx,z=cz+side*dz,p=(xx:number,y:number,zz:number,w:number,h:number,d:number,m:ParallelMaterial)=>put(add,x+xx,y,z+zz,w,h,d,m);
  if(a==='office'){p(0,.73,0,2.1,.07,1,'parallelPaint');for(const xx of [-.9,.9])p(xx,.35,0,.07,.7,.7,'steel');p(0,1.12,.15,.64,.43,.06,'black');p(0,.91,.12,.04,.1,.04,'steel');p(0,.83,-.15,.6,.02,.21,'steel');block(x,z,2.15,1.1,.85);}
  else if(a==='pool'){p(0,.27,0,2.4,.54,2.2,'parallelTiles');p(0,.55,0,2.06,.01,1.86,'water');for(const y of [.17,.32,.48])p(-.4,y,-1.18,1.4,.15,.18,'parallelTiles');block(x,z,2.5,2.5,.6);}
  else if(a==='home'||a==='hotel'){p(0,.22,0,2.3,.44,.86,'parallelVelvet');p(0,.73,.36,2.3,.62,.16,'parallelVelvet');for(const xx of [-1.05,1.05])p(xx,.57,0,.20,.60,1,'parallelVelvet');block(x,z,2.4,1.1,1.1);}
  else if(a==='garden'){p(0,.30,0,2.6,.6,2.6,'concrete');p(0,.61,0,2.4,.02,2.4,'earth');for(let i=0;i<4;i++){const g=new THREE.IcosahedronGeometry(.51,1);g.scale(1,1.5,.8);g.translate(x+Math.sin(i*2)*.6,1.2+(i%2)*.3,z+Math.cos(i*2)*.6);add(g,'parallelGreen');}block(x,z,2.7,2.7,2.1);}
  else if(a==='service'||a==='station'){p(0,1.1,0,1.6,2.2,.8,'steel');for(let y=.35;y<1.9;y+=.35)p(0,y,-.415,1.3,.05,.025,'black');block(x,z,1.7,.9,2.3);}
  else if(a==='arcade'){p(0,1.05,0,2.6,2.1,.5,'steel');for(const y of [.3,.9,1.5])p(0,y,-.2,2.4,.04,.6,'parallelPaint');block(x,z,2.7,.9,2.2);}
 }
}

/** Suspended concrete slabs, displaced window fragments and houses outside circulation. */
export function buildParallelSkyline(add:ParallelAdd,seed:number){
 for(let i=0;i<22;i++){
  const a=i*2.399+seed*.03,r=150+(i%4)*19,x=Math.cos(a)*r,z=Math.sin(a)*r,y=19+(i%5)*12,w=8+(i%3)*4;
  const group=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler((i%3-1)*.22,a,(i%4-2)*.17)),new THREE.Vector3(1,1,1));
  const box=(xx:number,yy:number,zz:number,ww:number,hh:number,dd:number,m:ParallelMaterial)=>add(new THREE.BoxGeometry(ww,hh,dd).translate(xx,yy,zz).applyMatrix4(group),m);
  box(0,0,0,w,.5,7,'concrete');box(0,2,3.4,w,4,.2,'parallelPaint');box(-w/2,2,0,.2,4,7,'parallelPaint');box(w/2,2,0,.2,4,7,'parallelPaint');box(0,4.12,0,w+.2,.24,7.2,'steel');
  for(const xx of [-w*.28,w*.28])box(xx,2,3.26,2.4,1.4,.03,'parallelWindow');
 }
}

export function parallelTextureUV(g:THREE.BufferGeometry,m:string){if(!m.startsWith('parallel')||g.userData.surfaceUV==='authored')return;surfaceUV(g,m==='parallelCarpet'||m==='parallelVelvet'?1/.6:m==='parallelTiles'?1/1.9:.5);g.userData.surfaceUV='authored';}
