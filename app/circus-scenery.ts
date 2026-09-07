// Outside-Site import for verification. Root integration: import * as THREE from 'three'.
import * as THREE from 'three';
import type {CircusPlan,CircusPoint} from './circus-types.ts';

export const CIRCUS_MATERIALS={
 circusRed:{color:'#53252b',roughness:.96,metalness:0,side:THREE.DoubleSide},
 circusIvory:{color:'#aa9676',roughness:.97,metalness:0,side:THREE.DoubleSide},
 circusDark:{color:'#30272b',roughness:.92,metalness:0},
 circusMetal:{color:'#62666a',roughness:.61,metalness:.72},
 circusBrass:{color:'#947047',roughness:.48,metalness:.66},
 circusGlow:{color:'#a47c4d',emissive:'#e5aa5d',emissiveIntensity:.30,roughness:.96},
} as const;
export type CircusMaterial=keyof typeof CIRCUS_MATERIALS|'wood'|'planks'|'rope';
export type CircusAdd=(g:THREE.BufferGeometry,material:CircusMaterial)=>void;
type Cell={x:number;z:number;h:number;kind:string};
type Wall={x:number;z:number;h:number;alongX:boolean;insideX:number;insideZ:number;twoSided?:boolean};
type Layout={grid:Map<string,Cell>;rooms?:readonly {x1:number;x2:number;z1:number;z2:number}[]};
const box=(add:CircusAdd,x:number,y:number,z:number,w:number,h:number,d:number,m:CircusMaterial)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
const cylinder=(add:CircusAdd,x:number,y:number,z:number,r:number,h:number,m:CircusMaterial,rb=r,segments=12)=>add(new THREE.CylinderGeometry(r,rb,h,segments).translate(x,y,z),m);
function rod(add:CircusAdd,a:THREE.Vector3,b:THREE.Vector3,r:number,m:CircusMaterial){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);}
export const circusCentral=(x:number,z:number)=>Math.abs(x)<=34&&Math.abs(z)<=34;
export const circusRoofHeight=(x:number,z:number)=>6.15+5.85*(1-Math.min(1,Math.max(Math.abs(x),Math.abs(z))/34));

/** Return true when the caller should skip the normal ground-cell floor/ceiling.
 * The central roof is emitted separately, including above nonwalkable gaps.
 * Other circus aisles have segmented low backstage rafters; all remain <=4.35 m.
 */
export function buildCircusCell(c:Cell,add:CircusAdd,fixture?:(x:number,y:number,z:number,color:string)=>void){
 const x=c.x*4,z=c.z*4;
 box(add,x,-.13,z,4,.26,4,'planks');
 // Small sunk board joints; no floor geometry rises into the walking surface.
 if(!circusCentral(x,z)){
  const y=Math.min(c.h,4.25);
  box(add,x,y+.035,z,4,.07,4,(Math.floor(c.x/3)+Math.floor(c.z/3))%2?'circusDark':'circusRed');
  box(add,x,y-.10,z,4,.13,.08,'circusMetal');
 }
 const central=circusCentral(x,z),lit=central?(c.x===0||c.z===0)&&(c.x+c.z)%4===0:(c.x+c.z)%7===0;
 if(lit){
  const ceiling=central?circusRoofHeight(x,z):Math.min(c.h,4.25),y=Math.min(3.38,ceiling-.48);
  cylinder(add,x,y,z,.14,.32,'circusGlow',.14,8);
  cylinder(add,x,y-.18,z,.175,.045,'circusMetal');cylinder(add,x,y+.18,z,.175,.045,'circusMetal');
  rod(add,new THREE.Vector3(x,y+.205,z),new THREE.Vector3(x,ceiling-.05,z),.012,'rope');
  fixture?.(x,y-.04,z,'#cda16d');
 }
 return true;
}

/** Pleated canvas at the SAME footprint as the layout wall. No extra floor blockers.
 * A room partition keeps its old height. The big-top exterior reaches its canopy.
 */
export function buildCircusWall(w:Wall,add:CircusAdd){
 const tentBoundary=!w.twoSided&&circusCentral(w.x,w.z)&&Math.max(Math.abs(w.x),Math.abs(w.z))>=33.9;
 const top=tentBoundary?circusRoofHeight(w.x,w.z):Math.min(w.h,4.25);
 const p:number[]=[],uv:number[]=[],indices:number[]=[],segments=12;
 for(let i=0;i<=segments;i++)for(const y of [0,top]){
  const t=-2+i*4/segments,fold=Math.cos(i*Math.PI/2)*.07;
  p.push(w.x+(w.alongX?t:fold),y,w.z+(w.alongX?fold:t));uv.push((t+2)/1.2,y/1.2);
 }
 for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.surfaceUV='authored';
 const stripe=((Math.round(w.x/4)+Math.round(w.z/4))%4+4)%4;add(g,stripe===0?'circusIvory':'circusRed');
 // Thin lacing/hem stays in the existing wall's collision thickness.
 for(const y of [.12,Math.max(.3,top-.16)])box(add,w.x,y,w.z,w.alongX?4:.10,.035,w.alongX?.10:4,'rope');
 for(const t of [-1.75,1.75]){
  const x=w.x+(w.alongX?t:0)+w.insideX*.09,z=w.z+(w.alongX?0:t)+w.insideZ*.09;
  const eye=new THREE.CircleGeometry(.028,6);eye.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(w.insideX,0,w.insideZ)));eye.translate(x,top-.11,z);add(eye,'circusBrass');
 }
 return true;
}

