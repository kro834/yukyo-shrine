import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {plankFloor} from '../app/plank-floor.ts';

test('plank surfaces preserve walking height, recessed joints and continuity across scene tiles',()=>{
 const material=new THREE.MeshBasicMaterial(),geometries=[plankFloor(0,0,4,4,0),plankFloor(0,4,4,4,0)];
 const meshes=geometries.map(g=>{const m=new THREE.Mesh(g,material);m.updateMatrixWorld();return m;});
 const hit=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)).intersectObjects(meshes)[0];
 for(const g of geometries){
  g.computeBoundingBox();assert.ok(g.boundingBox!.max.y<=0&&g.boundingBox!.min.y>=-.00251);
  assert.ok(g.index!.count/3<=600,'detail stays bounded per four-metre floor tile');
  for(const attribute of Object.values(g.attributes))for(const v of attribute.array)assert.ok(Number.isFinite(v));
 }
 for(const x of [-1.875,-.875,.375,1.375])assert.equal(hit(x,1.25)?.point.y,0);
 assert.equal(hit(.25,1.25),undefined,'joint is recessed rather than a strip sitting above the floor');
 const before=hit(.375,1.9999),after=hit(.375,2.0001);assert.ok(before&&after);
 assert.equal(before.point.y,0);assert.equal(after.point.y,0);
 assert.ok(before.uv!.distanceTo(after.uv!)<.0002,'grain must continue through a non-joint tile cut');
 for(const g of geometries)g.dispose();material.dispose();
});
