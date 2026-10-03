import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies,ROUTE_SEARCH} from '../app/shrine-gameplay.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {seededRandom} from '../app/seeded-random.ts';
import type {Position} from '../app/movement.ts';

type Probe={closest(p:Position,upper?:boolean|number,within?:number):{key:string;point:Position;distance:number}|null};
const probe=(e:Enemies)=>e as unknown as Probe;

test('runtime node searches stay local: a bounded search never falls back to a whole-map scan',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),c=probe(enemies);
 // Far from every node a bounded search gives up at once instead of sweeping the map.
 const nowhere={x:10000,z:10000};
 assert.equal(c.closest(nowhere,0,2.8),null);assert.equal(c.closest(nowhere,0,ROUTE_SEARCH),null);
 // Near a corridor node the bounded search returns the same node as the unbounded one.
 const node=[...enemies.nodes.values()][40],near={x:node.x+.4,z:node.z-.3};
 assert.deepEqual(c.closest(near,0,2.8),c.closest(near,0));
 assert.ok(c.closest(near,0,2.8)!.distance<2.8);
});

test('the hatred pursuer stays cheap when the visitor stands where no node is in clear line',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);
 const nodes=[...enemies.nodes.values()],start=nodes[Math.floor(nodes.length/2)];
 enemies.beginFinale(start,0,()=>.1);assert.equal(enemies.finalKind,'hatred');
 const boss=enemies.actors[0];boss.wakeIn=0;boss.position={x:start.x+30,z:start.z};boss.floor=0;
 // Stand inside a solid obstacle: neither the intercept point nor the visitor has a clear local node.
 const solid=l.obstacles.find(o=>o.maxX-o.minX>1.2&&o.maxZ-o.minZ>1.2&&Math.hypot((o.minX+o.maxX)/2-boss.position.x,(o.minZ+o.maxZ)/2-boss.position.z)<40)??l.obstacles[0];
 let player={x:(solid.minX+solid.maxX)/2,z:(solid.minZ+solid.maxZ)/2};
 const random=seededRandom(3);let worst=0;
 for(let i=0;i<240;i++){
  player={x:player.x+(random()-.5)*.05,z:player.z+(random()-.5)*.05};
  const t=performance.now();enemies.update(1/60,player,l.obstacles,0,[],true,[],true);worst=Math.max(worst,performance.now()-t);
 }
 // Before the bound a single frame here took the better part of a second.
 assert.ok(worst<120,`worst frame ${worst.toFixed(1)} ms`);
});
