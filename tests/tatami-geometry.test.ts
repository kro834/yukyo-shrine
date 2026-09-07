import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TATAMI,createTatamiGeometry,tatamiPlacementsForRectangle} from '../app/tatami-geometry.ts';

test('photographic tatami keeps finished height, real mat dimensions and upward winding',()=>{
 const mats=tatamiPlacementsForRectangle({x:10,z:-20,width:4,depth:8,floorY:4.78,inset:.1,variation:17});
 assert.equal(mats.length,16);
 const g=createTatamiGeometry(mats),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 assert.equal(g.triangles,mats.length*TATAMI.trianglesPerMat);
 for(const mesh of [g.reed,g.border]){
  assert.equal(mesh.userData.surfaceUV,'authored');const p=mesh.getAttribute('position'),n=mesh.getAttribute('normal'),idx=mesh.index!;
  for(let i=0;i<p.count;i++){assert.ok(p.getY(i)<=4.800001);assert.ok(p.getY(i)>4.779);assert.ok(p.getX(i)>8&&p.getX(i)<12);assert.ok(p.getZ(i)>-24&&p.getZ(i)<-16);}
  for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i));b.fromBufferAttribute(p,idx.getX(i+1));c.fromBufferAttribute(p,idx.getX(i+2));b.sub(a).cross(c.sub(a));a.fromBufferAttribute(n,idx.getX(i));assert.ok(b.dot(a)>0);}
 }
 const uv=g.reed.getAttribute('uv');for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=.0249&&uv.getX(i)<=.9751);assert.ok(uv.getY(i)>=.0279&&uv.getY(i)<=.4751);}
 g.reed.dispose();g.border.dispose();
});
