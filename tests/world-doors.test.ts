import test from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {ButtonEdges} from '../app/input-actions.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {ALTAR} from '../app/shrine-goal.ts';
// CPU scene construction: real geometry and fixtures, no browser or WebGL rendering.
test('actual furnished world recognises and opens ground doors from both sides',t=>{
 // Isolate doors from enemies deliberately opening them during this test.
 t.mock.method(Enemies.prototype,'update',()=>false);t.mock.method(Enemies.prototype,'hear',()=>0);
 const addTargets=Enemies.prototype.addPatrolTargets;let actualEnemies:Enemies|undefined;
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,points:Parameters<Enemies['addPatrolTargets']>[0]){actualEnemies=this;return addTargets.call(this,points);});
 const g=globalThis as unknown as Record<string,unknown>;
 g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,1),failures:string[]=[];
 const actual=actualEnemies!,first=actual.nodes.keys().next().value!,reachable=new Set([first]),queue=[first];
 for(let i=0;i<queue.length;i++)for(const n of actual.graph.get(queue[i])??[])if(!reachable.has(n)){reachable.add(n);queue.push(n);}
 assert.equal(reachable.size,actual.nodes.size,'furniture must not isolate any ground patrol node');
 assert.equal(actual.patrolTargets.filter(t=>t.id.startsWith('room:')&&!t.id.startsWith('room:red-')&&!t.id.startsWith('room:gold-')).length,15);
 for(const d of createLayout().doors)for(const side of [-1,1]){
   const nx=d.alongX?0:side,nz=d.alongX?side:0;
   world.camera.position.set(d.x+nx*1,1.68,d.z+nz*1);world.camera.rotation.y=Math.atan2(nx,nz);
   if(!world.nearDoor())failures.push(d.id+' side '+side);
   const edge=new ButtonEdges(),button=edge.update({mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===1}))});
   assert.ok(button.interact);assert.ok(world.interact(),d.id+' input');
   for(let i=0;i<12;i++){world.burst();world.step(.05);}
   for(let i=0;i<5;i++){const pos=world.move(-nx,-nz,0,true,.05);world.camera.position.set(pos.x,pos.y,pos.z);}
   assert.ok((world.camera.position.x-d.x)*nx+(world.camera.position.z-d.z)*nz<0,d.id+' furnished passage');
   // Close from a safe distance before trying the opposite side.
   world.camera.position.set(d.x-nx*1,1.68,d.z-nz*1);world.camera.rotation.y=Math.atan2(-nx,-nz);
   assert.ok(world.interact());for(let i=0;i<12;i++){world.burst();world.step(.05);}
 }
 world.dispose();assert.deepEqual(failures,[]);
});

