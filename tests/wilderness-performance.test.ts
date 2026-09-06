import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Doors,Enemies,EnemyBrain} from '../app/shrine-gameplay.ts';
import {flashHits,lightBlocked} from '../app/flash-visibility.ts';
import {BurstInput} from '../app/burst-input.ts';
import {BurstRecharge} from '../app/burst-recharge.ts';
import {ButtonEdges} from '../app/input-actions.ts';
import {PerformanceBudget,simulationSteps} from '../app/performance-budget.ts';
import {movePlayer} from '../app/movement.ts';
import {STAIR_LIGHT_VOLUMES} from '../app/stair-light.ts';
import {TimeStop} from '../app/time-stop.ts';
import {viewDelta} from '../app/view-controls.ts';
import {DEFAULTS} from '../app/preferences.ts';

test('cave and paddy circuits have distinct entrances and the market grows by more than half',()=>{
 for(const seed of [0,42,997,0xffffffff]){
  const l=createLayout(seed),doors=new Doors(l.doors),nav=new Enemies(l.cells,[...l.obstacles,...doors.frames]);
  assert.ok(l.cells.filter(c=>c.kind==='shop').length>=130);
  assert.ok(l.cells.filter(c=>c.kind==='cave').length>160);
  assert.ok(l.cells.filter(c=>c.kind==='field').length>200);
  for(const key of ['-46,-9','-27,-9','-25,1','-25,5','27,-8','46,-8','25,1','25,7'])assert.ok(l.grid.has(key),'entrance '+key);
  const first=nav.nodes.keys().next().value!,seen=new Set([first]),queue=[first];
  for(let i=0;i<queue.length;i++)for(const n of nav.graph.get(queue[i])??[])if(!seen.has(n)){seen.add(n);queue.push(n);}
  assert.equal(seen.size,nav.nodes.size,'new wings remain in one connected network');
  for(const p of l.paddies)for(let x=p.x1;x<=p.x2;x++)for(let z=p.z1;z<=p.z2;z++)assert.equal(l.grid.has(x+','+z),false,'random passages cannot cross submerged fields');
  assert.equal(l.paddies.length,6);
  assert.ok(l.walls.some(w=>w.kind==='field'&&w.h<1),'low paddy berms');
 }
});

test('flash reaches visible head, low furniture and same-stair targets, but cannot penetrate walls or floors',()=>{
 const origin={x:0,y:1.68,z:0},target={x:0,z:-4};
 assert.equal(flashHits(origin,{x:0,z:-1},0,0,0,Math.PI/3,[]),true,'visible head at steep upward pitch');
 assert.equal(flashHits(origin,target,0,1.2,0,0,[]),true,'nearby target further up a stair');
 const low={minX:-2,maxX:2,minZ:-3,maxZ:-2,maxY:.9};
 assert.equal(flashHits(origin,target,0,0,0,0,[low]),true,'low furniture does not hide a visible upper body');
 assert.equal(flashHits(origin,target,0,0,0,0,[{...low,maxY:3.4}]),false,'solid wall still blocks the flash');
 assert.equal(flashHits(origin,target,0,4.8,0,0,[]),false,'cannot flash through the upper floor');
 assert.equal(flashHits(origin,{x:0,z:4},0,0,0,0,[]),false,'rear is outside the forward cone');
 assert.equal(flashHits(origin,{x:0,z:-10.1},0,0,0,0,[]),false,'range remains ten metres');
 assert.equal(lightBlocked(origin,{x:0,y:1.68,z:-4},[low]),false);
 assert.equal(lightBlocked({x:0,y:.5,z:0},{x:0,y:.5,z:-4},[low]),true);
 assert.equal(flashHits({x:52,y:4.56,z:18},{x:52,z:27.5},2.88,0,Math.PI,0,STAIR_LIGHT_VOLUMES),false,'solid stair treads block a ground target beyond them');
 assert.equal(flashHits({x:52,y:4.56,z:18},{x:52,z:22},2.88,3.84,Math.PI,0,STAIR_LIGHT_VOLUMES),true,'visible target on the same staircase remains hittable');
});

test('partial R2 trigger presses fire once with hysteresis; released triggers can fire again',()=>{
 const edges=new ButtonEdges(),pad=(value:number)=>({mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:false,value:i===7?value:0}))});
 assert.equal(edges.update(pad(.2)).burst,false);assert.equal(edges.update(pad(.3)).burst,true);
 assert.equal(edges.update(pad(.23)).burst,false);assert.equal(edges.update(pad(.7)).burst,false);
 edges.update(pad(.1));assert.equal(edges.update(pad(.3)).burst,true);
});

