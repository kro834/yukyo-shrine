import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Enemies} from '../app/shrine-gameplay.ts';import {createSectorLayout} from '../app/sector-layout.ts';
import {ERROR_ROOMS} from '../app/error-stage.ts';import {traitSpeed} from '../app/enemy-traits.ts';
import {createAirborneDust} from '../app/airborne-dust.ts';
import {prepareBlenderGeometry} from '../app/blender-geometry.ts';

test('Error uses its own two enemy types on every floor, including after death reset',()=>{
 const layout=createSectorLayout(31,'error'),ai=new Enemies(layout.cells,layout.obstacles,['errorWatch','errorWeep']);
 assert.deepEqual(new Set(ai.actors.map(e=>e.kind)),new Set(['errorWatch','errorWeep']));
 assert.equal(new Set(ai.actors.map(e=>e.floor)).size,3);assert.equal(layout.rooms.length,87);
 assert.equal(new Set(layout.rooms.map(r=>r.themeId)).size,ERROR_ROOMS.length);
 ai.beginFinale({x:0,z:14},0,()=>0);ai.reset();assert.equal(ai.actors.length,12);assert.deepEqual(new Set(ai.actors.map(e=>e.kind)),new Set(['errorWatch','errorWeep']));
});
test('inverse mask sees light while weeping mask follows the last audible footstep',()=>{
 const layout=createSectorLayout(31,'error'),ai=new Enemies(layout.cells,[],['errorWatch','errorWeep']);ai.actors=ai.actors.slice(0,2);
 for(const e of ai.actors){e.position={x:0,z:-35};e.floor=0;e.brain.reacquireDelay=0;}
 ai.hear({x:0,z:14});assert.equal(ai.actors[0].investigate,null);assert.deepEqual(ai.actors[1].investigate,{x:0,z:14});
 const watcher=ai.actors[0];ai.actors=[watcher];watcher.position={x:0,z:2};watcher.facing=0;
 for(let i=0;i<5;i++)ai.update(.05,{x:0,z:14},[],0,[],true,[],false);
 assert.notEqual(watcher.brain.mode,'chase','running in darkness alone is not vision for the inverse mask');
 watcher.position={x:0,z:2};watcher.facing=0;
 for(let i=0;i<5;i++)ai.update(.05,{x:0,z:14},[],0,[],true,[],true);
 assert.equal(watcher.brain.mode,'chase');
 assert.ok(traitSpeed('errorWeep',true,.3,8.9)<1);assert.ok(traitSpeed('errorWeep',true,1,8.9)>8);assert.equal(traitSpeed('errorWeep',false,1,3.1),3.1);
});
test('Blender exports contain finite, detailed meshes in the original game scale',async()=>{
 for(const name of ['inverse','weeping','pull']){
  const bytes=await fs.readFile(new URL('../public/models/error/'+name+'.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.updateMatrixWorld(true);
  let triangles=0;const bounds=new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');assert.ok(o.geometry.getAttribute('normal'));assert.ok(o.geometry.getAttribute('uv'));assert.ok(o.geometry.getAttribute('color'));for(const n of p.array)assert.ok(Number.isFinite(n));triangles+=(o.geometry.index?.count??p.count)/3;
   const original=Array.from(o.geometry.getAttribute('uv').array as ArrayLike<number>);prepareBlenderGeometry(o.geometry);const uv=o.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)assert.ok(Math.abs(uv.getY(i)-(1-original[i*2+1]))<1e-6,'glTF UV must match shared TextureLoader orientation');o.geometry.dispose();}});
  assert.ok(triangles>2000&&triangles<10000,name+' detail budget');
  if(name==='pull'){assert.ok(bounds.min.x>.97&&bounds.max.x<1.13);assert.ok(bounds.min.z>=-.074&&bounds.max.z<=.074);}
  else{assert.ok(bounds.max.x-bounds.min.x<.4);assert.ok(bounds.min.y>-.31&&bounds.max.y<.25);}
 }
});
test('airborne dust scales down on phones and follows the simulation clock and flashlight',()=>{
 const scene=new THREE.Scene(),dust=createAirborneDust(scene),camera=new THREE.PerspectiveCamera(),mesh=scene.getObjectByName('airborne-dust') as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
 dust.setQuality('low');assert.equal(mesh.geometry.drawRange.count,96);dust.setQuality('ultra');assert.equal(mesh.geometry.drawRange.count,420);
 dust.update(1200,camera,false,800);assert.equal(mesh.material.uniforms.airTime.value,1.2);assert.equal(mesh.material.uniforms.lampOn.value,0);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);
 dust.update(1200,camera,true,800);assert.equal(mesh.material.uniforms.airTime.value,1.2);assert.equal(mesh.material.uniforms.lampOn.value,1);dust.dispose();assert.equal(scene.children.length,0);
});
