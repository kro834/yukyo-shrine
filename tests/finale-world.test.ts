import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';

test('finale inventory, freeze, threat and death reset remain synchronized in the running world',t=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const add=Enemies.prototype.addPatrolTargets;let enemies:Enemies,points:Parameters<Enemies['addPatrolTargets']>[0]=[],forceCapture=false,calls=0;
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:typeof points){enemies=this;points=p;return add.call(this,p);});
 t.mock.method(Enemies.prototype,'update',()=>{calls++;return forceCapture;});
 t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,17);
 try{
  w.setMode('normal');const gold=points.find(p=>p.floor===0&&p.id.includes('gold-'))!;
  assert.ok(gold);w.camera.position.set(gold.position.x,1.68,gold.position.z);w.step(.05);
  assert.ok(w.finale);assert.equal(enemies!.actors.length,1);assert.equal(w.mirrorStatus().count,2);
  const boss=enemies!.actors[0];boss.brain.mode='chase';w.step(.05);assert.equal(w.runStatus().pressure,1);
  assert.equal(w.useMirror(),true);assert.equal(w.mirrorStatus().count,1);
  assert.equal(w.stopTime(),true);const beforeCalls=calls,position={...boss.position};
  for(let i=0;i<199;i++)w.step(.05);
  assert.equal(calls,beforeCalls);assert.deepEqual(boss.position,position);assert.equal(w.runStatus().state,'frozen');assert.equal(w.runStatus().pressure,0);
  w.step(.06);assert.equal(calls,beforeCalls+1);assert.equal(w.runStatus().state,'chase');assert.equal(w.mirrorStatus().count,1);
  boss.brain.stun();w.step(.05);assert.equal(w.runStatus().state,'stunned');assert.equal(w.runStatus().pressure,0);
  forceCapture=true;w.step(.05);assert.equal(w.finale,null);assert.equal(enemies!.actors.length,12);assert.equal(w.phaseRevision,2);
  const counts=w.collection();assert.equal(counts.blue+counts.red+counts.gold+counts.blueOffered+counts.redOffered,0);
  assert.deepEqual(w.mirrorStatus(),{count:0,remaining:0});assert.equal(w.runStatus().pressure,0);assert.equal(w.runStatus().state,'quiet');assert.equal(w.runStatus().deaths,1);
  forceCapture=false;w.step(.05);assert.equal(w.mirrorStatus().count,0);assert.equal(w.phaseRevision,2);
 }finally{w.dispose();}
});
