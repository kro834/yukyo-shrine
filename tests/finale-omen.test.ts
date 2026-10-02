import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies,Doors,WAKE_TURN_SECONDS} from '../app/shrine-gameplay.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';

// The pursuer is built from the first regular actor's record: a sleeper's turn-in-place
// timer must not leak into it, or the omen would stall and the boss would face a corridor.
test('a finale that begins right after the first actor wakes keeps a clean omen: no wake turn, the countdown runs and the boss faces the visitor',t=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const add=Enemies.prototype.addPatrolTargets;let enemies:Enemies|undefined,points:Parameters<Enemies['addPatrolTargets']>[0]=[];
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:typeof points){enemies=this;points=p;return add.call(this,p);});
 t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,17);
 try{
  w.setMode('normal');assert.ok(enemies);const first=enemies.actors[0];
  assert.equal(first.dormant,true,'seed 17 puts the first actor among the sleepers');
  enemies.wake(first);assert.equal(first.wakeTurn,WAKE_TURN_SECONDS);
  const gold=points.find(p=>p.id==='room:gold-yokocho');assert.ok(gold);
  w.camera.position.set(gold.position.x,1.68,gold.position.z);assert.equal(w.step(.05),false);
  assert.ok(w.finale);const boss=enemies.actors[0];assert.equal(enemies.actors.length,1);
  assert.equal(boss.wakeTurn,0,'the boss does not inherit the sleeper\'s wake turn');assert.equal(boss.alertSource,undefined);
  const facing=boss.facing,bearing=Math.atan2(w.camera.position.x-boss.home.x,w.camera.position.z-boss.home.z);
  assert.ok(Math.abs(facing-bearing)<1e-9,'the boss is spawned facing the visitor');
  const before=w.omenRemaining();assert.ok(before>5.9&&before<=6);
  for(let i=0;i<10;i++)assert.equal(w.step(.05),false);
  assert.ok(Math.abs(before-w.omenRemaining()-.5)<1e-6,'the omen counts down from the first live frame');
  assert.equal(boss.facing,facing,'the boss keeps facing the visitor through the omen');
 }finally{w.dispose();}
});
