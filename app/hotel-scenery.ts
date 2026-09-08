import * as THREE from 'three';
import type {Cell,Room,Wall} from './shrine-layout.ts';
import {chamferedBox} from './chamfered-box.ts';
import {hotelArea,hotelRoomHeight,hotelShaftCell,HOTEL_LIFT,type HotelRoom} from './hotel-layout.ts';
import type {HotelElevator} from './hotel-elevator.ts';
import {surfaceUV} from './surface-uv.ts';

export const HOTEL_MATERIALS={hotelLampShade:{color:'#d2b99a',emissive:'#bf8851',emissiveIntensity:.32,roughness:1,side:THREE.DoubleSide},hotelLinen:{color:'#d1cfc3',roughness:.96,side:THREE.DoubleSide},hotelOak:{color:'#51463b',roughness:.55},hotelLeather:{color:'#282a28',roughness:.54},hotelBrass:{color:'#95876b',roughness:.48,metalness:.8},hotelShade:{color:'#b7ada0',roughness:1},hotelPorcelain:{color:'#c5c4bc',roughness:.22},hotelGlass:{color:'#121920',roughness:.30,metalness:.12}} as const;
type Mat=keyof typeof HOTEL_MATERIALS|'parallelPaint'|'parallelCarpet'|'parallelVelvet'|'parallelTiles'|'parallelCeiling'|'parallelGreen'|'steel'|'black'|'light'|'coolLight'|'concrete'|'earth'|'planks'|'water';
export type HotelAdd=(g:THREE.BufferGeometry,m:Mat)=>void;
export type HotelFixture=(x:number,y:number,z:number,color:string)=>void;
export type HotelBed={x:number;z:number;yaw:number;width:number};
const box=(add:HotelAdd,x:number,y:number,z:number,w:number,h:number,d:number,m:Mat,round=0)=>add((round?chamferedBox(w,h,d,round):new THREE.BoxGeometry(w,h,d)).translate(x,y,z),m);
export function hotelTextureUV(g:THREE.BufferGeometry,m:string){if(!m.startsWith('hotel')||g.userData.surfaceUV==='authored')return;surfaceUV(g,m==='hotelLinen'?3.5:m==='hotelOak'?.35:1);g.userData.surfaceUV='authored';}
export function hotelLamp(add:HotelAdd,x:number,y:number,z:number,fixture:HotelFixture,floor=0){
 box(add,x,y+.015,z,.23,.03,.23,'hotelBrass',.01);box(add,x,y+.24,z,.028,.45,.028,'hotelBrass');
 const shade=new THREE.CylinderGeometry(.18,.24,.33,24,1,true).translate(x,y+.50,z);add(shade,'hotelLampShade');
 add(new THREE.SphereGeometry(.047,10,8).translate(x,y+.46,z),'light');
 fixture(x,y+.35,z-.12,'#e5b786');
}
export function buildHotelCell(c:Cell,grid:Map<string,Cell>,add:HotelAdd,fixture:HotelFixture,floor=0,skipFloor=false,skipCeiling=false){
 const a=hotelArea(c.kind),x=c.x*4,z=c.z*4,h=hotelRoomHeight(c.kind),shaft=hotelShaftCell(c),hard=['lobby','spa','kitchen','service','atrium'].includes(a),floorMat:Mat=hard?'parallelTiles':a==='executive'?'parallelVelvet':'parallelCarpet';
 const p=(dx:number,y:number,dz:number,w:number,hh:number,d:number,m:Mat)=>box(add,x+dx,floor+y,z+dz,w,hh,d,m);
 const ring=(y:number,m:Mat)=>{for(const sign of [-1,1]){p(sign*1.8,y,0,.4,.20,4,m);p(0,y,sign*1.8,3.2,.20,.4,m);}};
 if(!skipFloor){if(shaft&&floor>0)ring(-.10,floorMat);else p(0,-.10,0,4,.20,4,floorMat);}
 if(!skipCeiling){if(shaft)ring(h+.10,'parallelCeiling');else p(0,h+.10,0,4,.20,4,'parallelCeiling');}
 if(shaft)return;
 // The photographed tile/grout and carpet provide their own continuous pattern.
 if(a==='atrium'){
  for(const t of [-1.92,0,1.92])p(t,h-.06,0,.045,.09,4,'hotelBrass');
  p(0,h-.005,0,3.9,.025,3.9,'hotelGlass');
 }
 const service=a==='service'||a==='kitchen'||a==='archive';
 if((c.x*3+c.z*5)%5===0&&!skipCeiling){
  p(0,h-.035,0,service?1.2:.14,.06,service?.19:.14,'hotelBrass');p(0,h-.07,0,service?1.1:.07,.018,service?.10:.07,service?'coolLight':'light');
  fixture(x,floor+h-.17,z,service?'#b3c2bc':'#d8bfa3');
 }
}

