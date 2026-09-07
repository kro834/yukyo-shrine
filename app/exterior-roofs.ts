import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {chamferedBox} from './chamfered-box.ts';
import type {Room,Cell} from './shrine-layout.ts';
import {belowUpperDeck} from './ground-clearance.ts';
import {STAIRS} from './annex.ts';
import {HIGH_STAIRS} from './vertical-layout.ts';

export function exteriorRoofSites(rooms:readonly Room[],cells:readonly Cell[]){
 return rooms.filter(r=>{
  const minX=r.x1*4-2.3,maxX=r.x2*4+2.3,minZ=r.z1*4-2.3,maxZ=r.z2*4+2.3;
  if(belowUpperDeck(minX,maxX,minZ,maxZ)||[...STAIRS,...HIGH_STAIRS].some(s=>maxX>s.minX-.5&&minX<s.maxX+.5&&maxZ>s.minZ-1.5&&minZ<s.maxZ+1.5))return false;
  return cells.some(c=>c.kind==='field'&&c.x>=r.x1-2&&c.x<=r.x2+2&&c.z>=r.z1-2&&c.z<=r.z2+2);
 });
}

/** Fitted corrugated gable cap above the existing ceiling. Local y=0 is its
 * eave datum; the collar descends to meet the lower exterior wall modules. */
export function exteriorRoof(width:number,depth:number){
 const half=width/2,rise=Math.min(2.2,width*.16),segments=Math.ceil(depth/.055),pitch=.22;
 const p:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const side of [-1,1]){
  const base=p.length/3;
  for(let row=0;row<=segments;row++){
   const z=-depth/2+depth*row/segments,wave=.008*(1+Math.cos(z/pitch*Math.PI*2));
   for(const x of [0,side*half]){p.push(x,rise*(1-Math.abs(x)/half)+wave,z);uv.push(x/2.2,z/2.2);}
  }
  for(let row=0;row<segments;row++){const a=base+row*2,b=a+1,c=a+2,d=a+3;
   if(side>0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
  }
 }
 const metal=new THREE.BufferGeometry();metal.setAttribute('position',new THREE.Float32BufferAttribute(p,3));metal.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));metal.setIndex(indices);metal.computeVertexNormals();metal.userData.surfaceUV='authored';
 const ends:THREE.BufferGeometry[]=[];
 for(const sign of [-1,1]){
  const face=new THREE.BufferGeometry();face.setAttribute('position',new THREE.Float32BufferAttribute([-half,0,sign*depth/2,half,0,sign*depth/2,0,rise,sign*depth/2],3));
  face.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,width*.38,0,width*.19,rise*.38],2));face.setIndex(sign>0?[0,1,2]:[0,2,1]);face.computeVertexNormals();ends.push(face);
 }
 const gables=mergeGeometries(ends)!;ends.forEach(g=>g.dispose());
 const trims=[chamferedBox(.24,.12,depth+.10,.009).translate(0,rise+.025,0),new THREE.BoxGeometry(width,.045,depth).translate(0,-.025,0)];
 // Exterior wall modules can end at 3.6 m while the room ceiling is 4.2 m.
 // A high clerestory collar closes that transition without lowering headroom.
 for(const side of [-1,1]){
  trims.push(new THREE.BoxGeometry(.10,.90,depth-.5).translate(side*(half-.25),-.45,0));
  trims.push(new THREE.BoxGeometry(width-.5,.90,.10).translate(0,-.45,side*(depth/2-.25)));
 }
 for(const side of [-1,1])trims.push(chamferedBox(.11,.18,depth+.08,.008).translate(side*(half-.025),-.045,0));
 // Rake boards cover the sheet ends at both gables. Keep their tops just below
 // the metal so the silhouette has thickness without z-fighting the roof skin.
 for(const end of [-1,1])for(const side of [-1,1]){
  trims.push(new THREE.BoxGeometry(Math.hypot(half,rise),.12,.09)
   .rotateZ(-side*Math.atan2(rise,half))
   .translate(side*half/2,rise/2-.05,end*(depth/2+.018)));
 }
 const trim=mergeGeometries(trims)!;trims.forEach(g=>g.dispose());
 return {metal,gables,trim,rise};
}