/** Twenty actual radial cloth panels. Color boundaries are straight seams instead
 * of quantized triangle-centroid colors. Angular cuts at square corners keep the
 * roof precisely inside +/-34 m; adjacent panels share their full edge positions.
 */
function buildCanopyPanels(add:CircusAdd){
 const panelCount=20,radialSteps=24,angularSteps=8;
 for(let panel=0;panel<panelCount;panel++){
  const a0=panel*Math.PI*2/panelCount,a1=(panel+1)*Math.PI*2/panelCount,angles:number[]=[];
  for(let j=0;j<=angularSteps;j++)angles.push(a0+(a1-a0)*j/angularSteps);
  for(let corner=0;corner<4;corner++){const a=Math.PI/4+corner*Math.PI/2;if(a>a0+1e-9&&a<a1-1e-9&&!angles.some(v=>Math.abs(v-a)<1e-9))angles.push(a);}
  angles.sort((a,b)=>a-b);const columns=angles.length,p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let radial=0;radial<=radialSteps;radial++)for(const angle of angles){
   const t=radial/radialSteps,r=34/Math.max(Math.abs(Math.sin(angle)),Math.abs(Math.cos(angle))),x=Math.sin(angle)*r*t,z=Math.cos(angle)*r*t;
   // Sag is zero at every seam and at apex/eave, continuous across every panel.
   const sag=.14*Math.sin(Math.PI*t)*Math.sin(Math.PI*(angle-a0)/(a1-a0));
   p.push(x,circusRoofHeight(x,z)-sag,z);uv.push(x/2,z/2);
  }
  for(let radial=0;radial<radialSteps;radial++)for(let j=0;j<columns-1;j++){
   const a=radial*columns+j,b=a+columns;idx.push(a,b,b+1);if(radial>0)idx.push(a,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.userData.surfaceUV='authored';g.userData.circusCanopyPanel=panel;add(g,panel%2?'circusRed':'circusIvory');
 }
}
/** Static rails, boarding marks, control hardware and a complete radial-panel big top.
 * Every geometry is in world space. No new movement obstacles are introduced.
 * Functional moving apparatus is provided by circus-dynamics.ts.
 */
export function buildCircusScenery(plan:CircusPlan,layout:Layout,add:CircusAdd,fixture:(x:number,y:number,z:number,color:string)=>void){
 if(!plan.track.length)return;
 const total=plan.track.length;
 for(let i=0;i<total;i++){
  const a=plan.track[i],b=plan.track[(i+1)%total],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1e-6)continue;
  const nx=-dz/len,nz=dx/len,yaw=Math.atan2(dx,dz);
  for(const side of [-1,1])add(new THREE.BoxGeometry(.055,.045,len+.006).rotateY(yaw).translate((a.x+b.x)/2+nx*side*.41,.027,(a.z+b.z)/2+nz*side*.41),'circusMetal');
  if(i%2===0){add(new THREE.BoxGeometry(1.12,.027,.12).rotateY(yaw).translate(a.x,.01,a.z),'wood');
   for(const side of [-1,1])cylinder(add,a.x+nx*side*.41,.057,a.z+nz*side*.41,.026,.024,'circusBrass',.026,6);
  }
 }
 for(const station of plan.stations){
  // Boarding area is paint/inlay flush with the existing floor, never a raised box.
  const tangent={x:station.position.z===0?0:1,z:station.position.x===0?0:1};
  const normal={x:(station.exit.x-station.position.x)/1.25,z:(station.exit.z-station.position.z)/1.25};
  const yaw=Math.atan2(tangent.x,tangent.z);
  add(new THREE.BoxGeometry(.30,.012,2.8).rotateY(yaw).translate(station.exit.x,.011,station.exit.z),'circusIvory');
  // A small suspended four-sided lantern marks each station, leaving track/crossings clear.
  const x=station.position.x+normal.x*1.30,z=station.position.z+normal.z*1.30;
  cylinder(add,x,3.22,z,.23,.43,'circusGlow',.23,8);cylinder(add,x,2.985,z,.26,.055,'circusDark');cylinder(add,x,3.455,z,.26,.055,'circusDark');
  rod(add,new THREE.Vector3(x,3.49,z),new THREE.Vector3(x,circusRoofHeight(x,z)-.05,z),.014,'rope');fixture(x,3.05,z,'#d4a269');
 }
 for(const device of plan.devices){
  // Mark the user's safe operating point without placing a pedestal in that point.
  const x=device.control.x,z=device.control.z;
  const ring=new THREE.RingGeometry(.29,.34,20);ring.rotateX(-Math.PI/2);ring.translate(x,.012,z);add(ring,'circusBrass');
  const plaque=new THREE.RingGeometry(.12,.19,4);plaque.rotateX(-Math.PI/2);plaque.rotateY(device.yaw);plaque.translate(x,.014,z);add(plaque,'circusIvory');
 }
 // The central 68 m canopy stays clear of upper decks beginning at 50 m.
 buildCanopyPanels(add);
 // Four masts stand only in actual nonwalkable pockets. No pole at the turntable.
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=sx*28.3,z=sz*28.3;
  if(layout.grid.has(Math.round(x/4)+','+Math.round(z/4)))continue;
  cylinder(add,x,3.5,z,.10,7,'circusMetal');
  rod(add,new THREE.Vector3(x,7,z),new THREE.Vector3(0,11.9,0),.026,'rope');
  cylinder(add,x,7.07,z,.15,.07,'circusBrass');
 }
 // A suspended rigging crown makes the square canopy read as an old circus tent.
 const crown=new THREE.TorusGeometry(.7,.045,6,24);crown.rotateX(Math.PI/2);crown.translate(0,10.9,0);add(crown,'circusMetal');
}


