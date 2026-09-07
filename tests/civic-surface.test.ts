import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCivicScene} from '../app/civic-scene.ts';
import {CIVIC_LANDMARK_IDS} from '../app/civic-landmarks.ts';

test('civic fixtures never introduce a second surface under the main walking strip',()=>{
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 for(const id of CIVIC_LANDMARK_IDS)for(const quarterTurns of [0,1,2,3]){
  const meshes:THREE.Mesh[]=[];
  buildCivicScene([{id,x:0,z:0,quarterTurns}],g=>{const mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();meshes.push(mesh);},()=>-.4);
  const angle=quarterTurns*Math.PI/2;
  for(const x of [-.65,0,.65])for(const z of [-5.5,-3.1,-.2,2.9,5.4]){
   const point=new THREE.Vector3(x*Math.cos(angle)-z*Math.sin(angle),1.68,x*Math.sin(angle)+z*Math.cos(angle));
   assert.equal(new THREE.Raycaster(point,new THREE.Vector3(0,-1,0),0,1.72).intersectObjects(meshes).length,0,'extra walk surface in '+id);
  }
  meshes.forEach(m=>m.geometry.dispose());
 }
 material.dispose();
});
