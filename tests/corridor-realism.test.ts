import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildNarrowInterior,NARROW_LAMP,NARROW_CEILING} from '../app/narrow-interior.ts';
import {chamferedBox} from '../app/chamfered-box.ts';
import {sculptedMask} from '../app/sculpted-mask.ts';
import {surfaceUV} from '../app/surface-uv.ts';

test('corridor joinery cannot protrude into the walking envelope or seal cell junctions',()=>{
 for(const along of [true,false])for(let v=0;v<12;v++){
  const meshes:THREE.Mesh[]=[],mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  buildNarrowInterior((x,y,z,w,h,d)=>{
   const t=along?x:z,u=along?z:x,tw=along?w:d,uw=along?d:w;
   if(y-h/2<2.4){assert.ok(Math.abs(u)-uw/2>=1.36-1e-8);assert.ok(Math.abs(t)+tw/2<=2+1e-8);}
   else assert.ok(y-h/2>2.4);
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.updateMatrixWorld();meshes.push(mesh);
  },0,0,along,v);
  for(const y of [.3,1.68,2.35])for(const u of [-.93,0,.93]){
   const start=new THREE.Vector3(along?-2.5:u,y,along?u:-2.5),dir=new THREE.Vector3(along?1:0,0,along?0:1);
   assert.equal(new THREE.Raycaster(start,dir,0,5).intersectObjects(meshes,false).length,0);
  }
  meshes.forEach(m=>m.geometry.dispose());mat.dispose();
 }
 assert.ok(NARROW_LAMP.y+NARROW_LAMP.h/2+.025<NARROW_CEILING);
 assert.ok(NARROW_LAMP.y-NARROW_LAMP.h/2-.025>2.4);
});

test('timber bevels have outward winding, a bounded triangle budget, and merge with indexed scene geometry',()=>{
 for(const dimensions of [[.18,3,.09],[4,.16,.10],[.12,.08,4]]){
  const g=chamferedBox(...dimensions as [number,number,number]),p=g.getAttribute('position'),n=g.getAttribute('normal'),ix=g.index!;
  g.computeBoundingBox();const size=g.boundingBox!.getSize(new THREE.Vector3()).toArray();size.forEach((v,i)=>assert.ok(Math.abs(v-dimensions[i])<1e-6));assert.equal(ix.count/3,44);
  for(let i=0;i<ix.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+2)),normal=new THREE.Vector3().fromBufferAttribute(n,ix.getX(i));assert.ok(b.sub(a).cross(c.sub(a)).dot(normal)>0);}
  surfaceUV(g,1,'timber-photo');const ordinary=new THREE.BoxGeometry(),merged=mergeGeometries([g,ordinary]);assert.ok(merged);merged.dispose();ordinary.dispose();g.dispose();
 }
});

test('photographic timber uses the same single-board crop for diffuse and relief at every beam orientation',()=>{
 for(const dimensions of [[.18,3,.09],[4,.16,.10],[.12,.08,4]]){
  const g=chamferedBox(...dimensions as [number,number,number]);surfaceUV(g,.38,'timber-photo');const uv=g.getAttribute('uv');
  for(let i=0;i<uv.count;i++){assert.ok(Number.isFinite(uv.getX(i)));assert.ok(uv.getY(i)>=.76-1e-6&&uv.getY(i)<=.85+1e-6);}
  g.dispose();
 }
});

test('sculpted faces retain their collision envelope and provide finite relief normals with surface weathering',()=>{
 for(let v=0;v<8;v++){
  const g=sculptedMask(v),p=g.getAttribute('position'),normal=g.getAttribute('normal'),color=g.getAttribute('color');
  assert.ok(g.index!.count/3<=2200);assert.equal(color.count,p.count);
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getX(i))<=.14001&&Math.abs(p.getY(i))<=.23001&&Math.abs(p.getZ(i))<=.09001);assert.ok(Number.isFinite(normal.getX(i)+normal.getY(i)+normal.getZ(i)));}
  assert.ok(Math.max(...color.array)-Math.min(...color.array)>.2);g.dispose();
 }
});
