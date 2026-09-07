import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies} from '../app/shrine-gameplay.ts';
import {createSectorLayout} from '../app/sector-layout.ts';
import {collectionReady} from '../app/goal-rules.ts';
import {ShrineGoal} from '../app/shrine-goal.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';
import {RunProgress} from '../app/run-progress.ts';
import {STAIRS} from '../app/annex.ts';
import {HIGH_STAIRS} from '../app/vertical-layout.ts';
import {rushPhase,traitSpeed} from '../app/enemy-traits.ts';
import {flashHits} from '../app/flash-visibility.ts';

test('six blue, two red or one gold qualify independently; partial red offerings accumulate',()=>{
 for(const blue of [0,5])for(const red of [0,1])assert.equal(collectionReady({blue,red,gold:0}),false);
 for(const counts of [{blue:6,red:0},{blue:0,red:2},{blue:0,red:0,gold:1}])assert.equal(collectionReady(counts),true);
 const g=new ShrineGoal();assert.deepEqual(g.offer({blue:0,red:1}),{blue:0,red:1,gold:0});assert.equal(g.unlocked,false);assert.deepEqual(g.offer({blue:0,red:1}),{blue:0,red:1,gold:0});assert.equal(g.unlocked,true);
 const blue=new ShrineGoal();blue.offer({blue:5,red:0});assert.equal(blue.unlocked,false);assert.deepEqual(blue.offer({blue:1,red:1}),{blue:1,red:0,gold:0});assert.equal(blue.unlocked,true);
});
test('exactly one random finale replaces twelve enemies, tracks darkness across floors, and resets the original roster',()=>{
 const l=createSectorLayout(17);
 for(const random of [()=>0,()=>.99]){
  const enemies=new Enemies(l.cells,l.obstacles),original=enemies.actors.slice(),kind=enemies.beginFinale({x:0,z:14},0,random);
  assert.equal(kind,random()===0?'hatred':'wrath');assert.equal(enemies.actors.length,1);const boss=enemies.actors[0];assert.ok(Math.hypot(boss.position.x,boss.position.z-14)>=22);
  const player={x:0,z:14};enemies.update(.05,player,l.obstacles,9.6,undefined,false);assert.deepEqual(boss.brain.lastSeen,player);assert.equal(boss.destinationFloor,9.6);assert.equal(boss.brain.mode,'chase');
  assert.equal(enemies.beginFinale({x:120,z:120},4.8,()=>.5),kind);assert.equal(enemies.actors[0],boss);
  boss.position={...player};boss.floor=0;assert.equal(enemies.update(.05,player,[],4.8,[],false),false,'no capture through floors');
  boss.position={x:0,z:13.4};assert.equal(enemies.update(.05,player,[{minX:-5,maxX:5,minZ:13.65,maxZ:13.75}],0,[],false),false,'no capture through wall');
  enemies.reset();assert.equal(enemies.finalKind,null);assert.equal(enemies.actors.length,12);assert.deepEqual(enemies.actors,original);assert.ok(enemies.actors.every(e=>e.traitTime===0&&e.flankPoint===null));
 }
});
test('the final pursuer climbs both physical staircase levels and remains stopped for the full stun interval',()=>{
 const l=createSectorLayout(1),enemies=new Enemies(l.cells,l.obstacles);enemies.beginFinale({x:0,z:14},0,()=>0);const boss=enemies.actors[0];
 for(const [s,low,high] of [[STAIRS[0],0,4.8],[HIGH_STAIRS[0],4.8,9.6]] as const){
  const x=(s.minX+s.maxX)/2;boss.position={x,z:s.minZ-1};boss.floor=low;boss.route=[];boss.planIn=0;
  for(let i=0;i<200&&boss.floor<high;i++)enemies.update(.05,{x,z:s.maxZ+3},[],high,[],false,[]);
  assert.equal(boss.floor,high);
 }
 boss.brain.stun();const frozen={...boss.position};for(let i=0;i<179;i++)enemies.update(.05,{x:0,z:14},[],0,[],false,[]);assert.deepEqual(boss.position,frozen);assert.equal(boss.brain.mode,'stunned');enemies.update(.051,{x:0,z:14},[],0,[],false,[]);assert.equal(boss.brain.mode,'chase');
});
test('threat meter follows live danger, clears with safety/stun/freeze, and never counts a final boss as escaped',()=>{
 const r=new RunProgress(),state={chasing:true,searching:false,hidden:false,frozen:false,burden:1};r.step(.05,state);assert.equal(r.pressure,1);
 r.step(.05,{...state,chasing:false,searching:true});assert.equal(r.pressure,.45);r.step(.05,{...state,chasing:false,hidden:true});assert.equal(r.pressure,0);assert.equal(r.state,'hidden');
 r.beginFinale();for(let i=0;i<120;i++)r.step(.05,{...state,chasing:false,stunned:true,finale:true});assert.equal(r.escapes,0);assert.equal(r.pressure,0);assert.equal(r.state,'stunned');
 r.step(.05,{...state,frozen:true,finale:true});assert.equal(r.pressure,0);r.defeated();assert.equal(r.state,'quiet');
 const mirror=new MirrorInventory([]);mirror.grant(2);assert.equal(mirror.count,2);assert.equal(mirror.use(),true);mirror.step(12);assert.equal(mirror.use(),true);mirror.step(12);assert.equal(mirror.use(),false);mirror.reset();assert.equal(mirror.count,0);
});
test('new foes keep darkness rules while light, sound, flanking and telegraphed rushes differ',()=>{
 const cells=Array.from({length:33*33},(_,i)=>({x:i%33-16,z:Math.floor(i/33)-16,h:4,kind:'hall' as const}));
 const enemies=new Enemies(cells,[]);
 for(const kind of ['mire','warden','fox','pilgrim'] as const){const actor=enemies.actors.find(e=>e.kind===kind)!;actor.position={x:0,z:0};actor.floor=0;actor.facing=0;actor.brain.reacquireDelay=0;}
 enemies.update(.05,{x:0,z:3},[],0,[],false);for(const a of enemies.actors.filter(e=>['mire','warden','fox','pilgrim'].includes(e.kind)))assert.notEqual(a.brain.mode,'chase');
 const mire=enemies.actors.find(e=>e.kind==='mire')!;mire.position={x:0,z:0};mire.facing=0;enemies.update(.05,{x:0,z:6},[],0,[],true,[],false);assert.notEqual(mire.brain.mode,'chase');enemies.update(.05,{x:0,z:6},[],0,[],true,[],true);assert.equal(mire.brain.mode,'chase');
 const warden=enemies.actors.find(e=>e.kind==='warden')!;warden.brain.mode='patrol';enemies.hear({x:18,z:18});assert.equal(warden.searchBranches,5);assert.deepEqual(warden.investigate,{x:18,z:18});
 const fox=enemies.actors.find(e=>e.kind==='fox')!;fox.brain.reacquireDelay=0;fox.position={x:0,z:0};fox.floor=0;fox.planIn=0;fox.facing=0;enemies.update(.05,{x:0,z:12},[],0,[],true);assert.ok(fox.flankPoint);assert.notDeepEqual(fox.flankPoint,{x:0,z:12});
 assert.equal(rushPhase(.3),'windup');assert.equal(rushPhase(.8),'rush');assert.ok(traitSpeed('pilgrim',true,.3,8.8)<1);assert.ok(traitSpeed('pilgrim',true,.8,8.8)>8);assert.ok(traitSpeed('pilgrim',true,2.2,8.8)<4);
});

