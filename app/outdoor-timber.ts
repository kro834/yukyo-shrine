import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {chamferedBox} from './chamfered-box.ts';
import {surfaceUV} from './surface-uv.ts';

/** One four-metre bay, with the same rail/post envelope as the original fence.
 * Authored piece UVs keep grain following each beam after world-space batching. */
export function outdoorTimberBay(variation:number){
 const timber:THREE.BufferGeometry[]=[],hardware:THREE.BufferGeometry[]=[];
 const phase=(i:number)=>{const n=Math.sin(variation*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
 const member=(g:THREE.BufferGeometry,i:number)=>{
  surfaceUV(g,.38,'timber-photo');const uv=g.getAttribute('uv'),p=g.getAttribute('position');
  const colors=new Float32Array(p.count*3),shade=.80+.17*phase(i);
  for(let k=0;k<p.count;k++){
   if(phase(i+7)>.5)uv.setX(k,1-uv.getX(k));
   // Raised grain remains dry; splash staining is confined to the post feet.
   const foot=THREE.MathUtils.smoothstep(p.getY(k),.03,.40),tone=shade*(.64+.36*foot);
   colors[k*3]=tone;colors[k*3+1]=tone;colors[k*3+2]=tone;
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));timber.push(g);
 };
 // Sink the foot below exposed soil while retaining the previous top height.
 for(const [i,x] of [-1.85,1.85].entries())member(chamferedBox(.12,1.28,.12,.006).translate(x,.625,0),i);
 for(const [i,y] of [.55,1.05].entries()){
  member(chamferedBox(4,.085,.08,.005).translate(0,y,0),i+2);
  for(const x of [-1.85,1.85]){
   // Low-profile plates sit on both faces; a real fastener joins each cross rail.
   for(const side of [-1,1]){
    hardware.push(new THREE.BoxGeometry(.038,.046,.003).translate(x,y,side*.0615));
    hardware.push(new THREE.CylinderGeometry(.009,.009,.009,6).rotateX(Math.PI/2).translate(x,y,side*.067));
   }
  }
 }
 const wood=mergeGeometries(timber)!,metal=mergeGeometries(hardware)!;
 [...timber,...hardware].forEach(g=>g.dispose());wood.userData.surfaceUV='authored';
 return {wood,metal};
}

/** Weathering removes warm lignin colour without erasing photographed grain. */
export function outdoorTimberFinish(material:THREE.MeshStandardMaterial){
 const prior=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`outdoor-timber-v1-${key}`;
 material.onBeforeCompile=(shader,renderer)=>{
  prior.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float timberLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(timberLuma),.67);
  `);
 };
}
