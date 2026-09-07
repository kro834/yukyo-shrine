import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ContactOcclusion} from '../app/contact-occlusion.ts';

test('normal depth sees opaque cloth from behind without inventing backs for one-sided surfaces',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),geometry=new THREE.PlaneGeometry(2,2);
 const clothMaterial=new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),frontMaterial=new THREE.MeshStandardMaterial({side:THREE.FrontSide});
 const cloth=new THREE.Mesh(geometry,clothMaterial),front=new THREE.Mesh(geometry,frontMaterial);front.position.x=3;scene.add(cloth,front);scene.updateMatrixWorld(true);
 const pass=new ContactOcclusion(scene,camera,320,180),target=new THREE.WebGLRenderTarget(8,8),variants=new Set<THREE.Material>();
 let renders=0,fail=false,color=new THREE.Color('#112233'),alpha=.3;
 const renderer={autoClear:true,getClearColor:(v:THREE.Color)=>v.copy(color),getClearAlpha:()=>alpha,setClearColor:(v:THREE.ColorRepresentation,a:number)=>{color.set(v);alpha=a;},setRenderTarget(){},clear(){},render(){
  renders++;assert.equal(scene.overrideMaterial,null);
  for(const mesh of [cloth,front]){assert.ok(mesh.material instanceof THREE.MeshNormalMaterial);variants.add(mesh.material);}
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,0,-2),new THREE.Vector3(0,0,1)).intersectObject(cloth).length>0,'cloth must occupy the depth buffer instead of the room behind it');
  assert.equal(new THREE.Raycaster(new THREE.Vector3(3,0,-2),new THREE.Vector3(0,0,1)).intersectObject(front).length,0,'an invisible back face must not produce contact shadows');
  if(fail)throw new Error('GPU failure');
 }} as unknown as THREE.WebGLRenderer;
 const render=()=>pass._renderOverride(renderer,pass.normalMaterial,target,0x7777ff,1);
 render();fail=true;assert.throws(render,/GPU failure/);
 assert.equal(renders,2);assert.equal(variants.size,2,'variants are reused between frames');
 assert.equal(cloth.material,clothMaterial);assert.equal(front.material,frontMaterial);assert.equal(renderer.autoClear,true);assert.equal(alpha,.3);assert.equal(color.getHexString(),'112233');
 let released=0;for(const material of variants)material.addEventListener('dispose',()=>released++);
 pass.dispose();assert.equal(released,2);pass.ssaoMaterial.dispose();pass.noiseTexture.dispose();target.dispose();geometry.dispose();clothMaterial.dispose();frontMaterial.dispose();
});
