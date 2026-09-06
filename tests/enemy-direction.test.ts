import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyDirection} from '../app/enemy-direction.ts';
import {createLayout} from '../app/shrine-layout.ts';
test('enemy bearing covers front, right, rear and left without line-of-sight filtering',()=>{
 const p={x:0,z:0};
 assert.equal(enemyDirection(p,{x:0,z:-10},0).angle,0);
 assert.equal(enemyDirection(p,{x:10,z:0},0).angle,Math.PI/2);
 assert.equal(Math.abs(enemyDirection(p,{x:0,z:10},0).angle),Math.PI);
 assert.equal(enemyDirection(p,{x:-10,z:0},0).angle,-Math.PI/2);
 assert.equal(enemyDirection(p,{x:3,z:4},0).distance,5);
});
test('bearing follows camera rotation and wraps smoothly to the nearest direction',()=>{
 const p={x:0,z:0},e={x:10,z:0};
 assert.ok(Math.abs(enemyDirection(p,e,-Math.PI/2).angle)<1e-8);
 assert.ok(Math.abs(enemyDirection(p,e,Math.PI*3/2).angle)<1e-8);
});
test('each high cloister has a solid sight-breaking core and four surrounding routes',()=>{
 const l=createLayout();assert.equal(l.courts.length,3);
 for(const c of l.courts){
   assert.equal(l.grid.has(c.x+','+c.z),false);
   for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){
     const cell=l.grid.get((c.x+dx)+','+(c.z+dz));assert.ok(cell);assert.equal(cell.h,c.h);
   }
 }
});
