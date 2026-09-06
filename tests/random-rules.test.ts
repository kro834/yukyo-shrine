import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {createAreaLookup,RED_AREAS} from '../app/area-rules.ts';
import {placeMagatama,placeRedMagatama,beadInventory,spendBeads} from '../app/magatama.ts';
import {ShrineGoal,ALTAR,GOAL_WALLS} from '../app/shrine-goal.ts';
import {Doors,Enemies,ENEMY_PROFILES} from '../app/shrine-gameplay.ts';
import {inFlashCone} from '../app/flash-cone.ts';
import {SPRINT_SPEED} from '../app/movement.ts';

test('twenty map seeds produce different connected loops without dead ends or missing room entrances',()=>{
 const shapes=new Set<string>(),reference=createLayout(1);
 for(let seed=1;seed<=20;seed++){
  const l=createLayout(seed),keys=[...l.grid.keys()].sort();shapes.add(keys.join('|'));
  const seen=new Set([keys[0]]),queue=[keys[0]];
  for(let i=0;i<queue.length;i++){
   const c=l.grid.get(queue[i])!,neighbors=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>(c.x+x)+','+(c.z+z)).filter(k=>l.grid.has(k));
   assert.ok(neighbors.length>=2,`seed ${seed}: dead end ${queue[i]}`);
   for(const k of neighbors)if(!seen.has(k)){seen.add(k);queue.push(k);}
  }
  assert.equal(seen.size,l.cells.length,`seed ${seed}: disconnected`);
  assert.deepEqual(l.doors,reference.doors,'random corridors preserve all furnished room entrances');
 }
 assert.equal(shapes.size,20);
 assert.deepEqual(createLayout(71).cells,createLayout(71).cells,'a seed reproduces its exact map');
});

test('original fifteen beads are blue; each formerly empty wing receives a reachable random red bead',()=>{
 const l=createLayout(73),doors=new Doors(l.doors),walls=[...l.obstacles,...doors.frames],nav=new Enemies(l.cells,walls),areaAt=createAreaLookup(l.cells);
 const blue=placeMagatama(l.rooms,walls,[]);assert.equal(blue.length,15);assert.ok(blue.every(b=>b.color==='blue'));
 const red=placeRedMagatama(l.cells,nav.nodes.values(),walls,seededRandom(32));
 assert.deepEqual(red.map(b=>b.id),RED_AREAS.map(a=>'red-'+a));
 assert.deepEqual(red,placeRedMagatama(l.cells,nav.nodes.values(),walls,seededRandom(32)));
 assert.notDeepEqual(red.map(b=>b.position),placeRedMagatama(l.cells,nav.nodes.values(),walls,seededRandom(99)).map(b=>b.position));
 for(const b of red){
  assert.equal(areaAt(b.position), 'red');assert.equal(areaAt(b.position,4.8),'blue');
  assert.ok(nav.nodes.has(Math.round(b.position.x/4)+','+Math.round(b.position.z/4)));
  assert.ok(!walls.some(w=>b.position.x>w.minX-.85&&b.position.x<w.maxX+.85&&b.position.z>w.minZ-.85&&b.position.z<w.maxZ+.85));
 }
 assert.equal(nav.actors.length,24);assert.ok(nav.actors.slice(16).every(e=>areaAt(e.home)==='red'));
 nav.update(.05,{x:-1000,z:-1000},walls);
 const kind=(p:{x:number;z:number})=>l.grid.get(Math.round(p.x/4)+','+Math.round(p.z/4))?.kind;
 for(const e of nav.actors.slice(16))assert.equal(kind(e.patrol!.point),kind(e.home),'red guards patrol their own wing');
});

