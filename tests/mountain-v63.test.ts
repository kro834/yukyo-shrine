import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createMountainPlan,MINE_SPEED} from '../app/mountain-plan.ts';
import {mountainHeight,mountainGrade,mountainGeometry,mountainRender} from '../app/mountain-terrain.ts';
import {CircusRuntime} from '../app/circus-runtime.ts';
import {SPRINT_SPEED} from '../app/movement.ts';
import {flashHits} from '../app/flash-visibility.ts';
import {riftDestination,RIFT,crusherPhase} from '../app/parallel-threat.ts';

test('mountain railway and all station exits remain clear across shuffled stages',()=>{
 for(let seed=1;seed<=40;seed++){const layout=createSectorLayout(seed,'mountain'),p=createMountainPlan(layout);assert.equal(p.stations.length,10);assert.ok(p.track.length>1600);assert.ok(p.track.every(t=>Number.isFinite(mountainHeight(t.z))));}
});
test('mine cart accelerates beyond sprint, stops at successive stations and freezes cleanly',()=>{
 const plan=createMountainPlan(createSectorLayout(17,'mountain')),cart=new CircusRuntime(plan,{maxSpeed:MINE_SPEED,acceleration:8,braking:10});
 let distance=0,fastest=0;const visited=new Set<number>();
 for(let trip=0;trip<10;trip++){
  const status=cart.snapshot(),station=plan.stations[status.station];visited.add(status.station);
  const yaw=Math.atan2(station.exit.x-station.position.x,station.exit.z-station.position.z);
  assert.ok(cart.interact({...station.exit,y:1.68},yaw).handled);assert.ok(cart.riding);
  const paused=cart.snapshot();cart.step(0);assert.deepEqual(cart.snapshot(),paused);
  let arrived=false;for(let i=0;i<1500;i++){const result=cart.step(.05);fastest=Math.max(fastest,cart.snapshot().speed);if(result.arrived){arrived=true;assert.ok(result.position);assert.ok(Math.abs(result.position!.y-1.68)<.001);break;}}
  assert.ok(arrived);assert.equal(cart.riding,false);assert.equal(cart.snapshot().speed,0);distance=cart.snapshot().distance;
 }
 assert.equal(visited.size,10);assert.ok(fastest>SPRINT_SPEED*1.6);assert.ok(distance>=0);
});
test('five terraces are continuous with level building pads and actual ascent',()=>{
 assert.equal(mountainHeight(-152),0);assert.equal(mountainHeight(152),24);
 for(const center of [-152,-76,0,76,152])assert.equal(mountainHeight(center-27.9),mountainHeight(center+27.9));
 for(let z=-185;z<185;z+=.1){assert.ok(mountainHeight(z+.1)>=mountainHeight(z));assert.ok(mountainHeight(z+.1)-mountainHeight(z)<.046);assert.ok(mountainGrade(z)<=.451);}
 const g=mountainGeometry(new THREE.PlaneGeometry(4,20,2,20).rotateX(-Math.PI/2).translate(0,0,38));const p=g.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-mountainHeight(p.getZ(i)))<1e-5);g.dispose();
});
test('terrain render applies once to frames, follows actors and restores local state every frame',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),beam=new THREE.SpotLight();scene.add(beam,beam.target);camera.position.set(0,1.68,120);beam.position.copy(camera.position);beam.target.position.set(0,1.68,128);
 const actor=new THREE.Group();actor.position.set(0,0,120);scene.add(actor);const frame=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1);frame.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,120));scene.add(frame);
 for(let i=0;i<50;i++){const restore=mountainRender(scene,camera,beam);assert.ok(Math.abs(actor.position.y-mountainHeight(120))<1e-9);assert.ok(Math.abs(camera.position.y-actor.position.y-1.68)<1e-9);const m=new THREE.Matrix4();frame.getMatrixAt(0,m);assert.ok(Math.abs(m.elements[13]-mountainHeight(120))<1e-5);restore();assert.equal(actor.position.y,0);assert.equal(camera.position.y,1.68);}
 frame.geometry.dispose();(frame.material as THREE.Material).dispose();
});
test('flash cone accounts for a target above the player on the ascent',()=>{
 const origin={x:0,y:1.68,z:33},target={x:0,z:40};const pitch=-Math.atan2(mountainHeight(40)-mountainHeight(33),7);
 assert.ok(flashHits(origin,target,0,0,Math.PI,pitch,[],[1.68],mountainHeight));assert.equal(flashHits(origin,target,0,0,0,pitch,[],[1.68],mountainHeight),false);
});
test('parallel transfers do not land on player or inside blockers; rush has readable recovery',()=>{
 const player={x:0,z:0},wall={minX:15,maxX:18,minZ:-1,maxZ:1},p=riftDestination([{x:0,z:0},{x:16,z:0},{x:0,z:16},{x:30,z:0}],player,player,[wall],1)!;
 assert.ok(Math.hypot(p.x,p.z)>=RIFT.minRange);assert.deepEqual(p,{x:0,z:16});assert.equal(riftDestination([{x:1,z:1}],player,player,[],0),null);assert.equal(crusherPhase(0),'windup');assert.equal(crusherPhase(1.4),'rush');assert.equal(crusherPhase(3),'recover');
});
