import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FixtureLighting,type LightFixture} from '../app/fixture-lighting.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';
import {agedFinish,type SurfaceFinish} from '../app/surface-finish.ts';

const fixture=(id:number,x:number,z=0,floor=0):LightFixture=>({id,position:{x,y:floor+2.2,z},floor,color:'#ffc184'});
const settle=(lights:FixtureLighting)=>{for(let i=0;i<30;i++)lights.step(.02);};
test('fixtures behind closed doors and on other storeys cannot light the room; reopening a door restores its lamp',()=>{
 const lighting=new FixtureLighting(),viewer={x:0,y:1.68,z:0},lamps=[fixture(1,2),fixture(2,-2),fixture(3,0,0,4.8)],wall={minX:.9,maxX:1.1,minZ:-1,maxZ:1,maxY:3.6};
 lighting.select(viewer,0,lamps,[wall],6);settle(lighting);assert.deepEqual(lighting.slots.filter(s=>s.gain>0).map(s=>s.current!.id),[2]);
 lighting.select(viewer,0,lamps,[],6);settle(lighting);assert.deepEqual(lighting.slots.filter(s=>s.gain>0).map(s=>s.current!.id).sort(),[1,2]);
 lighting.select({...viewer,y:6.48},4.8,lamps,[],6);settle(lighting);assert.deepEqual(lighting.slots.filter(s=>s.gain>0).map(s=>s.current!.id),[3]);
});
test('pooled lights hold their fixtures near distance ties and fade out before moving',()=>{
 const lighting=new FixtureLighting(),lamps=[fixture(1,-3),fixture(2,3)];lighting.select({x:-.1,y:1.68,z:0},0,lamps,[],1);settle(lighting);
 lighting.select({x:.1,y:1.68,z:0},0,lamps,[],1);assert.equal(lighting.slots[0].target!.id,1);
 lighting.select({x:2,y:1.68,z:0},0,lamps,[],1);assert.equal(lighting.slots[0].target!.id,2);lighting.step(.05);assert.equal(lighting.slots[0].current!.id,1);assert.ok(lighting.slots[0].gain<1);
 for(let i=0;i<20;i++){const old=lighting.slots[0].current;lighting.step(.02);if(old!==lighting.slots[0].current)assert.equal(lighting.slots[0].gain,0);}
 settle(lighting);assert.equal(lighting.slots[0].current!.id,2);assert.equal(lighting.slots[0].gain,1);
});
test('switching from six High lights to three Low lights moves retained fixtures into visible slots',()=>{
 const lighting=new FixtureLighting(),lamps=Array.from({length:6},(_,i)=>fixture(i,i*2-5));lighting.select({x:-5,y:1.68,z:0},0,lamps,[],6);settle(lighting);
 lighting.select({x:5,y:1.68,z:0},0,lamps,[],3);settle(lighting);assert.equal(lighting.slots.slice(0,3).filter(s=>s.gain===1).length,3);assert.ok(lighting.slots.slice(3).every(s=>s.target===null&&s.gain===0));
});
test('a cluster of hidden fixtures does not crowd a visible lamp out of the selection',()=>{
 const lighting=new FixtureLighting(),lamps=[...Array.from({length:24},(_,i)=>fixture(i,2,i*.01)),fixture(25,-5)];
 lighting.select({x:0,y:1.68,z:0},0,lamps,[{minX:.9,maxX:1.1,minZ:-1,maxZ:1,maxY:4}],3);settle(lighting);
 assert.deepEqual(lighting.slots.filter(s=>s.gain>0).map(s=>s.current!.id),[25]);
});
test('photographic finish and normal strength survive async maps; Low removes detail and unchanged selections avoid shader invalidation',()=>{
 const callbacks=new Map<string,(t:THREE.Texture)=>void>(),loader={load(url:string,callback:(t:THREE.Texture)=>void){callbacks.set(url,callback);return new THREE.Texture();}} as THREE.TextureLoader;
 const g=globalThis as unknown as Record<string,unknown>;g.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})};
 const material=new THREE.MeshStandardMaterial();agedFinish(material,'stone');const finish=material.onBeforeCompile,lib=new SurfaceLibrary([material],8,loader);
 lib.add('diff',[material],{normal:'normal',roughness:'rough',metalness:'metal',preserveFinish:true,normalStrength:.6});callbacks.get('diff')!(new THREE.Texture({}));lib.setQuality('high');assert.equal(material.onBeforeCompile,finish);
 const version=material.version;lib.setQuality('high');assert.equal(material.version,version);callbacks.get('normal')!(new THREE.Texture({}));assert.deepEqual(material.normalScale.toArray(),[.6,.6]);assert.ok(material.normalMap);
 lib.setQuality('low');callbacks.get('rough')!(new THREE.Texture({}));callbacks.get('metal')!(new THREE.Texture({}));assert.equal(material.normalMap,null);assert.equal(material.roughnessMap,null);assert.equal(material.metalnessMap,null);assert.notEqual(material.onBeforeCompile,finish);
 lib.setQuality('high');assert.equal(material.onBeforeCompile,finish);assert.ok(material.roughnessMap);assert.ok(material.metalnessMap);lib.dispose();
});
test('all material finishes compose with Three standard shader and preserve native PBR stages',()=>{
 for(const kind of ['tatami','paper','plaster','lacquer','stone','tile','wood'] as SurfaceFinish[]){const m=new THREE.MeshStandardMaterial();agedFinish(m,kind);const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader as Parameters<typeof m.onBeforeCompile>[0],{} as THREE.WebGLRenderer);
  assert.ok(shader.vertexShader.includes('agedPosition=transformed;'));assert.ok(!shader.fragmentShader.includes('mod('));
  for(const include of ['roughnessmap_fragment','normal_fragment_maps','metalnessmap_fragment'])assert.equal(shader.fragmentShader.split('#include <'+include+'>').length,2);
  assert.ok(shader.fragmentShader.indexOf('roughnessFactor=clamp')>shader.fragmentShader.indexOf('#include <roughnessmap_fragment>'));assert.ok(shader.fragmentShader.includes('fwidth(p.x)'));assert.ok(shader.fragmentShader.includes('fwidth(p.y)'));
 }
});
