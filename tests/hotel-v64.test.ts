import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HotelElevator} from '../app/hotel-elevator.ts';
import {hotelLiftBlockers,HOTEL_LIFT} from '../app/hotel-layout.ts';
import {createSectorLayout} from '../app/sector-layout.ts';
import {Doors,hotelLeafBounds} from '../app/shrine-gameplay.ts';
import {movePlayer} from '../app/movement.ts';
import {hotelHuman} from '../app/hotel-human.ts';
import {mergeEnemyParts} from '../app/enemy-batches.ts';
import {EnemyBrain,type Enemy} from '../app/shrine-gameplay.ts';
import {readFileSync} from 'node:fs';

test('hotel elevator rides through all floors without teleporting or moving while paused',()=>{
 for(const dt of [1/30,1/60,1/144]){
  const lift=new HotelElevator();let pos={x:-28,y:1.68,z:75},floor=0;
  for(const expected of [4.8,9.6,0,4.8]){
   assert.ok(lift.interact(pos,floor));assert.ok(lift.riding);assert.equal(lift.interact(pos,floor),false);
   let done=false;for(let i=0;i<2000;i++){
    const old={...pos},phase=lift.phase,y=lift.y;lift.step(0);assert.equal(lift.phase,phase);assert.equal(lift.y,y);
    const ride=lift.step(dt);if(ride){pos=ride.position;floor=ride.floor;assert.ok(Math.hypot(pos.x-old.x,pos.y-old.y,pos.z-old.z)<dt*5+.001);assert.ok(pos.y>=1.68-.001&&pos.y<=11.28+.001);}
    if(!lift.riding){done=true;break;}
   }
   assert.ok(done);assert.equal(floor,expected);assert.equal(lift.doors,1);assert.ok(lift.near(pos,floor));
   for(const o of hotelLiftBlockers())assert.ok(!(pos.x>o.minX-.42&&pos.x<o.maxX+.42&&pos.z>o.minZ-.42&&pos.z<o.maxZ+.42));
  }
 }
});
test('empty elevator responds to another-floor call; shaft-side calls are rejected',()=>{
 const lift=new HotelElevator(),p={x:-28,y:11.28,z:75};assert.ok(lift.interact(p,9.6));assert.equal(lift.riding,false);
 for(let i=0;i<200;i++)lift.step(.05);assert.equal(lift.floor,2);assert.equal(lift.phase,'idle');assert.equal(lift.doors,1);
 assert.equal(lift.near({x:-30,z:72},9.6),false);assert.equal(lift.near({x:-28,z:74},2.4),false);
});
test('hinged guest-room doors block when closed and allow actual passage when open',()=>{
 for(const alongX of [true,false]){
  const doors=new Doors([{id:'test',x:0,z:0,alongX,opening:1.35,room:'hotel'}]);
  const start=alongX?{x:0,z:-2}:{x:-2,z:0};let p={...start};
  for(let i=0;i<20;i++)p=movePlayer(p,alongX?0:1,alongX?1:0,0,false,.05,[...doors.frames,...doors.blockers()]);
  assert.ok((alongX?p.z:p.x)<-.4);assert.ok(doors.interact(start,alongX?Math.PI:-Math.PI/2,doors.frames));
  for(let i=0;i<20;i++)doors.update(.05,start);p={...start};
  for(let i=0;i<30;i++)p=movePlayer(p,alongX?0:1,alongX?1:0,0,false,.05,[...doors.frames,...doors.blockers()]);
  assert.ok((alongX?p.z:p.x)>2);assert.notDeepEqual(hotelLeafBounds(doors.states[0].spec,0),hotelLeafBounds(doors.states[0].spec,.5));
 }
});
test('hotel provides distinct room types and a lift lobby for 30 random seeds',()=>{
 for(let seed=0;seed<30;seed++){
  const l=createSectorLayout(seed,'ultrareal'),types=new Set(l.rooms.map(r=>r.themeId));
  assert.ok(types.size>=20);for(const type of ['hotel-executive','hotel-penthouse','hotel-double','hotel-laundry','hotel-restaurant'])assert.ok(types.has(type));
  assert.ok(l.grid.has('-7,18')&&l.grid.has('-7,19'));assert.ok(l.doors.every(d=>d.opening===1.35));
 }
});
test('Blender bed contains actual linen geometry and no embedded third-party textures',()=>{
 const bytes=readFileSync(new URL('../public/models/hotel/settled-bed-v64.glb',import.meta.url)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
 assert.equal(json.images,undefined);const duvet=json.nodes.find((n:{name:string})=>n.name==='duvet'),mesh=json.meshes[duvet.mesh],a=json.accessors[mesh.primitives[0].attributes.POSITION];
 assert.ok(a.count>3000);assert.ok(a.max[1]-a.min[1]>.15);assert.ok(bytes.length<1_500_000);
});
test('human rig remains human-sized and has no glowing face material',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();hotelHuman(root,'hotelStaff',{cloth:material,paleCloth:material,skin:material,black:material,cord:material},mergeEnemyParts);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());assert.ok(size.y>1.6&&size.y<1.9);assert.ok(size.x<.8);assert.ok(bounds.min.y>=-.02);
 root.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getY(i)));o.geometry.dispose();}});material.dispose();
});