test('furnished random worlds collect and offer either route, then allow entry through the goal',t=>{
 const update=t.mock.method(Enemies.prototype,'update',()=>false);t.mock.method(Enemies.prototype,'hear',()=>0);
 const addTargets=Enemies.prototype.addPatrolTargets;let actualEnemies:Enemies|undefined;
 let points:Parameters<Enemies['addPatrolTargets']>[0]=[];
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:typeof points){actualEnemies=this;points=p;return addTargets.call(this,p);});
 const g=globalThis as unknown as Record<string,unknown>;
 g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 for(const [seed,color] of [[71,'blue'],[72,'red']] as const){
  const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);
  try{
   const calls=update.mock.callCount();assert.equal(world.stopTime(),true);
   const before=world.camera.position.clone();const moved=world.move(0,-1,0,false,.05);world.camera.position.set(moved.x,moved.y,moved.z);
   assert.ok(world.camera.position.distanceTo(before)>0,'player can move during stopped time');
   for(let i=0;i<200;i++)world.step(.05);
   assert.equal(update.mock.callCount(),calls,'enemy AI cannot act during the ten-second stop');
   assert.equal(world.timeStopped,false);world.step(.05);assert.ok(update.mock.callCount()>calls,'enemy AI resumes');
   const actual=actualEnemies!,start=actual.nodes.keys().next().value!,seen=new Set([start]),queue=[start];
   for(let i=0;i<queue.length;i++)for(const n of actual.graph.get(queue[i])??[])if(!seen.has(n)){seen.add(n);queue.push(n);}
   assert.equal(seen.size,actual.nodes.size,`seed ${seed}: furniture-inclusive navigation`);
   const targets=points.filter(p=>p.floor===0&&(p.id.includes('red-')===(color==='red'))).slice(0,color==='red'?1:5);
   assert.equal(targets.length,color==='red'?1:5);
   for(const p of targets){world.camera.position.set(p.position.x,1.68,p.position.z);world.step(.05);}
   assert.equal(world.collection()[color],targets.length);assert.equal(world.collection().unlocked,false);
   world.camera.position.set(world.altarPosition.x,1.68,world.altarPosition.z-2);world.camera.rotation.y=Math.PI;
   assert.equal(world.nearAltar(),true);assert.ok(Math.abs(world.goalDirection().angle)<1e-6);
   assert.equal(world.interact(),'offered');assert.equal(world.collection()[color],0);assert.equal(world.collection().unlocked,true);
   assert.equal(world.interact(),'empty','beads cannot be offered twice');
   for(let i=0;i<45;i++)world.step(.05);
   world.camera.position.set(world.goalPosition.x,1.68,world.goalPosition.z-1.5);
   for(let i=0;i<8;i++){const p=world.move(0,1,0,true,.05);world.camera.position.set(p.x,p.y,p.z);world.step(.05);}
   assert.equal(world.completed,true,`${color} route can enter the goal: ${JSON.stringify({position:world.camera.position,obstacles:world.obstacles.filter(o=>o.minX<2&&o.maxX>-2&&o.minZ<18&&o.maxZ>14)})}`);
  }finally{world.dispose();}
 }
});



test('random altar and gold route survive defeat with empty inventory and a new safe spawn',t=>{
 let defeat=false; t.mock.method(Enemies.prototype,'update',()=>defeat);t.mock.method(Enemies.prototype,'hear',()=>0);
 const addTargets=Enemies.prototype.addPatrolTargets;let points:Parameters<Enemies['addPatrolTargets']>[0]=[];let actual:Enemies;
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:typeof points){actual=this;points=p;return addTargets.call(this,p);});
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const altars=new Set<string>(),spawns=new Set<string>();
 for(const seed of [3,21,87]){const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);try{
  altars.add(JSON.stringify(w.altarPosition));const gold=points.find(p=>p.id==='room:gold-yokocho')!;assert.ok(gold);
  w.camera.position.set(gold.position.x,1.68,gold.position.z);w.step(.05);assert.equal(w.collection().gold,1);assert.equal(w.collection().area,'red');assert.ok(w.collection().areaName.includes('横丁'));
  w.camera.position.set(w.altarPosition.x,1.68,w.altarPosition.z-2);w.camera.rotation.y=Math.PI;assert.equal(w.interact(),'offered');assert.equal(w.collection().unlocked,true);
  for(let i=0;i<2;i++){const old=w.camera.position.clone();defeat=true;assert.equal(w.step(.05),true);defeat=false;const c=w.collection();assert.equal(c.gold+c.blue+c.red+c.blueOffered+c.redOffered,0);assert.equal(c.unlocked,false);assert.ok(w.camera.position.distanceTo(old)>24);assert.ok(actual!.actors.every(e=>Math.hypot(e.position.x-w.camera.position.x,e.position.z-w.camera.position.z)>24));assert.ok(!w.obstacles.some(o=>w.camera.position.x>o.minX-.5&&w.camera.position.x<o.maxX+.5&&w.camera.position.z>o.minZ-.5&&w.camera.position.z<o.maxZ+.5));spawns.add(w.camera.position.toArray().join(','));}
  w.camera.position.set(gold.position.x,1.68,gold.position.z);w.step(.05);assert.equal(w.collection().gold,1,'gold can be collected again after defeat');
 }finally{w.dispose();}}
 assert.ok(altars.size>1);assert.equal(spawns.size,6);
});