test('brief input buffer bridges recharge completion but never queues a distant or repeated flash',()=>{
 const input=new BurstInput();input.request(1000);assert.equal(input.consume(1030,.1),null);
 assert.equal(input.consume(1100,0),'fire');assert.equal(input.consume(1120,0),null);
 input.request(1200);assert.equal(input.consume(1400,0),'expired');assert.equal(input.consume(1450,0),null);
 input.request(1500);input.clear();assert.equal(input.consume(1510,0),null,'pausing clears queued input');
});

test('phone graphics stay within a pixel budget, reduce sustained lag and recover gradually',()=>{
 const phone=new PerformanceBudget({touch:true,cores:4,memory:2}),desktop=new PerformanceBudget({touch:false,cores:12,memory:16});
 assert.equal(phone.quality('medium'),'low');assert.equal(desktop.quality('medium'),'medium');
 const ratio=phone.pixelRatio('medium',1170,2532,3);assert.ok(ratio<1);assert.ok(1170*2532*ratio**2<=700001);
 for(let i=0;i<180;i++)phone.observe(50);assert.ok(phone.scale<1);assert.ok(phone.scale>=.6);
 const slow=phone.scale;for(let i=0;i<900;i++)phone.observe(16);assert.ok(phone.scale>slow);assert.ok(phone.scale<=1);
 const before=phone.scale;for(let i=0;i<10;i++)phone.observe(5000,false);assert.equal(phone.scale,before,'background tabs do not degrade the budget');
 assert.equal(desktop.pixelRatio('medium',1280,720,2),1.5);
});

test('ten-fps simulation retains sprint distance and wall collision and expires stun after nine seconds',()=>{
 const brain=new EnemyBrain();brain.stun();const recharge=new BurstRecharge();recharge.use();let pos={x:0,z:0};
 for(let frame=0;frame<90;frame++){
  const steps=simulationSteps(.1);assert.ok(steps.dt<=.05);
  for(let i=0;i<steps.count;i++){brain.update(steps.dt,false,{x:0,z:0});recharge.step(steps.dt);pos=movePlayer(pos,1,0,0,true,steps.dt,[]);}
 }
 assert.equal(brain.stunRemaining,0);assert.ok(Math.abs(recharge.remaining-5)<1e-6);assert.ok(Math.abs(pos.x-9.2*9)<1e-6);
 let blocked={x:0,z:0};const steps=simulationSteps(.15);
 for(let i=0;i<steps.count;i++)blocked=movePlayer(blocked,1,0,0,true,steps.dt,[{minX:.9,maxX:1.1,minZ:-5,maxZ:5}]);
 assert.ok(blocked.x<.5);assert.equal(simulationSteps(10).dt*simulationSteps(10).count,.15,'resuming cannot cause a long catch-up teleport');
 const fast=viewDelta('gamepad',1,1,1/60,DEFAULTS),slow=viewDelta('gamepad',1,1,.1,DEFAULTS);
 assert.ok(Math.abs(fast.yaw*60-slow.yaw*10)<1e-6);assert.ok(Math.abs(fast.pitch*60-slow.pitch*10)<1e-6);
});

test('L2 stops enemy time for ten seconds and cannot be stacked or held to restart',()=>{
 const stop=new TimeStop();assert.equal(stop.use(),true);assert.equal(stop.use(),false);
 const brain=new EnemyBrain();brain.stun();let enemySeconds=0;
 for(let i=0;i<99;i++){const live=stop.step(.1);enemySeconds+=live;brain.update(live,false,{x:0,z:0});}
 assert.equal(stop.active,true);assert.equal(enemySeconds,0);assert.equal(brain.stunRemaining,9);
 stop.step(.1);assert.equal(stop.active,false);assert.ok(Math.abs(stop.cooldown-20)<1e-6);assert.equal(stop.use(),false);
 assert.ok(Math.abs(stop.step(.1)-.1)<1e-6);stop.step(19.9);assert.equal(stop.use(),true);
 const edge=new ButtonEdges(),pad=(value:number)=>({mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:false,value:i===6?value:0}))});
 assert.equal(edge.update(pad(.3)).timeStop,true);assert.equal(edge.update(pad(1)).timeStop,false);assert.equal(edge.update(pad(1)).burst,false);
 edge.update(pad(0));assert.equal(edge.update(pad(.3)).timeStop,true);
});

test('near-ready flash resolves in the same slow frame that recharge completes',()=>{
 const input=new BurstInput(),recharge=new BurstRecharge();recharge.remaining=.15;input.request(0);
 const results:string[]=[];
 for(const time of [0,100]){
  const before=input.consume(time,recharge.remaining);if(before)results.push(before);
  const steps=simulationSteps(.1);
  for(let i=0;i<steps.count;i++){recharge.step(steps.dt);const after=input.consume(time,recharge.remaining);if(after)results.push(after);}
 }
 assert.deepEqual(results,['fire']);
});
