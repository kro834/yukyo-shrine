import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OutdoorReflection,reflectionShadowsReady,waterReflectionUniforms} from '../app/outdoor-reflection.ts';

test('a water capture waits for new shadow atlases and keeps only a completed capture at the same level',()=>{
 const uniforms=waterReflectionUniforms(),tile={x:0,z:0,waterY:0},reflection=new OutdoorReflection(uniforms,[tile]);
 const scene=new THREE.Scene(),light=new THREE.SpotLight(),camera=new THREE.PerspectiveCamera(70,1,.08,180);
 light.castShadow=true;scene.add(light,light.target);camera.position.set(0,1.68,2);camera.lookAt(0,0,0);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshStandardMaterial());scene.add(water);
 let captures=0;
 const renderer={shadowMap:{enabled:true,autoUpdate:true},xr:{enabled:false},autoClear:true,getRenderTarget:()=>null,setRenderTarget(){},state:{buffers:{depth:{setMask(){}}}},render(){captures++;assert.equal(water.visible,false);}} as unknown as THREE.WebGLRenderer;
 const atlas=new THREE.WebGLRenderTarget(16,16,{depthTexture:new THREE.DepthTexture(16,16)});
 const update=(time:number)=>reflection.update(renderer,scene,camera,time,true,[water]);
 try{
  assert.equal(update(0),false);assert.equal(captures,0);assert.equal(uniforms.waterReflectionGain.value,0);
  light.shadow.map=atlas;
  assert.equal(update(16),true);assert.equal(captures,1);assert.equal(uniforms.waterReflectionGain.value,.85);assert.equal(water.visible,true);
  light.shadow.map=null;
  assert.equal(update(160),true);assert.equal(captures,1,'a quality change must not bind missing depth maps');assert.equal(uniforms.waterReflectionGain.value,.85);
  tile.waterY=-.5;
  assert.equal(update(176),false);assert.equal(update(192),false);assert.equal(uniforms.waterReflectionGain.value,0,'a previous capture cannot be projected onto a different water level');
  light.shadow.map=atlas;
  assert.equal(update(208),true);assert.equal(captures,2);assert.equal(uniforms.waterReflectionLevel.value,-.5);
  assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(water.visible,true);
 }finally{reflection.dispose();atlas.dispose();water.geometry.dispose();water.material.dispose();}
});

test('only visible shadow-casting lights delay a reflection',()=>{
 const scene=new THREE.Scene(),group=new THREE.Group(),light=new THREE.SpotLight();group.add(light);scene.add(group);
 assert.equal(reflectionShadowsReady(scene),true);
 light.castShadow=true;assert.equal(reflectionShadowsReady(scene),false);
 group.visible=false;assert.equal(reflectionShadowsReady(scene),true);
 group.visible=true;light.visible=false;assert.equal(reflectionShadowsReady(scene),true);
});
