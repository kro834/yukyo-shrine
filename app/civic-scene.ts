import * as THREE from 'three';
import {createCivicLandmark,type CivicLandmarkId,type CivicMaterial} from './civic-landmarks.ts';
import {chamferedBox} from './chamfered-box.ts';
import type {Obstacle} from './movement.ts';

export type CivicSite={id:CivicLandmarkId;x:number;z:number;quarterTurns:number};
/** A 4 m pedestrian street: keep the central 1.6 m clear and share solid footprints. */
export function buildCivicScene(sites:readonly CivicSite[],add:(g:THREE.BufferGeometry,m:CivicMaterial)=>void,height:(x:number,z:number)=>number){
 const colliders:Obstacle[]=[];
 for(const site of sites){
  const kit=createCivicLandmark(site.id),angle=site.quarterTurns*Math.PI/2;
  const point=(x:number,z:number)=>({x:site.x+x*Math.cos(angle)-z*Math.sin(angle),z:site.z+x*Math.sin(angle)+z*Math.cos(angle)});
  for(const part of kit.parts){
   let g:THREE.BufferGeometry;
   if(part.kind==='box')g=new THREE.BoxGeometry(part.w,part.h,part.d).translate(part.x,part.y,part.z);
   else if(part.kind==='beveledBox')g=chamferedBox(part.w,part.h,part.d,part.radius).rotateY(-(part.yaw??0)).translate(part.x,part.y,part.z);
   else if(part.kind==='cylinder')g=new THREE.CylinderGeometry(part.r,part.rb,part.h,part.segments).translate(part.x,part.y,part.z);
   else {
    const from=new THREE.Vector3(...part.from),to=new THREE.Vector3(...part.to),delta=to.clone().sub(from);
    g=new THREE.CylinderGeometry(part.radius,part.radius,delta.length(),part.segments,1,true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...from.add(to).multiplyScalar(.5).toArray());
   }
   g.rotateY(-angle).translate(site.x,0,site.z);add(g,part.material);
  }
  const rect=(r:{minX:number;maxX:number;minZ:number;maxZ:number})=>{
   const ps=[point(r.minX,r.minZ),point(r.maxX,r.minZ),point(r.maxX,r.maxZ),point(r.minX,r.maxZ)];
   return {minX:Math.min(...ps.map(p=>p.x)),maxX:Math.max(...ps.map(p=>p.x)),minZ:Math.min(...ps.map(p=>p.z)),maxZ:Math.max(...ps.map(p=>p.z))};
  };
  for(const c of kit.colliders)colliders.push({...rect(c),minY:c.minY,maxY:c.maxY});
  for(const foundation of kit.foundations){
   const r=rect(foundation),cx=(r.minX+r.maxX)/2,cz=(r.minZ+r.maxZ)/2;
   const base=Math.min(height(r.minX,r.minZ),height(r.maxX,r.minZ),height(r.minX,r.maxZ),height(r.maxX,r.maxZ),height(cx,cz));
   if(base<-.01)add(new THREE.BoxGeometry(r.maxX-r.minX,-base+.02,r.maxZ-r.minZ).translate(cx,(base-.02)/2,cz),'concrete');
  }
 }
 return colliders;
}
