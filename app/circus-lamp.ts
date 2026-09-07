import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CircusAdd} from './circus-scenery.ts';

/** Frosted utility lantern with rolled caps, fitted guards and a suspension eye.
 * Three shared-material batches; no transparent sorting or extra lights. */
export function buildCircusLamp(add:CircusAdd,x:number,y:number,z:number,large=false){
 const scale=large?1.45:1,r=.14,h=.32;
 const metal:THREE.BufferGeometry[]=[],brass:THREE.BufferGeometry[]=[];
 const lathe=(profile:number[][],segments=20)=>new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
 const shade=lathe([[r*.83,-h/2],[r*.96,-h*.43],[r,h*.35],[r*.88,h/2]]);
 const p=shade.getAttribute('position'),uv=shade.getAttribute('uv');
 for(let i=0;i<uv.count;i++)uv.setY(i,p.getY(i)/h+.5);
 shade.userData.surfaceUV='authored';
 for(const sign of [-1,1]){
  const cap=lathe([[.025,.174],[.115,.174],[.154,.162],[.171,.168],[.171,.181],[.156,.188],[.09,.207],[.026,.207]],16);
  if(sign<0)cap.rotateX(Math.PI);metal.push(cap);
 }
 for(let guard=0;guard<4;guard++){
  const angle=guard*Math.PI/2+Math.PI/4;
  const points=[-.174,-.12,.12,.174].map((height,i)=>new THREE.Vector3(Math.sin(angle)*(i===0||i===3?.15:.165),height,Math.cos(angle)*(i===0||i===3?.15:.165)));
  metal.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.006,5,false));
 }
 for(const height of [-.115,.105]){
  const hoop=new THREE.TorusGeometry(.163,.004,4,20);hoop.rotateX(Math.PI/2);hoop.translate(0,height,0);brass.push(hoop);
 }
 const eye=new THREE.TorusGeometry(.04,.007,5,16);eye.translate(0,.242,0);metal.push(eye);
 const collar=new THREE.CylinderGeometry(.024,.03,.04,12);collar.translate(0,.216,0);brass.push(collar);
 for(const [g,m] of [[shade,'circusGlow'],[mergeGeometries(metal)!,'circusMetal'],[mergeGeometries(brass)!,'circusBrass']] as const){
  g.scale(scale,scale,scale).translate(x,y,z);g.userData.surfaceUV='authored';add(g,m);
 }
 [...metal,...brass].forEach(g=>g.dispose());
}
