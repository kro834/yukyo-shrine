import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {outdoorTimberBay} from '../app/outdoor-timber.ts';

test('weathered fence detail stays within the original walking clearance and geometry budget',()=>{
 for(const seed of [1,17,735]){
  const bay=outdoorTimberBay(seed);let triangles=0;
  for(const g of [bay.wood,bay.metal]){
   g.computeBoundingBox();const b=g.boundingBox!;
   assert.ok(b.min.x>=-2.001&&b.max.x<=2.001);
   assert.ok(b.min.z>=-.08&&b.max.z<=.08,'hardware cannot narrow the walking strip');
   assert.ok(b.min.y>=-.016&&b.max.y<=1.266);
   for(const a of Object.values(g.attributes))for(const value of a.array)assert.ok(Number.isFinite(value));
   triangles+=g.index!.count/3;
  }
  assert.ok(triangles<500);
  const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(bay.wood,material);mesh.updateMatrixWorld();
  for(const x of [-1.85,1.85])assert.ok(new THREE.Raycaster(new THREE.Vector3(x,0,.5),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,'posts must intersect the soil plane');
  for(const y of [.55,1.05])assert.ok(new THREE.Raycaster(new THREE.Vector3(0,y,.5),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0,.8,.5),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,0,'open space between rails remains open');
  bay.wood.dispose();bay.metal.dispose();material.dispose();
 }
});
