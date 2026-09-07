import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FixtureShadow} from '../app/fixture-shadow.ts';
import type {LightFixture} from '../app/fixture-lighting.ts';
const lamp=(id:number,x:number):LightFixture=>({id,position:{x,y:2.7,z:0},floor:0,color:'#ffc184',shadowPosition:{x,y:2.48,z:0}});
const slot=(f:LightFixture)=>({current:f,target:f,gain:1});

test('fixture shadow fades before changing lamp, ignores distance jitter, and restores point lights on downgrade',()=>{
 const scene=new THREE.Scene(),shadow=new FixtureShadow(scene),a=lamp(1,-2),b=lamp(2,2),slots=[slot(a),slot(b)];shadow.configure('ultra',false);
 let time=0;const step=(x:number)=>shadow.update(slots,new THREE.Vector3(x,1.68,0),.02,time+=20,false);
 for(let i=0;i<30;i++)step(-.1);assert.equal(shadow.light.position.x,-2);assert.ok(shadow.light.intensity>0);assert.ok(shadow.pointGain(1)<.3);assert.equal(shadow.pointGain(2),1);
 for(let i=0;i<10;i++)step(.1);assert.equal(shadow.light.position.x,-2);
 for(let i=0;i<30;i++){const previous:number=shadow.light.position.x;step(1.5);if(previous!==shadow.light.position.x)assert.equal(shadow.light.intensity,0);}
 assert.equal(shadow.light.position.x,2);assert.ok(shadow.light.intensity>0);assert.equal(shadow.pointGain(1),1);assert.ok(shadow.pointGain(2)<.3);
 shadow.light.shadow.map=new THREE.WebGLRenderTarget(8,8);let disposed=0;shadow.light.shadow.map.addEventListener('dispose',()=>disposed++);
 shadow.configure('medium',false);assert.equal(disposed,1);assert.equal(shadow.light.shadow.map,null);assert.equal(shadow.pointGain(2),1);assert.equal(shadow.light.visible,false);assert.equal(shadow.light.castShadow,false);
 shadow.dispose();assert.equal(scene.children.length,0);
});

test('static fixture shadows are cached while moving doors and actors refresh; unsupported modes create no shadow map',()=>{
 const shadow=new FixtureShadow(new THREE.Scene()),slots=[slot(lamp(1,0))],viewer=new THREE.Vector3(0,1.68,3);
 for(const [quality,mobile] of [['low',false],['medium',false],['high',true],['ultra',true]] as const){shadow.configure(quality,mobile);shadow.update(slots,viewer,.02,20,true);assert.equal(shadow.light.visible,false);assert.equal(shadow.light.shadow.map,null);}
 shadow.configure('high',false);for(let i=0;i<30;i++)shadow.update(slots,viewer,.02,i*20,false);
 assert.equal(shadow.light.shadow.needsUpdate,false);shadow.update(slots,viewer,.04,650,true);assert.equal(shadow.light.shadow.needsUpdate,true);
 shadow.update(slots,viewer,.04,690,false);assert.equal(shadow.light.shadow.needsUpdate,true);shadow.update(slots,viewer,.04,730,false);assert.equal(shadow.light.shadow.needsUpdate,false);
 assert.equal(shadow.light.shadow.camera.up.z,-1);assert.equal(shadow.light.shadow.mapSize.x,512);shadow.dispose();
});

test('an unowned fixture never exposes an uninitialized PCF shadow sampler',()=>{
 const shadow=new FixtureShadow(new THREE.Scene()),viewer=new THREE.Vector3(0,1.68,3);
 for(const quality of ['high','ultra'] as const){
  shadow.configure(quality,false);assert.equal(shadow.light.visible,false);
  shadow.update([],viewer,.016,100,false);assert.equal(shadow.light.visible,false);assert.equal(shadow.light.shadow.map,null);
  const slots=[slot(lamp(1,0))];shadow.update(slots,viewer,.016,120,false);shadow.update(slots,viewer,.016,140,false);
  assert.equal(shadow.light.visible,true);assert.equal(shadow.light.shadow.needsUpdate,true);
  for(let i=0;i<30;i++)shadow.update([],viewer,.02,160+i*20,false);
  assert.equal(shadow.light.visible,false);
 }
 shadow.dispose();
});
