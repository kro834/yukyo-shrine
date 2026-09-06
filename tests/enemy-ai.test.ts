import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Enemies,Doors,openPursuedDoor,segmentBlocked} from '../app/shrine-gameplay.ts';
import {ButtonEdges} from '../app/input-actions.ts';
const layout=createLayout(),doors=new Doors(layout.doors),walls=[...layout.obstacles,...doors.frames];
test('standard and raw Sony Circle map to the same interaction, never Cross',()=>{
 for(const [mapping,circle,cross] of [['standard',1,0],['',2,1]] as const){
   const p=(button:number)=>({id:'Sony DualSense 054c',mapping,axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===button}))});
   const e=new ButtonEdges();assert.equal(e.update(p(cross)).interact,false);e.update(p(-1));
   assert.equal(e.update(p(circle)).interact,true);assert.equal(e.update(p(circle)).interact,false);
 }
});
test('pursuers route around a wall to a remembered position, not the hidden player',()=>{
 const enemies=new Enemies(layout.cells,walls),e=enemies.actors[0];
 e.position={x:-16,z:-136};e.brain.mode='chase';e.brain.lastSeen={x:16,z:-136};
 enemies.update(.05,{x:80,z:20},walls);
 assert.ok(e.route.length>0);assert.equal(segmentBlocked(e.position,e.route[0],walls),false);
 enemies.update(.7,{x:88,z:24},walls);
 assert.deepEqual(e.investigate,{x:16,z:-136});assert.ok(e.searchTime>0);
 enemies.burst(e.position,[]);assert.equal(e.investigate,null);assert.equal(e.brain.mode,'stunned');
});
test('alert enemies need time to open a closed door and stunned enemies cannot open one',()=>{
 const enemies=new Enemies(layout.cells,walls),e=enemies.actors[0],d=doors.states[0];
 e.position={x:d.spec.x+(d.spec.alongX?0:1),z:d.spec.z+(d.spec.alongX?1:0)};
 e.facing=d.spec.alongX?Math.PI:-Math.PI/2;e.brain.mode='chase';d.open=false;
 assert.equal(openPursuedDoor(doors,e,walls,.79),false);assert.equal(d.open,false);
 assert.equal(openPursuedDoor(doors,e,walls,.02),true);assert.equal(d.open,true);
 d.open=false;e.brain.stun();assert.equal(openPursuedDoor(doors,e,walls,2),false);assert.equal(d.open,false);
});
