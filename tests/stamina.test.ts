import test from 'node:test';import assert from 'node:assert/strict';
import type * as THREE from 'three';
import {Stamina} from '../app/stamina.ts';
import {sanitizePreferences,DEFAULTS} from '../app/preferences.ts';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {SPRINT_SPEED,WALK_SPEED} from '../app/movement.ts';
test('stamina defaults off and migrates old preferences safely',()=>{
 assert.equal(DEFAULTS.stamina,false);assert.equal(sanitizePreferences({quality:'high'}).stamina,false);
 assert.equal(sanitizePreferences({stamina:'true'}).stamina,false);assert.equal(sanitizePreferences({stamina:true}).stamina,true);
 const s=new Stamina();for(let i=0;i<1200;i++)s.step(.01,true,true,true);assert.equal(s.value,1);assert.equal(s.canSprint,true);
});
test('eight seconds of actual running exhausts equally across frame rates; blocked intent cannot drain',()=>{
 for(const dt of [.01,.05]){const s=new Stamina();s.setEnabled(true);for(let t=0;t<8-dt/2;t+=dt)s.step(dt,true,true,s.canSprint);assert.equal(s.value,0);assert.equal(s.canSprint,false);}
 const s=new Stamina();s.setEnabled(true);for(let i=0;i<200;i++)s.step(.05,true,false,false);assert.equal(s.value,1);
});
test('held sprint never cycles automatically, while early release and touch stop are remembered',()=>{
 for(const acknowledgement of ['release','stop']){
  const s=new Stamina();s.setEnabled(true);for(let i=0;i<160;i++)s.step(.05,true,true,true);
  s.step(.05,acknowledgement!=='release',acknowledgement!=='stop',false);
  assert.equal(s.canSprint,false);for(let i=0;i<50;i++)s.step(.05,true,true,false);assert.equal(s.canSprint,true);
 }
 const held=new Stamina();held.setEnabled(true);for(let i=0;i<160;i++)held.step(.05,true,true,true);
 for(let i=0;i<100;i++)held.step(.05,true,true,false);assert.ok(held.value>.25);assert.equal(held.canSprint,false);
 held.step(.05,true,false,false);assert.equal(held.canSprint,true);held.setEnabled(false);assert.equal(held.value,1);assert.equal(held.exhausted,false);
});
test('world uses actual stamina-limited movement for speed, darkness and footsteps; option and death take effect immediately',t=>{
 let caught=false;const sight:boolean[]=[];
 t.mock.method(Enemies.prototype,'update',(_dt:number,_p:unknown,_walls:unknown,_floor:unknown,_upper:unknown,detectable:boolean)=>{sight.push(detectable);return caught;});
 const hearing=t.mock.method(Enemies.prototype,'hear',()=>0);
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,1);
 try {
  world.configure({...DEFAULTS,quality:'low',stamina:true});world.flashlight.visible=false;
  for(let i=0;i<160;i++){world.camera.position.set(0,1.68,5);const p=world.move(0,-1,0,true,.05);assert.ok(p.running);world.camera.position.set(p.x,p.y,p.z);world.step(.05);}
  assert.equal(world.staminaStatus().exhausted,true);const heard=hearing.mock.callCount();
  for(let i=0;i<20;i++){world.camera.position.set(0,1.68,5);const p=world.move(0,-1,0,true,.05);assert.equal(p.running,false);assert.ok(Math.abs(5-p.z-WALK_SPEED*.05)<1e-6);world.camera.position.set(p.x,p.y,p.z);world.step(.05);assert.equal(sight.at(-1),false);}
  assert.equal(hearing.mock.callCount(),heard);
  world.configure({...DEFAULTS,quality:'low',stamina:false});world.camera.position.set(0,1.68,5);const p=world.move(0,-1,0,true,.05);assert.ok(p.running);assert.ok(Math.abs(5-p.z-SPRINT_SPEED*.05)<1e-6);
  world.configure({...DEFAULTS,quality:'low',stamina:true});for(let i=0;i<20;i++){world.camera.position.set(0,1.68,5);world.move(0,-1,0,true,.05);}assert.ok(world.staminaStatus().value<1);
  caught=true;world.step(.05);assert.equal(world.staminaStatus().value,1);assert.equal(world.staminaStatus().exhausted,false);
 }finally{world.dispose();}
});
