import test from 'node:test';
import assert from 'node:assert/strict';
import {combineObstacles,nearbyObstacles} from '../app/spatial.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {RADIUS,type Obstacle} from '../app/movement.ts';
import type {Cell} from '../app/shrine-layout.ts';

test('moving obstacle groups retain nearby static walls and track current positions',()=>{
 const fixed=Array.from({length:150},(_,i)=>({minX:i*8,maxX:i*8+1,minZ:-1,maxZ:1}));
 // Prime the stable static index before vehicles start moving.
 assert.ok(nearbyObstacles(fixed,-1,-1,2,2).includes(fixed[0]));
 for(const x of [-17,3,11,104]){
  const cart={minX:x-.5,maxX:x+.5,minZ:0,maxZ:2};
  const both=combineObstacles(fixed,[cart]);
  assert.ok(nearbyObstacles(both,x-.2,0,x+.2,1).includes(cart));
  assert.ok(nearbyObstacles(both,-1,-1,2,2).includes(fixed[0]));
  assert.deepEqual(both,[...fixed,cart]);
 }
});

test('a silent investigating enemy routes around a closed mechanism and takes the direct path after it opens',()=>{
 const cells:Cell[]=[];for(let x=-3;x<=3;x++)for(let z=-2;z<=2;z++)cells.push({x,z,h:4,kind:'hall'});
 const enemies=new Enemies(cells,[]),e=enemies.actors[0];enemies.actors=[e];
 const wall:Obstacle={minX:-.22,maxX:.22,minZ:-2.2,maxZ:2.2};
 const start=()=>{e.position={x:-8,z:0};e.floor=0;e.destinationFloor=0;e.homeFloor=0;e.home={...e.position};e.brain.mode='patrol';e.route=[];e.waypoint=null;e.investigate=null;e.planIn=0;enemies.hear({x:8,z:0},0);};
 start();enemies.setMechanismBlockers([wall]);let detour=0;
 for(let i=0;i<650&&Math.hypot(e.position.x-8,e.position.z)>.4;i++){
  enemies.update(.02,{x:8,z:0},[wall],0,[],false,[],false);detour=Math.max(detour,Math.abs(e.position.z));
  assert.ok(!(e.position.x>wall.minX-RADIUS&&e.position.x<wall.maxX+RADIUS&&e.position.z>wall.minZ-RADIUS&&e.position.z<wall.maxZ+RADIUS));
 }
 assert.ok(detour>2.6,'closed mechanism requires a real detour');assert.ok(Math.hypot(e.position.x-8,e.position.z)<.5,'investigation reaches the other side: '+JSON.stringify({position:e.position,goal:e.investigate,route:e.route,search:e.searchTime,floor:e.floor}));
 enemies.setMechanismBlockers([]);start();let deviation=0;
 for(let i=0;i<500&&Math.hypot(e.position.x-8,e.position.z)>.4;i++){enemies.update(.02,{x:8,z:0},[],0,[],false,[],false);deviation=Math.max(deviation,Math.abs(e.position.z));}
 assert.ok(deviation<.01);assert.ok(Math.hypot(e.position.x-8,e.position.z)<.5);
});