export function buildHotelWall(w:Wall,kind:string,add:HotelAdd,fixture:HotelFixture,floor=0){
 const a=hotelArea(kind),h=Math.max(hotelRoomHeight(kind),w.h>=8?9.2:0),p=(t:number,y:number,u:number,ww:number,hh:number,d:number,m:Mat)=>box(add,w.x+(w.alongX?t:w.insideX*u),floor+y,w.z+(w.alongX?w.insideZ*u:t),w.alongX?ww:d,hh,w.alongX?d:ww,m);
 p(0,h/2,0,4,h,.27,'parallelPaint');p(0,.07,.147,4,.14,.025,'hotelOak');
 p(0,h-.065,.16,4,.055,.045,'hotelShade');
 if(a==='lobby'||a==='executive'||a==='guest'){
  p(0,.54,.145,4,.88,.025,'hotelOak');
  for(const t of [-1.85,-.62,.62,1.85])p(t,.54,.17,.025,.88,.019,'hotelBrass');p(0,1.01,.17,4,.035,.035,'hotelBrass');
 }
 if(a==='spa'||a==='kitchen'||a==='service'){p(0,1.18,.15,4,2.25,.025,'parallelTiles');p(0,1.35,.18,4,.08,.02,'hotelOak');return;}
 const n=Math.abs(Math.round(w.x*.5+w.z*.5));
 if(!w.twoSided&&n%5===0){
  // Deep window reveals and parted pleated curtains stop the facade looking flat.
  p(0,1.98,.15,2.25,1.5,.04,'hotelGlass');
  for(const t of [-1.16,0,1.16])p(t,1.98,.20,.05,1.62,.10,'hotelBrass');
  for(const yy of [1.18,2.78])p(0,yy,.20,2.42,.07,.13,'hotelShade');
  for(const side of [-1,1]){
   const positions:number[]=[],uv:number[]=[],indices:number[]=[],cols=28,rows=16;
   for(let iy=0;iy<=rows;iy++)for(let ix=0;ix<=cols;ix++){
    const u=ix/cols,q=iy/rows,t=side*(.98+u*.56+.03*Math.sin(q*Math.PI)),yy=.35+q*2.53,depth=.29+Math.sin(u*Math.PI*12+Math.sin(q*2)*.13)*(.042+.023*(1-q));
    positions.push(w.x+(w.alongX?t:w.insideX*depth),floor+yy,w.z+(w.alongX?w.insideZ*depth:t));uv.push(u*.56/.27,q*2.53/.27);
   }
   for(let iy=0;iy<rows;iy++)for(let ix=0;ix<cols;ix++){const i=iy*(cols+1)+ix;indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}
   const curtain=new THREE.BufferGeometry();curtain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));curtain.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));curtain.setIndex(indices);curtain.computeVertexNormals();curtain.userData.surfaceUV='authored';add(curtain,'hotelLinen');
  }
  for(let i=0;i<9;i++){const t=Math.sin(i*7+n)*1.03;p(t,1.7+(i%4)*.23,.182,.005,.10+(i%3)*.06,.003,'hotelShade');}
  fixture(w.x+w.insideX*.55,floor+2.12,w.z+w.insideZ*.55,'#91a8bf');
 }else if(n%4===0){
  p(0,1.76,.19,.22,.44,.06,'hotelBrass');p(0,1.79,.30,.34,.43,.18,'hotelLampShade');p(0,1.56,.3,.22,.018,.11,'light');
  fixture(w.x+w.insideX*.48,floor+1.62,w.z+w.insideZ*.48,'#d9b184');
 }else if(n%3===0){
  p(0,1.86,.15,1.32,.94,.032,'hotelOak');p(0,1.86,.174,1.20,.82,.014,'hotelShade');p(0,1.86,.185,1.02,.64,.012,'hotelGlass');
 }
}

