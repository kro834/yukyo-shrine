import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Enemies,Doors,type Enemy} from '../app/shrine-gameplay.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {upperDoors} from '../app/annex.ts';
import {createDoorMeshes} from '../app/shrine-actors.ts';
import {enemyFloorHint} from '../app/enemy-direction.ts';
import {WALK_SPEED,SPRINT_SPEED} from '../app/movement.ts';
test('all sectors and every expansion room have one matching-floor patrol owner',()=>{
 for(const seed of [1,17,71,99]){
  const l=createLayout(seed),e=new Enemies(l.cells,l.obstacles);
  e.addPatrolTargets(l.expansionAreas.map(r=>({id:r.id,position:{x:(r.x1+r.x2)*2,z:(r.z1+r.z2)*2},floor:0})));
  e.update(.05,{x:-1000,z:-1000},l.obstacles,0,undefined,false);
  assert.equal(e.actors.length,8);assert.equal(e.patrolOwners.size,e.patrolTargets.length);
  assert.equal(e.patrolTargets.filter(t=>t.id.startsWith('expansion-')).length,87);
  for(const target of e.patrolTargets)assert.equal(e.actors.find(a=>a.id===e.patrolOwners.get(target.id))!.homeFloor,target.floor);
  assert.equal(new Set(e.patrolOwners.values()).size,8);
 }
});
test('each patrol owner visits its complete target set before repeating nearby rooms',()=>{
 const l=createLayout(71),e=new Enemies(l.cells,l.obstacles);e.update(.05,{x:-1000,z:-1000},l.obstacles,0,undefined,false);
 const choose=(a:Enemy)=>(e as unknown as {assignPatrol(a:Enemy):void}).assignPatrol(a);
 for(const a of e.actors){
  const owned=e.patrolTargets.filter(t=>e.patrolOwners.get(t.id)===a.id),seen=new Set<string>();
  for(let i=0;i<owned.length;i++){choose(a);const t=a.patrol!;assert.equal(seen.has(t.id),false);seen.add(t.id);a.position={...t.point};t.visits++;t.lastVisited=e.patrolClock++;}
  assert.equal(seen.size,owned.length);
 }
 e.reset();assert.ok(e.patrolTargets.every(t=>t.visits===0&&t.lastVisited===0));
});
function encounter(){const l=createLayout(1),e=new Enemies(l.cells,l.obstacles);e.actors=e.actors.slice(0,5);
 const p=[{x:0,z:0},{x:8,z:0},{x:-8,z:0},{x:0,z:-8},{x:20,z:0}];
 e.actors.forEach((a,i)=>{a.position={...p[i]};a.floor=0;a.facing=Math.PI;a.kind='normal';});
 e.actors[0].kind='watcher';e.actors[0].facing=0;e.actors[3].brain.stun();return e;
}
test('watcher reports a finite visible position to two allies; darkness is never tracked or relayed',()=>{
 const left=encounter(),right=encounter();for(const e of [left,right])e.update(.05,{x:0,z:8},[],0,[],true,[]);
 for(const e of [left,right]){const responding=e.actors.filter(a=>a.investigate);assert.equal(responding.length,2);assert.ok(responding.every(a=>a.brain.mode==='patrol'));assert.deepEqual(responding.map(a=>a.investigate),[{x:0,z:8},{x:0,z:8}]);assert.equal(e.actors[3].investigate,null);}
 for(let i=0;i<300;i++){left.update(.05,{x:60,z:60},[],0,[],false,[]);right.update(.05,{x:-150,z:-150},[],0,[],false,[]);}
 assert.deepEqual(left.actors.map(a=>({p:a.position,search:a.investigate,mode:a.brain.mode,floor:a.floor})),right.actors.map(a=>({p:a.position,search:a.investigate,mode:a.brain.mode,floor:a.floor})));
 assert.ok(left.actors.every(a=>!a.investigate&&a.brain.mode!=='chase'));
});
test('blue-area enemies pursue faster than walking while remaining outrunnable',()=>{
 const l=createLayout(),e=new Enemies(l.cells,l.obstacles),a=e.actors[0];e.actors=[a];a.position={x:0,z:0};a.facing=0;
 e.update(.05,{x:0,z:8},[]);assert.equal(a.brain.mode,'chase');assert.ok(a.position.z/.05>WALK_SPEED);assert.ok(a.position.z/.05<SPRINT_SPEED);
});
test('310 fusuma share four geometry buffers and cull rendering without changing blockers',t=>{
 t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
 const doors=new Doors([...createLayout().doors,...upperDoors]),scene=new THREE.Scene(),render=createDoorMeshes(scene,doors);
 const buffers=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if(o instanceof THREE.Mesh)buffers.add(o.geometry);});assert.equal(doors.states.length,310);assert.equal(buffers.size,4);
 const fixed=doors.blockers(),leaf=scene.getObjectsByProperty('name','fusuma-leaf')[0],root=leaf.parent!;
 render.update({x:10000,z:10000},72);assert.equal(root.visible,false);assert.equal(doors.blockers(),fixed);
 doors.states[0].open=true;for(let i=0;i<11;i++)doors.update(.05,{x:10000,z:10000});render.update({x:10000,z:10000});assert.ok(Math.abs(leaf.position.x-3.02)<1e-6);
 render.update({x:doors.states[0].spec.x,z:doors.states[0].spec.z});assert.equal(root.visible,true);assert.notEqual(doors.blockers(),fixed);
 const version=leaf.matrixWorld.elements.slice();render.update();assert.deepEqual(leaf.matrixWorld.elements,version);
 render.dispose();
});
test('enemy direction distinguishes a different floor from an immediate same-floor threat',()=>{
 assert.equal(enemyFloorHint(0,4.8),'above');assert.equal(enemyFloorHint(9.6,4.8),'below');assert.equal(enemyFloorHint(4.8,4.8),'same');
});

test('door blocker cache changes only on collision thresholds, including direct resets',()=>{
 const doors=new Doors([...createLayout().doors,...upperDoors]),first=doors.blockers();
 for(let i=0;i<60;i++){doors.update(1/120,{x:9999,z:9999});assert.equal(doors.blockers(),first);}
 const d=doors.states[0];d.open=true;doors.update(.45,{x:9999,z:9999});assert.equal(doors.blockers(),first);
 doors.update(.02,{x:9999,z:9999});const opened=doors.blockers();assert.notEqual(opened,first);assert.equal(opened.length,first.length-1);
 d.progress=0;assert.equal(doors.blockers().length,first.length);assert.notEqual(doors.blockers(),opened);
});
