import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ceramicJar} from '../app/ceramic-jar.ts';

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
