import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ScannedProps,propTransform,propFootprint,SCANNED_SPECS} from '../app/scanned-props.ts';
import {slidingDoorLeaf,SLIDING_LEAF_ENVELOPE as envelope} from '../app/sliding-door-leaf.ts';

test('scans retain proportions, rest on their support and fit rotated collision bounds',()=>{
 const original=new THREE.Box3(new THREE.Vector3(-2,-3,1),new THREE.Vector3(4,7,5));
 for(const kind of ['chair','stool','vase'] as const){const spec=SCANNED_SPECS[kind],fitted=original.clone().applyMatrix4(propTransform(original,spec)),size=fitted.getSize(new THREE.Vector3());
  assert.ok(Math.abs(fitted.min.y)<1e-6);assert.ok(size.x<=spec.width+1e-6&&size.y<=spec.height+1e-6&&size.z<=spec.depth+1e-6);
  assert.ok(Math.abs(size.x/size.y-.6)<1e-6);
  for(const yaw of [0,.7,Math.PI/2,Math.PI]){const p={kind,x:11,y:.024,z:-3,yaw},wall=propFootprint(p),matrix=new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x,p.y,p.z),box=fitted.clone().applyMatrix4(matrix);
   assert.ok(box.min.x>=wall.minX-1e-6&&box.max.x<=wall.maxX+1e-6&&box.min.z>=wall.minZ-1e-6&&box.max.z<=wall.maxZ+1e-6&&box.max.y<=wall.maxY+1e-6);
  }
 }
});
function sample(){const scene=new THREE.Group(),geometry=new THREE.BoxGeometry(1,2,1),map=new THREE.Texture(),normalMap=new THREE.Texture(),arm=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map,normalMap,roughnessMap:arm,metalnessMap:arm,aoMap:arm});scene.add(new THREE.Mesh(geometry,material));return {scene,geometry,material,map,normalMap,arm};}
test('async model install preserves current quality; disposal releases shared resources and late loads',async()=>{
 const source=sample(),scene=new THREE.Scene(),loader={loadAsync:async()=>source} as unknown as Pick<GLTFLoader,'loadAsync'>,p=[{kind:'chair' as const,x:0,y:0,z:0,yaw:0}];
 const props=new ScannedProps(scene,p,true,loader);props.setQuality('low');await props.ready;
 const mesh=scene.getObjectByName('scanned-chair') as THREE.InstancedMesh,material=mesh.material as THREE.MeshStandardMaterial;
 assert.equal(material.map,source.map);assert.equal(material.normalMap,null);assert.equal(material.metalnessMap,null);assert.equal(material.roughnessMap,null);
 props.setQuality('ultra');assert.equal(material.normalMap,source.normalMap);assert.equal(material.roughnessMap,source.arm);
 props.update({x:1000,z:0});assert.equal(mesh.visible,false);props.update({x:0,z:0});assert.equal(mesh.visible,true);
 let released=0;source.map.addEventListener('dispose',()=>released++);props.dispose();assert.equal(scene.children.length,0);assert.equal(released,1);
 const late=sample();let resolve!:(v:unknown)=>void,lateDisposals=0;late.map.addEventListener('dispose',()=>lateDisposals++);
 const deferred=new ScannedProps(scene,p,true,{loadAsync:()=>new Promise(r=>resolve=r)} as unknown as Pick<GLTFLoader,'loadAsync'>);
 deferred.dispose();resolve(late);await deferred.ready;assert.equal(scene.children.length,0);assert.equal(lateDisposals,1);
});
test('both recessed door leaves remain inside the old collision and sliding envelope',()=>{
 for(const gothic of [false,true]){const parts=slidingDoorLeaf(gothic),bounds=new THREE.Box3();
  for(const geometry of Object.values(parts)){geometry.computeBoundingBox();bounds.union(geometry.boundingBox!);const positions=geometry.getAttribute('position');for(let i=0;i<positions.count;i++)assert.ok([positions.getX(i),positions.getY(i),positions.getZ(i)].every(Number.isFinite));assert.equal(geometry.getAttribute('color').count,positions.count);geometry.dispose();}
  for(const [axis,min,max] of [['x',envelope.minX,envelope.maxX],['y',envelope.minY,envelope.maxY],['z',envelope.minZ,envelope.maxZ]] as const)assert.ok(bounds.min[axis]>=min-1e-6&&bounds.max[axis]<=max+1e-6);
  assert.ok(bounds.min.x+envelope.travel>1.5);
 }
});