export function hotelSofa(add:HotelAdd,x:number,y:number,z:number,w=1.8){
 box(add,x,y+.25,z,w,.4,.79,'hotelLeather',.075);box(add,x,y+.66,z+.32,w,.56,.16,'hotelLeather',.06);
 for(const s of [-1,1]){box(add,x+s*(w/2-.07),y+.49,z,.14,.37,.86,'hotelLeather',.05);box(add,x+s*w*.23,y+.48,z-.025,w*.40,.08,.58,'hotelLeather',.035);}
}
export function buildHotelRoom(r:Room,add:HotelAdd,fixture:HotelFixture,block:(x:number,z:number,w:number,d:number,h?:number)=>void,beds:HotelBed[],reserved:boolean){
 if(reserved)return;const type=r.themeId?.slice(6) as HotelRoom,cx=(r.x1+r.x2)*2,cz=(r.z1+r.z2)*2,hx=(r.x2-r.x1+1)*2,hz=(r.z2-r.z1+1)*2;
 const p=(x:number,y:number,z:number,w:number,h:number,d:number,m:Mat,round=0)=>box(add,x,y,z,w,h,d,m,round),x=cx-hx+2.1,z=cz-hz+2.0;
 if(['single','double','twin','suite','executive','penthouse'].includes(type)){
  const width=type==='single'||type==='twin'?1.05:1.65,sites=type==='twin'?[x,x+2.7]:[x];
  for(const bx of sites){beds.push({x:bx,z,yaw:0,width});block(bx,z,width+.25,2.45,1.13);p(bx,1.0,z-1.09,width+.22,1.2,.12,'hotelOak',.035);
   const tx=bx+width/2+.52;p(tx,.28,z-.65,.7,.56,.65,'hotelOak',.025);hotelLamp(add,tx,.56,z-.65,fixture);block(tx,z-.65,.75,.72,.57);
  }
  const deskX=cx+hx-2,deskZ=cz+hz-1.25;p(deskX,.73,deskZ,2.5,.065,.74,'hotelOak',.018);for(const sign of [-1,1])p(deskX+sign*1.07,.35,deskZ,.07,.7,.60,'hotelBrass');p(deskX,.98,deskZ+.17,.85,.50,.055,'black');block(deskX,deskZ,2.6,.82,1.4);
  if(type==='suite'||type==='executive'||type==='penthouse'){hotelSofa(add,cx+hx-2,0,cz-hz+2.5,2.3);block(cx+hx-2,cz-hz+2.5,2.4,1,1);}
 }else if(['restaurant','bar','breakfast','lounge','lobby','cloak'].includes(type)){
  for(const side of [-1,1]){const bx=cx+side*(hx-2.2),bz=cz+side*(hz-2);hotelSofa(add,bx,0,bz,2.4);block(bx,bz,2.5,1,1);p(bx,.40,bz-1.3,1.45,.065,.65,'hotelOak',.03);p(bx,.19,bz-1.3,.08,.38,.40,'hotelBrass');block(bx,bz-1.3,1.5,.70,.5);hotelLamp(add,bx-.42,.44,bz-1.3,fixture);}
  if(type==='lobby'||type==='bar'){p(x,.58,z,3.4,1.16,.9,'hotelOak',.03);p(x,1.19,z,3.5,.06,1,'hotelPorcelain');block(x,z,3.6,1.1,1.3);}
 }else if(type==='bath'||type==='spa'){
  p(x,.3,z,2.3,.6,1.5,'hotelPorcelain',.12);p(x,.61,z,1.9,.018,1.12,'hotelGlass',.05);block(x,z,2.5,1.7,.8);
  p(cx+hx-1.25,.83,cz+hz-1.5,1.6,.16,.85,'hotelPorcelain',.05);p(cx+hx-1.25,1.63,cz+hz-1.13,1.5,1.35,.035,'hotelGlass');block(cx+hx-1.25,cz+hz-1.5,1.8,.95,2.4);
 }else if(type==='atrium'||type==='conservatory'){
  for(const side of [-1,1]){const bx=cx+side*(hx-1.7),bz=cz+side*(hz-1.7);p(bx,.25,bz,2.2,.5,2.2,'hotelOak');p(bx,.51,bz,2,.02,2,'earth');for(let i=0;i<9;i++){const g=new THREE.SphereGeometry(.3,10,8).scale(.5,2.5,.16).rotateZ(Math.sin(i*3)*.7).rotateY(i*2).translate(bx+Math.sin(i*2)*.4,1.05,bz+Math.cos(i*2)*.4);add(g,'parallelGreen');}block(bx,bz,2.3,2.3,1.9);}
 }else{
  for(const side of [-1,1]){const bx=cx+side*(hx-1.5),bz=cz+side*(hz-1.5);p(bx,1.0,bz,2.2,2,.6,type==='linen'||type==='archive'?'hotelOak':'steel');for(const y of [.4,1,1.6]){p(bx,y,bz-.2,2.1,.045,.85,'hotelShade');for(const dx of [-.65,0,.65])p(bx+dx,y+.18,bz-.18,.55,.30,.45,type==='linen'||type==='laundry'?'hotelLinen':'hotelPorcelain',.025);}block(bx,bz,2.3,1,2.1);}
 }
}

