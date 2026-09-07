import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {ShrineGoal} from '../app/shrine-goal.ts';

test('87 chambers include nine central rooms and 78 southern rooms with multiple doors',()=>{
 for(const seed of [1,17,71,99]){const l=createLayout(seed);assert.equal(l.expansionAreas.length,87);assert.equal(l.expansionAreas.filter(r=>r.z1<0).length,9);assert.equal(l.expansionAreas.filter(r=>r.z1>0).length,78);for(const r of l.expansionAreas)assert.ok(l.doors.filter(d=>d.room===r.id||d.rooms?.includes(r.id)).length>=2,r.id);assert.ok(l.narrows.length>100);assert.ok(l.cells.filter(c=>c.kind==='yokocho').length>100);}
});
test('every enemy type ignores unlit walking even at contact, but detects exposed players',()=>{
 const l=createLayout(),e=new Enemies(l.cells,l.obstacles);for(const actor of e.actors){e.actors=[actor];actor.position={x:0,z:0};actor.floor=0;actor.facing=0;assert.equal(e.update(.05,{x:0,z:.3},[],0,[],false),false);assert.notEqual(actor.brain.mode,'chase');actor.position={x:0,z:0};assert.equal(e.update(.05,{x:0,z:.3},[],0,[],true),true);}
});
test('gold unlocks a moved altar and reset removes every offering and seals the gate',()=>{
 const g=new ShrineGoal({x:42,z:100});assert.deepEqual(g.offer({blue:0,red:0,gold:1}),{blue:0,red:0,gold:1});assert.equal(g.unlocked,true);for(let i=0;i<30;i++)g.update(.05,{x:0,z:0},0);assert.equal(g.blockers().length,0);g.reset();assert.equal(g.unlocked,false);assert.equal(g.goldOffered,0);assert.equal(g.progress,0);assert.equal(g.blockers().length,1);assert.equal(g.nearAltar({x:g.altar.x,z:g.altar.z-2},Math.PI,0,g.walls),true);
});
