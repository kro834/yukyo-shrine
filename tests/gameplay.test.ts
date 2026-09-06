import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Doors,Enemies,EnemyBrain,segmentBlocked,STUN_SECONDS,LOSE_SIGHT_SECONDS} from '../app/shrine-gameplay.ts';
import {movePlayer} from '../app/movement.ts';
import {ButtonEdges} from '../app/input-actions.ts';
import type {Pad} from '../app/gamepad-input.ts';
const layout=createLayout();
test('expanded traversable circulation has no dead ends and every room has multiple real doors',()=>{
 const doors=new Doors(layout.doors),nav=new Enemies(layout.cells,[...layout.obstacles,...doors.frames]);
 assert.ok(layout.cells.length>900);assert.ok(layout.rooms.length>=11);assert.ok(doors.states.length>=20);
 for(const room of layout.rooms)assert.ok(layout.doors.filter(d=>d.rooms?.includes(room.id)||d.room===room.id).length>=2,room.id);
 for(const [key,neighbors] of nav.graph)assert.ok(neighbors.length>=2,'dead end '+key);
 const first=[...nav.graph.keys()][0],seen=new Set([first]),queue=[first];
 for(let i=0;i<queue.length;i++)for(const n of nav.graph.get(queue[i])??[])if(!seen.has(n)){seen.add(n);queue.push(n);}
 assert.equal(seen.size,nav.nodes.size,'room/loop disconnected');
});
test('fusuma blocks sight and movement, then opens for passage with interaction',()=>{
 const doors=new Doors(layout.doors),d=doors.states[0],p={x:d.spec.x-1,z:d.spec.z},b={x:d.spec.x+1,z:d.spec.z};
 const fixed=[...layout.obstacles,...doors.frames];
 assert.equal(segmentBlocked(p,b,[...fixed,...doors.blockers()]),true);
 let position={...p};for(let i=0;i<20;i++)position=movePlayer(position,1,0,0,true,.05,[...fixed,...doors.blockers()]);
 assert.ok(position.x<d.spec.x);
 assert.ok(doors.interact(p,-Math.PI/2,fixed));
 for(let i=0;i<40;i++)doors.update(1/60,p);
 assert.equal(d.progress,1);assert.equal(segmentBlocked(p,b,[...fixed,...doors.blockers()]),false);
 position={...p};for(let i=0;i<10;i++)position=movePlayer(position,1,0,0,true,.05,[...fixed,...doors.blockers()]);
 assert.ok(position.x>d.spec.x);
});
test('closing a fusuma never traps a player standing in the opening',()=>{
 const doors=new Doors(layout.doors),d=doors.states[0];d.open=true;d.progress=1;d.open=false;
 doors.update(.1,d.spec);assert.equal(d.open,true);assert.equal(d.progress,1);
});
test('fusuma interaction has a short range and requires facing it',()=>{
 const doors=new Doors(layout.doors),d=doors.states[0],p={x:d.spec.x-2,z:d.spec.z};
 assert.ok(doors.nearest(p,-Math.PI/2,layout.obstacles));
 assert.equal(doors.nearest(p,Math.PI/2,layout.obstacles),null);
 assert.equal(doors.nearest({x:d.spec.x-8,z:d.spec.z},-Math.PI/2,layout.obstacles),null);
});
test('enemy loses chase shortly after line of sight breaks and does not track a hidden player',()=>{
 const brain=new EnemyBrain();brain.update(.016,true,{x:0,z:0});assert.equal(brain.mode,'chase');
 brain.update(.3,false,{x:10,z:20});assert.deepEqual(brain.lastSeen,{x:0,z:0});
 brain.update(LOSE_SIGHT_SECONDS,false,{x:30,z:40});assert.equal(brain.mode,'patrol');assert.equal(brain.lastSeen,null);
 brain.update(.1,true,{x:30,z:40});assert.equal(brain.mode,'patrol','brief grace period permits escape');
});
test('R2 stun lasts nine seconds and prevents chase or movement until it expires',()=>{
 const brain=new EnemyBrain();brain.update(.1,true,{x:0,z:0});brain.stun();
 assert.equal(brain.stunRemaining,STUN_SECONDS);
 for(let i=0;i<539;i++)brain.update(1/60,true,{x:1,z:1});
 assert.equal(brain.mode,'stunned');assert.ok(brain.stunRemaining>0);
 brain.update(1/60,true,{x:1,z:1});assert.equal(brain.mode,'patrol');assert.equal(brain.stunRemaining,0);
});
test('burst reaches nearby visible enemies, but not through walls or across distant rooms',()=>{
 const doors=new Doors(layout.doors),enemies=new Enemies(layout.cells,[...layout.obstacles,...doors.frames]);
 const p={x:0,z:0};enemies.actors[0].position={x:0,z:-5};enemies.actors[1].position={x:0,z:-20};
 enemies.actors[2].position={x:5,z:0};enemies.actors[3].position={x:-5,z:0};
 const wall={minX:2,maxX:3,minZ:-3,maxZ:3};
 assert.equal(enemies.burst(p,[wall]),1);
 assert.equal(enemies.actors[0].brain.mode,'stunned');assert.equal(enemies.actors[1].brain.mode,'patrol');assert.equal(enemies.actors[2].brain.mode,'patrol');
 const position={...enemies.actors[0].position};enemies.update(1,p,[wall]);assert.deepEqual(enemies.actors[0].position,position);
});
test('R2 and circle are edge-triggered and independent of R1',()=>{
 const pad=(pressed:number[]):Pad=>({mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:pressed.includes(i)}))});
 const edges=new ButtonEdges();const first=edges.update(pad([7,1]));
 assert.ok(first.burst&&first.back);assert.equal(first.flashlight,false);
 for(let i=0;i<300;i++){const held=edges.update(pad([7,1]));assert.equal(held.burst,false);assert.equal(held.back,false);}
 edges.update(pad([]));assert.ok(edges.update(pad([7])).burst);
});


