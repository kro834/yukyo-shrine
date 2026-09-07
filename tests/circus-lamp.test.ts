import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCircusLamp} from '../app/circus-lamp.ts';

test('utility lantern keeps a continuous optical gradient, safe headroom and bounded batches',()=>{
 for(const large of [false,true]){
  const geometries:{g:THREE.BufferGeometry;m:string}[]=[];
  buildCircusLamp((g,m)=>geometries.push({g,m}),12,3.22,-20,large);
  assert.equal(geometries.length,3);
  let triangles=0;
  for(const {g,m} of geometries){
   const p=g.getAttribute('position'),n=g.getAttribute('normal');g.computeBoundingBox();
   assert.ok(g.boundingBox!.min.y>2.9,'housing remains above head height');
   assert.ok(g.boundingBox!.max.x<12.26&&g.boundingBox!.min.x>11.74);
   triangles+=g.index!.count/3;
   for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+n.getX(i)+n.getY(i)+n.getZ(i)));
   if(m==='circusGlow'){
    const uv=g.getAttribute('uv'),height=g.boundingBox!.max.y-g.boundingBox!.min.y;
    for(let i=0;i<p.count;i++)assert.ok(Math.abs(uv.getY(i)-(p.getY(i)-g.boundingBox!.min.y)/height)<.00001);
    const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
    assert.ok(new THREE.Raycaster(new THREE.Vector3(12,3.22,-18),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0);material.dispose();
   }
   g.dispose();
  }
  assert.ok(triangles<1500,'detailed housing stays within the static geometry budget');
 }
});
