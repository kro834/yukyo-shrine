import test from 'node:test';
import assert from 'node:assert/strict';
import {ShrineGoal,GOAL_WALLS} from '../app/shrine-goal.ts';
import {movePlayer,type Position} from '../app/movement.ts';
const advance=(goal:ShrineGoal,count:number,p:Position,floor=0)=>{for(let i=0;i<40;i++)goal.update(.05,count,p,floor);};
test('goal requires all beads, ground floor proximity and actual entry',()=>{
 const g=new ShrineGoal(15),p={x:0,z:14};
 advance(g,0,p);advance(g,14,p);assert.equal(g.progress,0);
 advance(g,15,{x:0,z:-100});advance(g,15,p,4.8);assert.equal(g.progress,0);
 advance(g,15,p);assert.equal(g.progress,1);assert.equal(g.completed,false);
 g.update(.05,15,{x:0,z:16.8},4.8);assert.equal(g.completed,false);
 g.update(.05,15,{x:0,z:16.8},0);assert.equal(g.completed,true);
 g.update(.05,0,{x:100,z:100},0);assert.equal(g.completed,true);
});
test('closed goal cannot be entered from the front, sides or rear; unlocked front is traversable',()=>{
 const g=new ShrineGoal(15);
 for(const [start,dx,dz] of [[{x:0,z:14},0,1],[{x:5,z:16.8},-1,0],[{x:-5,z:16.8},1,0],[{x:0,z:19},0,-1]] as [Position,number,number][]){
  let p=start;const walls=[...GOAL_WALLS,...g.blockers()];
  for(let i=0;i<40;i++){p=movePlayer(p,dx,dz,0,true,.05,walls);g.update(.05,14,p,0);}
  assert.equal(g.completed,false);assert.ok(!(Math.abs(p.x)<1.5&&p.z>16.5&&p.z<17.4));
 }
 advance(g,15,{x:0,z:14});let p={x:0,z:14};
 for(let i=0;i<8;i++){p=movePlayer(p,0,1,0,true,.05,[...GOAL_WALLS,...g.blockers()]);g.update(.05,15,p,0);}
 assert.equal(g.completed,true);
 // The established east-west corridor behind the goal remains passable.
 p={x:-6,z:20};for(let i=0;i<30;i++)p=movePlayer(p,1,0,0,true,.05,GOAL_WALLS);
 assert.ok(p.x>6);
});
