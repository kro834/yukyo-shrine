import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {wainscot} from '../app/wainscot.ts';

test('facing stays within the previous wall envelope on all four orientations',()=>{
 for(const [nx,nz] of [[0,1],[1,0],[0,-1],[-1,0]]){
  const g=wainscot(4,.78,.16,3).rotateY(Math.atan2(nx,nz)).translate(nx*.18,.39,nz*.18);
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
   assert.ok(p.getX(i)*nx+p.getZ(i)*nz<=.260001,'no extra intrusion into walkable floor');
   assert.ok(p.getY(i)>=-1e-6&&p.getY(i)<=.780001);
  }
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(new THREE.Vector3(nx, .4,nz),new THREE.Vector3(-nx,0,-nz));
  assert.ok(ray.intersectObject(mesh).length,'visible front survives rotation and backface culling');
  assert.ok(g.index!.count/3<=140,'front-only joinery stays within a small fixed geometry budget');
  mesh.material.dispose();g.dispose();
 }
});

test('board fibres run vertically and each sampled crop excludes photographed end seams',()=>{
 const g=wainscot(4,.78,.16),uv=g.getAttribute('uv'),p=g.getAttribute('position');
 for(let i=0;i<uv.count;i++){
  assert.ok(uv.getX(i)>=.035&&uv.getX(i)<=.97);
  assert.ok(uv.getY(i)>=.759&&uv.getY(i)<=.851);
 }
 // First face: left-bottom and left-top have the same cross-grain coordinate.
 assert.ok(p.getY(5)>p.getY(0));assert.ok(uv.getX(5)>uv.getX(0));assert.equal(uv.getY(5),uv.getY(0));
 g.dispose();
});
