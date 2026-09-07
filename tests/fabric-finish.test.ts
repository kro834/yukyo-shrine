import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fabricFinish} from '../app/fabric-finish.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';

test('linen keeps its measured dark or pale base reflectance on Low and after asynchronous relief loading',()=>{
 const callbacks=new Map<string,(t:THREE.Texture)=>void>(),loader={load(url:string,cb:(t:THREE.Texture)=>void){callbacks.set(url,cb);return new THREE.Texture();}} as THREE.TextureLoader;
 (globalThis as unknown as Record<string,unknown>).document={createElement:()=>({getContext:()=>({drawImage(){}})})};
 const dark=new THREE.MeshStandardMaterial(),pale=new THREE.MeshStandardMaterial();fabricFinish(dark);fabricFinish(pale,true);
 const lib=new SurfaceLibrary([dark,pale],4,loader);lib.preserveBaseFinish(dark,pale);lib.add('hemp',[dark,pale],{bump:.0015});callbacks.get('hemp')!(new THREE.Texture({}));
 for(const q of ['low','ultra','medium','low'] as const){
  lib.setQuality(q);assert.equal(dark.color.getHexString(),'4e4a43');assert.equal(pale.color.getHexString(),'bdb6a5');
  for(const m of [dark,pale]){const shader={fragmentShader:THREE.ShaderLib.standard.fragmentShader,vertexShader:THREE.ShaderLib.standard.vertexShader,uniforms:{}};m.onBeforeCompile(shader as Parameters<typeof m.onBeforeCompile>[0],{} as THREE.WebGLRenderer);assert.ok(shader.fragmentShader.includes('weaveVariation'));assert.equal(shader.fragmentShader.match(/texture2D\(map,vMapUv\)/g)?.length,1);assert.equal(!!m.bumpMap,q==='ultra');}
 }
 lib.dispose();dark.dispose();pale.dispose();
});
