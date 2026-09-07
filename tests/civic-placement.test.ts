import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createCivicSites} from '../app/civic-placement.ts';
import {buildCivicScene} from '../app/civic-scene.ts';
import {CIVIC_LANDMARK_IDS} from '../app/civic-landmarks.ts';
import {movePlayer,RADIUS} from '../app/movement.ts';

test('real-world landmarks preserve every adjacent walking edge and remain traversable in both directions',()=>{
 const seen=new Set<string>();
 for(const seed of [17,91,233]){
  const layout=createSectorLayout(seed,'outer'),sites=createCivicSites(layout);let triangles=0;
  const colliders=buildCivicScene(sites,(g)=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.dispose();},()=>-.4);
  assert.ok(triangles<50000);
  for(const c of layout.cells)for(const [dx,dz] of [[1,0],[0,1]]){
   if(!layout.grid.has((c.x+dx)+','+(c.z+dz)))continue;
   const x1=c.x*4,z1=c.z*4,x2=(c.x+dx)*4,z2=(c.z+dz)*4;
   assert.ok(!colliders.some(o=>Math.min(x1,x2)<o.maxX+RADIUS&&Math.max(x1,x2)>o.minX-RADIUS&&Math.min(z1,z2)<o.maxZ+RADIUS&&Math.max(z1,z2)>o.minZ-RADIUS),'landmark sealed grid edge');
  }
  for(const s of sites){
   seen.add(s.id);const a=s.quarterTurns*Math.PI/2,dx=-Math.sin(a),dz=Math.cos(a);
   for(const direction of [-1,1]){
    const start={x:s.x+dx*5.5*direction,z:s.z+dz*5.5*direction};let p={...start};
    for(let i=0;i<100;i++)p=movePlayer(p,-dx*direction,-dz*direction,0,true,.016,colliders);
    assert.ok(Math.hypot(p.x-start.x,p.z-start.z)>14,'cannot sprint through '+s.id);
   }
  }
 }
 assert.deepEqual([...seen].sort(),[...CIVIC_LANDMARK_IDS].sort());
});