test('a low crawling enemy cannot be flashed above solid cover',()=>{
 const origin={x:0,y:1.68,z:0},target={x:0,z:-5},cover={minX:-1,maxX:1,minZ:-4.9,maxZ:-4.8,minY:0,maxY:.85};
 assert.equal(flashHits(origin,target,0,0,0,0,[],[.22,.42,.58]),true);
 assert.equal(flashHits(origin,target,0,0,0,0,[cover],[.22,.42,.58]),false);
 assert.equal(flashHits(origin,target,0,0,0,0,[cover]),true,'standing enemy remains visible over low cover');
});

test('final pursuit reaches players on every ramp segment without capturing through real walls',()=>{
 const l=createSectorLayout(17),ground=[...l.obstacles,...STAIRS],enemies=new Enemies(l.cells,ground);
 for(const {s,low,high} of [...STAIRS.map(s=>({s,low:0,high:4.8})),...HIGH_STAIRS.map(s=>({s,low:4.8,high:9.6}))])for(const fraction of [0,.4,.6,1])for(const ascending of [true,false]){
  const x=(s.minX+s.maxX)/2,player={x,z:s.minZ+fraction*(s.maxZ-s.minZ)},height=low+fraction*(high-low);
  enemies.reset();enemies.beginFinale(player,height,()=>0);const boss=enemies.actors[0];boss.position={x,z:ascending?s.minZ-1:s.maxZ+1};boss.floor=ascending?low:high;boss.planIn=0;
  let caught=false;for(let i=0;i<400&&!caught;i++)caught=enemies.update(.05,player,ground,height,undefined,false,undefined,false);
  assert.ok(caught,JSON.stringify({x,low,fraction,ascending}));
 }
 const boss=enemies.actors[0];boss.position={x:52,z:16.4};boss.floor=2.496;
 const wall={minX:50,maxX:54,minZ:16.6,maxZ:16.8,minY:0,maxY:10};
 assert.equal(enemies.update(.05,{x:52,z:17},[...ground,wall],2.64,undefined,false),false);
});
