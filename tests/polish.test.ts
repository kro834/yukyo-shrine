import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyObstacles} from '../app/spatial.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {placeMagatama,collectMagatama} from '../app/magatama.ts';
import {upperPartitions,upperBarriers} from '../app/annex.ts';
import {Enemies,ENEMY_PROFILES} from '../app/shrine-gameplay.ts';
import {SPRINT_SPEED} from '../app/movement.ts';
import {TouchInput} from '../app/input-actions.ts';
test('spatial broad phase includes every intersecting wall, including negative cell boundaries',()=>{
 const walls=createLayout().obstacles;
 for(let i=0;i<200;i++){
  const x=(i*13%380)-190,z=(i*29%310)-280;
  const hits=nearbyObstacles(walls,x,z,x+2,z+3);
  for(const o of walls)if(o.minX<=x+2&&o.maxX>=x&&o.minZ<=z+3&&o.maxZ>=z)assert.ok(hits.includes(o));
 }
 assert.ok(nearbyObstacles(walls,0,12,2,14).length<walls.length/10);
});
test('every room has one collectible, with wall and floor separation and no duplicate pickup',()=>{
 const l=createLayout(),beads=placeMagatama(l.rooms,l.obstacles,[...upperPartitions,...upperBarriers]);
 assert.equal(beads.length,l.rooms.filter(r=>!r.id.startsWith('expansion-')).length+2);assert.equal(new Set(beads.map(b=>b.id)).size,beads.length);
 const b=beads[0],p={x:b.position.x-.5,z:b.position.z};
 const wall={minX:p.x+.2,maxX:p.x+.3,minZ:p.z-1,maxZ:p.z+1};
 assert.equal(collectMagatama(beads,p,0,[wall]),0);
 assert.equal(collectMagatama(beads,p,4.8,[]),0);
 assert.equal(collectMagatama(beads,p,0,[]),1);assert.equal(collectMagatama(beads,p,0,[]),0);
});
test('nine regular enemy types have different sensing roles and all can be outrun',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);
 assert.equal(new Set(enemies.actors.map(e=>e.kind)).size,9);
 assert.ok(ENEMY_PROFILES.listener.hearing>ENEMY_PROFILES.normal.hearing);
 assert.ok(ENEMY_PROFILES.watcher.sight>ENEMY_PROFILES.normal.sight);
 assert.ok(ENEMY_PROFILES.stalker.chase>ENEMY_PROFILES.normal.chase);
 for(const actor of enemies.actors)assert.ok(ENEMY_PROFILES[actor.kind].chase<SPRINT_SPEED);
});
test('touch dash toggles once, survives movement release, and resets on clearing input',()=>{
 const t=new TouchInput();assert.equal(t.toggleSprint(),true);
 t.start(1,'move',0,0);t.move(1,0,-42);t.end(1);assert.equal(t.sprint,true);
 assert.equal(t.toggleSprint(),false);t.toggleSprint();t.clear();assert.equal(t.sprint,false);
});
