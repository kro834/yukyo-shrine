import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {boardFacing} from '../app/board-facing.ts';

void test('wood facing covers the panel, exposes only tiny joints, and keeps its old envelope',()=>{
 for(const [nx,nz] of [[0,1],[1,0],[0,-1],[-1,0]]){
  const g=boardFacing(3.7,2.15,.055,17),count=g.userData.boardCount as number,pitch=3.7/count;
  const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(g,material);
  // Sample broad face coverage, actual seam apertures, and near the framed ends.
  mesh.updateMatrixWorld();
  const ray=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
  for(let board=0;board<count;board++)for(const y of [-1.072,0,1.072])assert.ok(ray(-1.85+(board+.5)*pitch,y).length);
  for(let joint=1;joint<count;joint++){
   const x=-1.85+joint*pitch;
   assert.equal(ray(x,0).length,0,'joints have real separation');
   assert.ok(ray(x-.003,0).length&&ray(x+.003,0).length,'each joint stays millimetres wide');
  }
  const bounds=g.boundingBox!;
  assert.ok(Math.abs(bounds.min.x+1.85)<1e-6&&Math.abs(bounds.max.x-1.85)<1e-6);
  assert.ok(Math.abs(bounds.min.y+1.075)<1e-6&&Math.abs(bounds.max.y-1.075)<1e-6);
  assert.ok(bounds.min.z>=-.027501&&bounds.max.z<=.027501);
  g.rotateY(Math.atan2(nx,nz)).translate(nx*.18,1.85,nz*.18);mesh.updateMatrixWorld();
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const forward=p.getX(i)*nx+p.getZ(i)*nz;
   assert.ok(forward>=.152499&&forward<=.207501,'original panel depth on every wall orientation');
  }
  const sampleX=-1.85+pitch*.5;
  assert.ok(new THREE.Raycaster(new THREE.Vector3(nx+nz*sampleX,1.85,nz-nx*sampleX),new THREE.Vector3(-nx,0,-nz)).intersectObject(mesh).length,'upright facing survives rotation and front-side culling');
  material.dispose();g.dispose();
 }
});

void test('indexed facing has correct outward normals and a small fixed triangle budget',()=>{
 const g=boardFacing(),p=g.getAttribute('position'),n=g.getAttribute('normal'),idx=g.index!;
 assert.ok(idx.count/3<=300);
 assert.equal(p.count,n.count);assert.equal(p.count,g.getAttribute('uv').count);
 for(let i=0;i<idx.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i));
  const b=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+1));
  const c=new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+2));
  const normal=new THREE.Vector3().fromBufferAttribute(n,idx.getX(i)),area=b.sub(a).cross(c.sub(a));
  assert.ok(area.lengthSq()>1e-15,'no degenerate bevel triangles');
  assert.ok(area.normalize().dot(normal)>.99999,'winding agrees with the visible normal');
  assert.ok(Math.abs(normal.length()-1)<1e-6);
  assert.ok(normal.z>=0,'only front and edge faces; no hidden backwards-facing cap');
 }
 const box=new THREE.BoxGeometry(),merged=mergeGeometries([g,box]);
 assert.ok(merged,'same indexed attributes as the static world batch');
 merged.dispose();box.dispose();g.dispose();
});

void test('upright photo grain uses varied seam-free crops and survives authored batching',()=>{
 const g=boardFacing(3.7,2.15,.055,17),same=boardFacing(3.7,2.15,.055,17),other=boardFacing(3.7,2.15,.055,31);
 const uv=g.getAttribute('uv'),p=g.getAttribute('position'),n=g.getAttribute('normal'),crops=new Set<string>();
 assert.equal(g.userData.surfaceUV,'authored');
 assert.deepEqual(uv.array,same.getAttribute('uv').array);assert.notDeepEqual(uv.array,other.getAttribute('uv').array);
 for(let i=0;i<uv.count;i++){
  assert.ok(uv.getX(i)>=.035&&uv.getX(i)<=.97);
  assert.ok(uv.getY(i)>=.759&&uv.getY(i)<=.851);
  if(n.getZ(i)===1&&p.getY(i)<0){
   // The first corner of each front quad has its upright counterpart at i+3.
   if(p.getX(i)===p.getX(i+3)&&p.getY(i+3)>p.getY(i)){
    assert.ok(uv.getX(i+3)>uv.getX(i));assert.equal(uv.getY(i+3),uv.getY(i));
    crops.add(uv.getX(i).toFixed(5)+','+uv.getY(i).toFixed(5));
   }
  }
 }
 assert.equal(crops.size,g.userData.boardCount,'every board has its own crop');
 g.dispose();same.dispose();other.dispose();
});