export function createHotelElevatorMeshes(scene:THREE.Scene,mats:Record<Mat,THREE.MeshStandardMaterial>,runtime:HotelElevator){
 const root=new THREE.Group(),cab=new THREE.Group(),panels:THREE.Mesh[][]=[];root.name='hotel-elevator';root.position.set(HOTEL_LIFT.x,0,HOTEL_LIFT.z);root.add(cab);scene.add(root);
 const put=(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:Mat)=>{const g=new THREE.BoxGeometry(w,h,d);surfaceUV(g,.5);const o=new THREE.Mesh(g,mats[m]);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 put(cab,0,-.065,0,2.7,.13,2.7,'parallelTiles');put(cab,0,2.65,0,2.7,.12,2.7,'hotelOak');
 put(cab,0,1.3,-1.35,2.8,2.6,.12,'hotelGlass');for(const side of [-1,1]){put(cab,side*1.35,1.3,0,.12,2.6,2.8,'hotelOak');put(cab,side*1.23,1.06,0,.055,.055,2.5,'hotelBrass');}
 put(cab,0,2.57,0,.82,.025,.64,'coolLight');const light=new THREE.PointLight('#d5b995',3.4,5,2);light.position.set(0,2.38,0);cab.add(light);
 for(const floor of HOTEL_LIFT.floors){const level:THREE.Mesh[]=[];
  for(const side of [-1,1]){put(root,side*1.48,floor+1.5,0,.14,3.0,3.15,'hotelOak');const leaf=put(root,side*.675,floor+1.28,1.38,1.34,2.56,.09,'hotelBrass');level.push(leaf);}
  put(root,0,floor+2.7,1.38,3.12,.24,.12,'hotelOak');put(root,1.65,floor+1.22,1.40,.12,.23,.065,'hotelBrass');put(root,1.65,floor+1.25,1.44,.037,.037,.01,'light');panels.push(level);
 }
 return {update(viewer:{x:number;z:number}){root.visible=Math.hypot(viewer.x-HOTEL_LIFT.x,viewer.z-HOTEL_LIFT.z)<100;cab.position.y=runtime.y;panels.forEach((pair,i)=>pair.forEach((p,j)=>p.position.x=(j?1:-1)*(.675+(i===runtime.floor?runtime.doors:0)*1.32)));},dispose(){root.removeFromParent();root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}};
}
