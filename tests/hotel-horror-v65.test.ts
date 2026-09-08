import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HotelElevator} from '../app/hotel-elevator.ts';
import {hotelVoltage} from '../app/hotel-atmosphere.ts';
import {HOTEL_MATERIALS,createHotelElevatorMeshes} from '../app/hotel-scenery.ts';
import {PARALLEL_MATERIALS} from '../app/parallel-world.ts';

test('all travel and arrival holds are enclosed by both physical door sets',()=>{
 const scene=new THREE.Scene(),lift=new HotelElevator();
 const keys={...HOTEL_MATERIALS,...PARALLEL_MATERIALS,steel:{},black:{},light:{},coolLight:{},concrete:{},earth:{},planks:{},water:{}};
 const mats=Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,new THREE.MeshStandardMaterial(value)])) as Parameters<typeof createHotelElevatorMeshes>[1];
 const meshes=createHotelElevatorMeshes(scene,mats,lift),ray=new THREE.Raycaster(),phases=new Set<string>();
 let p={x:-28,y:1.68,z:75};assert.ok(lift.interact(p,0));let minLight=1;
 for(let i=0;i<1600;i++){
  const ride=lift.step(.01);if(ride)p=ride.position;meshes.update(p,true);scene.updateMatrixWorld(true);
  const state=lift.presentation(true);minLight=Math.min(minLight,state.light);phases.add(lift.phase);
  assert.ok(state.light>=.31&&state.light<=1);assert.equal(lift.presentation(false).light,1);
  const before=JSON.stringify(state);lift.step(0);assert.equal(JSON.stringify(lift.presentation()),before);
  if(['departing','moving','settling'].includes(lift.phase)){
   assert.equal(state.cabinDoors,0);assert.deepEqual(state.landingDoors,[0,0,0]);
   ray.set(new THREE.Vector3(-28,lift.y+1.68,72),new THREE.Vector3(0,0,1));
   const hit=ray.intersectObjects(scene.children,true)[0];assert.equal(hit.object.name,'hotel-cabin-door');assert.ok(hit.distance<1.4);
  }
  if(lift.phase==='idle')break;
 }
 for(const phase of ['departing','moving','settling','opening','leaving','idle'])assert.ok(phases.has(phase));
 assert.ok(minLight<.35);assert.equal(lift.floor,1);assert.ok(p.z>=74.59);
 meshes.dispose();assert.equal(scene.children.length,0);Object.values(mats).forEach(m=>m.dispose());
});

test('hotel voltage sags slowly, stays above black, and is stable in gallery mode',()=>{
 for(const p of [{x:0,y:3,z:0},{x:-97,y:.91,z:-21},{x:-28,y:7.8,z:72}]){
  let previous=hotelVoltage(p,0),min=1,max=0;
  for(let i=1;i<=7600;i++){
   const seconds=i*.01,value=hotelVoltage(p,seconds);assert.ok(Number.isFinite(value)&&value>=.124&&value<=.78);
   assert.ok(Math.abs(value-previous)<.007);previous=value;min=Math.min(min,value);max=Math.max(max,value);
   assert.equal(hotelVoltage(p,seconds,false),.78);
  }
  assert.ok(min<.13&&max>.77);
 }
});
