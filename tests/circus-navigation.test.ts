// Copy into tests/circus-navigation.test.ts.  Imports deliberately resolve from
// that final location; this external proposal never modifies the Site.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createCircusPlan} from '../app/circus-plan.ts';
import {CircusRuntime} from '../app/circus-runtime.ts';
import {buildCircusRoom} from '../app/circus-rooms.ts';
import {Doors,segmentBlocked} from '../app/shrine-gameplay.ts';
import {RADIUS} from '../app/movement.ts';
import {SPAWN} from '../app/shrine-layout.ts';

type Point={x:number;z:number};
type Obstacle={minX:number;maxX:number;minZ:number;maxZ:number;minY?:number;maxY?:number};
const expanded=(items:readonly Obstacle[])=>items.map(o=>({...o,minX:o.minX-RADIUS,maxX:o.maxX+RADIUS,minZ:o.minZ-RADIUS,maxZ:o.maxZ+RADIUS}));
const blocked=(p:Point,items:readonly Obstacle[])=>items.some(o=>p.x>o.minX-RADIUS&&p.x<o.maxX+RADIUS&&p.z>o.minZ-RADIUS&&p.z<o.maxZ+RADIUS);

function roomFurniture(rooms:Parameters<typeof buildCircusRoom>[0][]){
 const result:Obstacle[]=[];
 for(const room of rooms)buildCircusRoom(room,g=>g.dispose(),(x,z,w,d,maxY)=>result.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,maxY}),()=>{},false);
 return result;
}
function navigation(layout:ReturnType<typeof createSectorLayout>,items:Obstacle[]){
 // Build the expanded spatial index once: segmentBlocked reuses it for every
 // graph edge instead of allocating a new expanded obstacle array per edge.
 const walls=expanded(items),clear=(a:Point,b:Point)=>!segmentBlocked(a,b,walls);
 const nodes=new Map(layout.cells.map(c=>[c.x+','+c.z,{x:c.x*4,z:c.z*4}]));
 for(const [key,p] of nodes)if(blocked(p,items))nodes.delete(key);
 const queue=[...nodes].filter(([,p])=>Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<6&&clear(SPAWN,p)).map(([key])=>key),seen=new Set(queue);
 assert.ok(queue.length,'spawn needs at least one clear layout node');
 for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i].split(',').map(Number),from=nodes.get(queue[i])!;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const key=(x+dx)+','+(z+dz),to=nodes.get(key);
   if(to&&!seen.has(key)&&clear(from,to)){seen.add(key);queue.push(key);}
  }
 }
 const reaches=(target:Point)=>[...seen].some(key=>{const p=nodes.get(key)!;return Math.hypot(p.x-target.x,p.z-target.z)<6&&clear(p,target);});
 return {nodes,seen,reaches};
}
function runtimeAt(plan:ReturnType<typeof createCircusPlan>,id:string,progress:number){
 const device=plan.devices.find(d=>d.id===id);assert.ok(device,`missing ${id}`);
 const runtime=new CircusRuntime({...plan,devices:[device]});
 if(progress===0)return runtime;
 const yaw=Math.atan2(device.control.x-device.position.x,device.control.z-device.position.z);
 runtime.interact({x:device.control.x,y:1.68,z:device.control.z},yaw);
 const rate=device.kind==='curtain'?.72:device.kind==='turntable'?.5:device.kind==='drawbridge'?.4:2;
 runtime.step(progress/rate);
 assert.ok(Math.abs(runtime.snapshot().devices[0].progress-progress)<1e-6);
 return runtime;
}

test('circus route stays connected through every mechanism state',()=>{
 for(const seed of [1,17,71]){
  const layout=createSectorLayout(seed,'circus'),plan=createCircusPlan(seed,layout);
  assert.equal(layout.sectors.length,25);assert.equal(layout.rooms.length,87);assert.equal(layout.rooms.filter(r=>r.bead).length,13);
  assert.equal(plan.track.length,544);assert.equal(plan.stations.length,4);assert.equal(plan.devices.length,4);
  const base=[...layout.obstacles,...new Doors(layout.doors).frames,...roomFurniture(layout.rooms)];
  const staticNav=navigation(layout,base);assert.equal(staticNav.seen.size,staticNav.nodes.size,`base/${seed}`);
  for(const point of plan.track)assert.ok(!blocked(point,base),`rail/${seed}/${point.x},${point.z}`);
  for(const station of plan.stations){assert.ok(staticNav.reaches(station.exit),`station/${seed}/${station.id}`);assert.ok(!blocked(station.position,base));}
  for(const device of plan.devices){assert.ok(staticNav.reaches(device.control),`control/${seed}/${device.id}`);assert.ok(!blocked(device.position,base));}
  for(const a of [0,.5,1])for(const b of [0,.5,1])for(const c of [0,.5,1]){
   const state=[['circus-curtain',a],['circus-turntable',b],['circus-drawbridge',c]] as const;
   const dynamic=state.flatMap(([id,progress])=>runtimeAt(plan,id,progress).blockers(false));
   const nav=navigation(layout,[...base,...dynamic]),label=`${seed}/${state.map(([id,p])=>id+':'+p).join(',')}`;
   assert.equal(nav.seen.size,nav.nodes.size,label);
   for(const station of plan.stations)assert.ok(nav.reaches(station.exit),label+'/'+station.id);
   for(const device of plan.devices)assert.ok(nav.reaches(device.control),label+'/'+device.id);
  }
 }
});
