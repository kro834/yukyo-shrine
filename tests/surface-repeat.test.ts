import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SurfaceLibrary} from '../app/surface-library.ts';

test('physical texture scale remains identical through delayed detail loads and quality changes',()=>{
 const callbacks=new Map<string,(t:THREE.Texture)=>void>();
 const loader={load(url:string,fn:(t:THREE.Texture)=>void){callbacks.set(url,fn);return new THREE.Texture();}} as THREE.TextureLoader;
 Object.assign(globalThis,{document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})}});
 const material=new THREE.MeshStandardMaterial(),library=new SurfaceLibrary([material],8,loader),repeat:[number,number]=[1/.2707081393,1/.271299988];
 library.add('albedo',[material],{repeat,normal:'normal',roughness:'rough',ultra:{full:'ultra',normal:'ultraNormal',roughness:'ultraRough'}});
 const supply=(key:string)=>callbacks.get(key)!(new THREE.Texture({}));
 const inspect=()=>{for(const m of [material.map,material.normalMap,material.roughnessMap])if(m)assert.deepEqual(m.repeat.toArray(),repeat);};
 supply('albedo');inspect();assert.equal((material.map!.image as HTMLCanvasElement).width,256);assert.equal(material.map!.anisotropy,2);library.setQuality('ultra');supply('ultra');supply('normal');inspect();
 library.setQuality('low');supply('ultraNormal');supply('ultraRough');supply('rough');inspect();assert.equal(material.normalMap,null);assert.equal(material.roughnessMap,null);
 library.setQuality('ultra');inspect();assert.ok(material.normalMap&&material.roughnessMap);
 library.setQuality('high');inspect();library.dispose();material.dispose();
});

