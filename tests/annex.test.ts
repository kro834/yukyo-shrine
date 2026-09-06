import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Doors,segmentBlocked,Enemies} from '../app/shrine-gameplay.ts';
import {movePlayer} from '../app/movement.ts';
import {STAIRS,UPPER_HEIGHT,upperDoors,upperPartitions,upperBarriers,stairRails,floorHeightAt} from '../app/annex.ts';
test('every ground and upper fusuma opens from both sides without a hidden wall behind it',()=>{
 const layout=createLayout(),doors=new Doors([...layout.doors,...upperDoors]);
 assert.equal(new Set(doors.states.map(d=>(d.spec.floor??0)+':'+d.spec.x+','+d.spec.z)).size,doors.states.length);
 for(const d of doors.states)for(const side of [-1,1]){
   doors.states.forEach(d=>{d.open=false;d.progress=0;});
   const floor=d.spec.floor??0,normal=d.spec.alongX?{x:0,z:side}:{x:side,z:0};
   const p={x:d.spec.x+normal.x*2,z:d.spec.z+normal.z*2};
   const target={x:d.spec.x-normal.x*2,z:d.spec.z-normal.z*2};
   const fixed=[...(floor?upperPartitions:layout.obstacles),...doors.framesFor(floor)];
   assert.equal(segmentBlocked(p,target,fixed),false,d.spec.id+' fixed wall');
   assert.equal(doors.nearest(p,Math.atan2(normal.x,normal.z),fixed,floor)?.spec.id,d.spec.id);
   assert.ok(doors.interact(p,Math.atan2(normal.x,normal.z),fixed,floor));
   for(let i=0;i<40;i++)doors.update(1/60,p,floor);
   assert.equal(d.progress,1);let pos=p;
   for(let i=0;i<9;i++)pos=movePlayer(pos,-normal.x,-normal.z,0,true,.05,[...fixed,...doors.blockers(floor)]);
   assert.ok((pos.x-d.spec.x)*normal.x+(pos.z-d.spec.z)*normal.z<0,d.spec.id+' cannot pass');
 }
});
test('both staircases can be walked up to the upper floor and back down without teleporting',()=>{
 const layout=createLayout(),doors=new Doors([...layout.doors,...upperDoors]);
 const ground=[...layout.obstacles,...doors.frames,...stairRails,...doors.blockers()];
 const upper=[...upperPartitions,...upperBarriers,...stairRails,...doors.framesFor(UPPER_HEIGHT),...doors.blockers(UPPER_HEIGHT)];
 for(const stair of STAIRS){
   let pos={x:(stair.minX+stair.maxX)/2,z:stair.minZ-1},height=0;
   for(let i=0;i<55;i++){pos=movePlayer(pos,0,1,0,true,.05,height>4.5?upper:ground);const next=floorHeightAt(pos,height);assert.ok(Math.abs(next-height)<.12);height=next;}
   assert.ok(pos.z>stair.maxZ);assert.equal(height,UPPER_HEIGHT);
   for(let i=0;i<55;i++){pos=movePlayer(pos,0,-1,0,true,.05,height>4.5?upper:ground);height=floorHeightAt(pos,height);}
   assert.ok(pos.z<stair.minZ);assert.equal(height,0);
 }
});
test('floor selection prevents opening a door through the ceiling',()=>{
 const doors=new Doors(upperDoors),p={x:56,z:8};
 assert.equal(doors.nearest(p,-Math.PI/2,[],0),null);
 assert.ok(doors.nearest(p,-Math.PI/2,[],UPPER_HEIGHT));
 assert.equal(doors.blockers(0).length,0);assert.equal(doors.blockers(UPPER_HEIGHT).length,3);
});
test('adjoining guest rooms have shared doorways and stair footprints do not sever the ground circulation',()=>{
 const l=createLayout();assert.ok(l.doors.filter(d=>d.rooms&&d.rooms.length>1).length>=4);
 const doors=new Doors(l.doors),nav=new Enemies(l.cells,[...l.obstacles,...doors.frames,...STAIRS,...stairRails]);
 const first=[...nav.nodes.keys()][0],seen=new Set([first]),q=[first];
 for(let i=0;i<q.length;i++)for(const next of nav.graph.get(q[i])??[])if(!seen.has(next)){seen.add(next);q.push(next);}
 assert.equal(seen.size,nav.nodes.size);
});
