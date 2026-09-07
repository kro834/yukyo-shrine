import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies,Doors,openPursuedDoor} from '../app/shrine-gameplay.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {STAIRS,stairRails,UPPER_HEIGHT} from '../app/annex.ts';
test('ordinary patrol opens a closed fusuma and enters the room without player noise',()=>{
 const l=createLayout(),doors=new Doors(l.doors),walls=[...l.obstacles,...doors.frames,...STAIRS,...stairRails],enemies=new Enemies(l.cells,walls),e=enemies.actors[0];enemies.actors=[e];
 const d=doors.states.find(d=>d.spec.room==='entry-west'&&d.spec.alongX)!;
 for(const other of doors.states){other.open=other!==d;other.progress=other.open?1:0;}
 e.position={x:d.spec.x,z:d.spec.z+1};e.facing=Math.PI;e.patrol={id:'test-room',point:{x:d.spec.x,z:d.spec.z-2},floor:0,visits:0};
 let entered=false;
 for(let i=0;i<220;i++){
  openPursuedDoor(doors,e,walls,.05);doors.update(.05,{x:-180,z:-270});
  enemies.update(.05,{x:-180,z:-270},[...walls,...doors.blockers()]);
  if(e.position.z<d.spec.z-.6)entered=true;
 }
 assert.ok(d.open);assert.ok(entered);assert.equal(e.investigate,null);
});
test('patrol divides coverage across enemies and walks upstairs without hearing a player',()=>{
 const l=createLayout(),doors=new Doors(l.doors),walls=[...l.obstacles,...doors.frames,...STAIRS,...stairRails],enemies=new Enemies(l.cells,walls);
 enemies.update(.05,{x:-1000,z:-1000},walls);
 assert.equal(new Set(enemies.actors.map(e=>e.patrol?.id)).size,8);
 assert.ok(enemies.patrolTargets.some(t=>t.floor===UPPER_HEIGHT));
 const e=enemies.actors[0];enemies.actors=[e];e.position={x:52,z:4};e.floor=0;e.route=[];e.planIn=0;
 const target={id:'upstairs',point:{x:52,z:30},floor:UPPER_HEIGHT,visits:0};e.patrol=target;
 let climbed=false;
 for(let i=0;i<1200;i++){enemies.update(.05,{x:-1000,z:-1000},walls);if(e.floor>4.5)climbed=true;}
 assert.ok(climbed);assert.ok(target.visits>0);assert.equal(e.investigate,null);
});
