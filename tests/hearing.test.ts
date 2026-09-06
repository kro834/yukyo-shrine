import test from 'node:test';
import assert from 'node:assert/strict';
import {RunningSteps} from '../app/footsteps.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {STAIRS,stairRails,UPPER_HEIGHT} from '../app/annex.ts';
test('only actual running movement produces footstep/hearing events',()=>{
 const steps=new RunningSteps();
 assert.equal(steps.update(.05,true,false),false);assert.equal(steps.update(.05,false,true),false);
 assert.equal(steps.update(.05,true,true),true);assert.equal(steps.update(.05,true,true),false);
 assert.equal(steps.update(.3,true,true),true);assert.equal(steps.update(.1,false,true),false);
});
test('wide hearing records the last running position through walls without tracking later walking',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),e=enemies.actors[0],boss=enemies.actors[4];
 e.position={x:0,z:0};boss.position={x:40,z:0};const noise={x:25,z:0};
 enemies.hear(noise);assert.deepEqual(e.investigate,noise);assert.deepEqual(boss.investigate,noise);
 e.position={x:0,z:0};enemies.hear({x:35,z:0});assert.deepEqual(e.investigate,noise,'blue normal hearing stops beyond 28 m');
 enemies.update(.05,{x:-100,z:-250},l.obstacles);assert.deepEqual(e.investigate,noise);
});
test('an enemy follows an upstairs footstep by climbing a real staircase',()=>{
 const l=createLayout(),doors=new Doors(l.doors),walls=[...l.obstacles,...doors.frames,...STAIRS,...stairRails];
 const enemies=new Enemies(l.cells,walls),e=enemies.actors[0];
 e.position={x:52,z:4};e.floor=0;enemies.hear({x:52,z:30},UPPER_HEIGHT);
 for(let i=0;i<1000&&!(e.floor>4.5&&e.position.z>26);i++)enemies.update(.05,{x:-1000,z:-1000},walls);
 assert.ok(e.floor>4.5,'did not climb: '+JSON.stringify({p:e.position,floor:e.floor,goal:e.investigate}));
 assert.ok(e.position.z>26);
 enemies.hear({x:52,z:4},0);
 for(let i=0;i<1000&&!(e.floor===0&&e.position.z<6);i++)enemies.update(.05,{x:-1000,z:-1000},walls);
 assert.equal(e.floor,0,'enemy did not descend');assert.ok(e.position.z<6);
});
