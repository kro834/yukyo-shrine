import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ceramicJar,ceramicSeal} from '../app/ceramic-jar.ts';

test('paper stays above the ceramic lip for all pleat phases',()=>{
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),jar=new THREE.Mesh(ceramicJar(),material);jar.updateMatrixWorld();
 for(const phase of [0,.7,2,4.9]){
  const seal=ceramicSeal(phase),paper=new THREE.Mesh(seal.paper,material);paper.updateMatrixWorld();
  for(let a=0;a<64;a++)for(const r of [.13,.14,.145,.15,.155,.159]){
   const ray=new THREE.Raycaster(new THREE.Vector3(Math.cos((a+.31)/64*Math.PI*2)*r,1,Math.sin((a+.31)/64*Math.PI*2)*r),new THREE.Vector3(0,-1,0));
   const ceramic=ray.intersectObject(jar)[0],cover=ray.intersectObject(paper)[0];
   assert.ok(cover&&(!ceramic||cover.point.y>ceramic.point.y+.002),'paper must clear the entire folded ceramic rim');
  }
  seal.paper.dispose();seal.cord.dispose();
 }
 jar.geometry.dispose();material.dispose();
});

test('storage jar preserves its placement envelope and has a hollow mouth above a closed bottom',()=>{
 const g=ceramicJar();g.computeBoundingBox();
 assert.ok(g.boundingBox!.max.y<=.340001&&g.boundingBox!.min.y>=-.340001);
 assert.ok(g.boundingBox!.max.x<=.270001&&g.boundingBox!.min.x>=-.270001);
 assert.ok(g.index!.count/3<=2304);
 for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
 const hit=new THREE.Raycaster(new THREE.Vector3(.02,1,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
 assert.ok(hit&&Math.abs(hit.point.y+.30)<.00001,'the mouth opens onto the interior bottom');
 const lip=new THREE.Raycaster(new THREE.Vector3(.143,1,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
 assert.ok(lip&&lip.point.y>.33,'the folded lip has physical thickness');
 g.dispose();material.dispose();
});


