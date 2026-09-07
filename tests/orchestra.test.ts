import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSectorLayout} from '../app/sector-layout.ts';
import {ORCHESTRA_IDS} from '../app/orchestra-layout.ts';
import {gothicArch,buildGothicWall} from '../app/gothic-architecture.ts';
import {buildOrchestraRoom} from '../app/orchestra-rooms.ts';
import {belowUpperDeck} from '../app/ground-clearance.ts';

test('Orchestra distributes all four dedicated rooms without invading upper-floor supports',()=>{
 for(let seed=1;seed<=120;seed++){
  const l=createSectorLayout(seed,'orchestra'),rooms=l.rooms.filter(r=>ORCHESTRA_IDS.includes(r.themeId as typeof ORCHESTRA_IDS[number]));
  assert.deepEqual(rooms.map(r=>r.themeId).sort(),[...ORCHESTRA_IDS].sort());
  assert.equal(new Set(rooms.map(r=>`${Math.round((r.x1+r.x2)/38)},${Math.round((r.z1+r.z2)/38)}`)).size,4);
  for(const r of rooms)assert.equal(belowUpperDeck(r.x1*4-2,r.x2*4+2,r.z1*4-2,r.z2*4+2),false);
 }
});

test('pointed vaults and wall tracery stay inside the rendered navigation envelope',()=>{
 const finite=(g:THREE.BufferGeometry)=>{assert.ok(g.index);for(const name of ['position','normal','uv'])for(const v of g.getAttribute(name).array)assert.ok(Number.isFinite(v));g.computeBoundingBox();};
 for(const alongX of [true,false])for(const top of [3.8,4.1,4.5,5.8]){
  gothicArch(0,0,alongX,2.7,top,g=>{finite(g);assert.ok(g.boundingBox!.min.y>2.8);assert.ok(g.boundingBox!.max.y<top-.12);g.dispose();});
  for(const sign of [-1,1])buildGothicWall({x:0,z:0,h:top,alongX,insideX:alongX?0:sign,insideZ:alongX?sign:0},g=>{
   finite(g);const b=g.boundingBox!,a=alongX?'z':'x';assert.ok(Math.max(b.min[a]*sign,b.max[a]*sign)<=.181);g.dispose();
  },(x,y,z,w,h,d)=>{assert.ok((alongX?z:x)*sign+(alongX?d:w)/2<=.181);assert.ok(y-h/2>=0);});
 }
});

test('Gothic instruments leave the offset door cross clear and omit furniture for a reserved altar',()=>{
 const room={x1:0,x2:2,z1:0,z2:2},cx=4,cz=4;
 for(const id of ORCHESTRA_IDS){
  let count=0;
  const b={box(x:number,y:number,z:number,w:number,h:number,d:number){count++;assert.ok(w>0&&h>0&&d>0);if(y-h/2<2.5)assert.ok(Math.abs(x-cx)-w/2>=2.65||Math.abs(z-cz)-d/2>=2.65);},cylinder(x:number,y:number,z:number,r:number,h:number){count++;assert.ok(Math.abs(x-cx)-r>=2.65||Math.abs(z-cz)-r>=2.65);},fixture(){},block(x:number,z:number,w:number,d:number){assert.ok(Math.abs(x-cx)-w/2>=2.65||Math.abs(z-cz)-d/2>=2.65);}};
  buildOrchestraRoom(id,room,b,false);assert.ok(count>50);count=0;buildOrchestraRoom(id,room,b,true);assert.equal(count,0);
 }
});