test('five blue beads can be offered incrementally; holding them alone never unlocks the gate',()=>{
 const l=createLayout(),beads=placeMagatama(l.rooms,l.obstacles,[]),g=new ShrineGoal();
 for(const b of beads.slice(0,3))b.collected=true;
 assert.equal(g.unlocked,false);spendBeads(beads,g.offer(beadInventory(beads)));
 assert.equal(g.blueOffered,3);assert.equal(g.unlocked,false);assert.equal(beadInventory(beads).blue,0);
 assert.deepEqual(g.offer(beadInventory(beads)),{blue:0,red:0});
 for(const b of beads.slice(3,7))b.collected=true;
 spendBeads(beads,g.offer(beadInventory(beads)));
 assert.equal(g.blueOffered,5);assert.equal(g.unlocked,true);assert.equal(beadInventory(beads).blue,2);
 assert.deepEqual(g.offer(beadInventory(beads)),{blue:0,red:0});
});

test('one red bead unlocks the altar without consuming blue beads',()=>{
 const g=new ShrineGoal();assert.deepEqual(g.offer({blue:4,red:2}),{blue:0,red:1});
 assert.equal(g.redOffered,1);assert.equal(g.blueOffered,0);assert.equal(g.unlocked,true);
});

test('altar requires a reachable ground-floor approach and facing it',()=>{
 const g=new ShrineGoal(),p={x:ALTAR.x,z:ALTAR.z-2};
 assert.equal(g.nearAltar(p,Math.PI,0,GOAL_WALLS),true);
 assert.equal(g.nearAltar(p,0,0,GOAL_WALLS),false);
 assert.equal(g.nearAltar(p,Math.PI,4.8,GOAL_WALLS),false);
 assert.equal(g.nearAltar({...p,z:p.z-2},Math.PI,0,GOAL_WALLS),false);
 assert.equal(g.nearAltar(p,Math.PI,0,[...GOAL_WALLS,{minX:-5,maxX:0,minZ:11.8,maxZ:12}]),false);
});

test('flash covers exactly the forward 120 degree cone and follows yaw and pitch',()=>{
 const origin={x:0,y:1.5,z:0},point=(angle:number)=>({x:8*Math.sin(angle),y:1.5,z:-8*Math.cos(angle)});
 for(const degrees of [-60,-30,0,30,60])assert.equal(inFlashCone(origin,point(degrees*Math.PI/180),0),true);
 for(const degrees of [-180,-90,-60.1,60.1,90,180])assert.equal(inFlashCone(origin,point(degrees*Math.PI/180),0),false);
 assert.equal(inFlashCone(origin,{x:-8,y:1.5,z:0},Math.PI/2),true);
 assert.equal(inFlashCone(origin,{x:8,y:1.5,z:0},Math.PI/2),false);
 assert.equal(inFlashCone(origin,{x:0,y:9.5,z:0},0,Math.PI/2),true);
 assert.equal(inFlashCone(origin,{x:0,y:-6.5,z:0},0,Math.PI/2),false);
});

test('burst ignores the rear and blocked front while applying nine seconds of stun inside the cone',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);enemies.actors=enemies.actors.slice(0,4);
 const positions=[{x:0,z:-5},{x:0,z:5},{x:-5,z:0},{x:0,z:-9}];
 enemies.actors.forEach((e,i)=>{e.position=positions[i];e.floor=0;});
 assert.equal(enemies.burst({x:0,y:1.5,z:0},[{minX:-2,maxX:2,minZ:-8,maxZ:-7}],0,0,0),1);
 assert.equal(enemies.actors[0].brain.stunRemaining,9);
 assert.ok(enemies.actors.slice(1).every(e=>e.brain.stunRemaining===0));
});

test('red-zone chase speeds rise but remain below sprint speed; blue zone applies the sixty percent reduction',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),boss=enemies.actors.find(e=>e.kind==='danger')!;enemies.actors=[boss];
 const p={x:108,z:-80};boss.position={x:108,z:-92};boss.facing=0;
 enemies.update(.05,p,[]);assert.equal(boss.brain.mode,'chase');
 assert.ok(Math.abs(boss.position.z-(-92+8.9*.05))<1e-6);assert.ok(8.9<SPRINT_SPEED);
 boss.position={x:0,z:0};boss.facing=0;
 enemies.update(.05,{x:0,z:12},[]);
 assert.ok(Math.abs(boss.position.z-ENEMY_PROFILES.danger.chase*.4*.05)<1e-6);
});
