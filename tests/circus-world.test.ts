import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {createCircusPlan} from '../app/circus-plan.ts';

test('circus world integrates riding, free look, freeze, all devices, capture and safe resets',t=>{
 Object.assign(globalThis,{innerWidth:1280,innerHeight:720,devicePixelRatio:1});
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 Object.assign(globalThis,{document:{addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})}});
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 let caught=false,hear=0;
 t.mock.method(Enemies.prototype,'update',()=>caught);t.mock.method(Enemies.prototype,'hear',()=>++hear);
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,17,'circus'),plan=createCircusPlan(17,w.layout);
 const face=(from:{x:number;z:number},to:{x:number;z:number})=>{w.camera.position.set(from.x,1.68,from.z);w.camera.rotation.set(0,Math.atan2(from.x-to.x,from.z-to.z),0);};
 try{
  w.setMode('gallery');face(plan.stations[0].exit,plan.stations[0].position);assert.match(w.mechanismNear(),/乗車/);w.interact();assert.ok(w.riding);
  const yaw=.45;w.camera.rotation.y=yaw;w.flashlight.visible=false;
  for(let i=0;i<200;i++){const p=w.move(1,-1,yaw,true,.016);assert.equal(p.running,false);w.camera.position.set(p.x,p.y,p.z);w.step(.016);}
  assert.equal(w.camera.rotation.y,yaw);assert.equal(w.flashlight.visible,false);assert.ok(w.circusStatus()!.distance>5);assert.ok(w.riding);
  w.setMode('normal');assert.equal(w.riding,false);face(plan.stations[0].exit,plan.stations[0].position);w.interact();assert.ok(w.riding);assert.ok(w.stopTime());const d=w.circusStatus()!.distance;
  for(let i=0;i<40;i++)w.step(.05);assert.equal(w.circusStatus()!.distance,d);assert.ok(w.timeStopped);
  for(let i=0;i<240;i++)w.step(.05);assert.ok(w.circusStatus()!.distance>d);
  assert.notEqual(w.burst(),null,'R2 remains available during a ride');
  caught=true;w.step(.016);assert.equal(w.riding,false);assert.equal(w.circusStatus()!.moving,false);assert.equal(w.collection().blue,0);assert.equal(w.camera.position.y,1.68);caught=false;
  w.setMode('gallery');
  for(const device of plan.devices){face(device.control,device.position);assert.match(w.mechanismNear(),new RegExp(device.name));w.interact();for(let i=0;i<240;i++)w.step(.016);assert.equal(w.circusStatus()!.devices.find(s=>s.id===device.id)!.progress,1);}
  w.setMode('normal');const lure=plan.devices.find(d=>d.kind==='lure')!;face(lure.control,lure.position);w.interact();w.step(.016);assert.equal(hear,1);w.step(.016);assert.equal(hear,1);
  w.setMode('gallery');assert.ok(w.circusStatus()!.devices.every(d=>d.progress===0));
 }finally{w.dispose();}
});
