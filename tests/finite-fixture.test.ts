import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finiteFixture,FIXTURE_RADIUS,pendingFixtureFinish} from '../app/finite-fixture.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';
import {FixtureShadow} from '../app/fixture-shadow.ts';

const fragment=(material:THREE.MeshStandardMaterial)=>{
 const shader={fragmentShader:THREE.ShaderLib.standard.fragmentShader,vertexShader:THREE.ShaderLib.standard.vertexShader,uniforms:{}};
 material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as THREE.WebGLRenderer);return shader.fragmentShader;
};
test('finite fixture shading survives quality switches and late maps without accumulating wrappers',()=>{
 const callbacks=new Map<string,(texture:THREE.Texture)=>void>(),loader={load(url:string,cb:(t:THREE.Texture)=>void){callbacks.set(url,cb);return new THREE.Texture();}} as THREE.TextureLoader;
 const previous=globalThis.document;
 Object.assign(globalThis,{document:{createElement:()=>({getContext:()=>({drawImage(){}})})}});
 const material=new THREE.MeshStandardMaterial(),library=new SurfaceLibrary([material],4,loader);
 library.setLightingFinish(finiteFixture);library.add('albedo',[material],{normal:'normal'});
 try{
  for(const quality of ['high','low','ultra','low','high'] as const){
   library.setQuality(quality);callbacks.get('albedo')!(new THREE.Texture({}));callbacks.get('normal')?.(new THREE.Texture({}));
   const source=fragment(material),key=material.customProgramCacheKey(),version=material.version;
   assert.equal(source.split('sqrt( lightDistance * lightDistance +').length,2);
   assert.ok(source.includes('getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay )'),'flashlight falloff remains unmodified');
   assert.ok(source.includes('getDistanceAttenuation( sqrt( lightDistance * lightDistance + 0.0576 )'));
   finiteFixture(material);assert.equal(material.version,version);assert.equal(material.customProgramCacheKey(),key);
  }
 }finally{library.dispose();material.dispose();Object.assign(globalThis,{document:previous});}
});
test('finite-source falloff stays bounded at contact and converges to the existing inverse-square field',()=>{
 const falloff=(d:number)=>1/(d*d+FIXTURE_RADIUS*FIXTURE_RADIUS);
 assert.ok(Number.isFinite(falloff(0))&&falloff(0)<18);
 assert.ok(falloff(.05)<falloff(0));assert.ok(falloff(.25)<falloff(.05));
 assert.ok(Math.abs(falloff(2)/.25-1)<.015,'room-scale illumination differs by less than 1.5 percent');
});
test('fixture shadow transfer respects a small lamp power instead of restoring full-size output',()=>{
 const shadow=new FixtureShadow(new THREE.Scene()),lamp={id:1,position:{x:0,y:2.5,z:0},shadowPosition:{x:0,y:2.2,z:0},floor:0,color:'#fff',power:2.2};
 shadow.configure('ultra',false);
 for(let i=0;i<30;i++)shadow.update([{current:lamp,target:lamp,gain:1}],new THREE.Vector3(0,1.68,2),.02,i*20,false);
 assert.ok(Math.abs(shadow.light.intensity-1.65)<1e-8);shadow.dispose();
});

test('disposing a world cancels late scene access while live model completion receives lighting',async()=>{
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
 let resolve!:()=>void;const ready=new Promise<void>(r=>resolve=r),pending=pendingFixtureFinish(ready,scene),before=material.onBeforeCompile;
 pending.cancel();resolve();await pending.ready;assert.equal(material.onBeforeCompile,before);
 await pendingFixtureFinish(Promise.resolve(),scene).ready;assert.notEqual(material.onBeforeCompile,before);
 scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});material.dispose();
});
