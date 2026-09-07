import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayout} from '../app/shrine-layout.ts';
import {Enemies,ENEMY_PROFILES,STUN_SECONDS} from '../app/shrine-gameplay.ts';
import {SPRINT_SPEED} from '../app/movement.ts';
import {ButtonEdges} from '../app/input-actions.ts';
test('Circle opens doors once per press while Cross remains menu confirm',()=>{
 const pad=(i:number)=>({mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,n)=>({pressed:i===n}))});
 const edge=new ButtonEdges();
 assert.equal(edge.update(pad(0)).interact,false);
 edge.update(pad(-1));assert.equal(edge.update(pad(1)).interact,true);
 assert.equal(edge.update(pad(0)).interact,false);
});
test('six distinct stage wings contain distinct materials and join the existing complex',()=>{
 const l=createLayout();assert.equal(l.stages.length,6);assert.ok(l.cells.length>2400);
 for(const kind of ['factory','bath','cistern'])assert.ok(l.cells.filter(c=>c.kind===kind).length>300,kind);
 for(const k of ['27,-17','-27,-17','-16,-49','16,-49'])assert.ok(l.grid.has(k));
});
test('exactly one danger enemy detects farther, moves faster, but can be outrun and stunned',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);
 assert.equal(enemies.actors.length,8);assert.equal(enemies.actors.filter(e=>e.kind==='danger').length,1);
 const boss=enemies.actors.find(e=>e.kind==='danger')!;
 assert.ok(ENEMY_PROFILES.danger.sight>ENEMY_PROFILES.normal.sight*2);
 assert.ok(ENEMY_PROFILES.danger.chase>ENEMY_PROFILES.normal.chase);
 assert.ok(ENEMY_PROFILES.danger.chase<SPRINT_SPEED);
 boss.position={x:0,z:0};boss.facing=0;
 enemies.update(.05,{x:0,z:12},[]);assert.equal(boss.brain.mode,'chase');
 assert.ok(Math.abs(boss.position.z-ENEMY_PROFILES.danger.chase*.9*.05)<1e-6,'blue pursuit is faster than walking while remaining outrunnable');
 const wall={minX:-5,maxX:5,minZ:3,maxZ:4};
 enemies.update(.7,{x:0,z:12},[wall]);assert.equal(boss.brain.mode,'patrol');
 enemies.burst({x:boss.position.x,z:boss.position.z},[]);
 assert.equal(boss.brain.stunRemaining,STUN_SECONDS);
});



