import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Enemies} from '../app/shrine-gameplay.ts';
import {Posture,STAND_EYE,CROUCH_EYE,CROUCH_PACE} from '../app/posture.ts';
import {createWorld} from '../app/shrine-world.ts';
import {DEFAULTS} from '../app/preferences.ts';
import {WALK_SPEED} from '../app/movement.ts';
import {ButtonEdges} from '../app/input-actions.ts';
import type {Cell} from '../app/shrine-layout.ts';
const corridor:Cell[]=Array.from({length:12},(_,x)=>({x,z:0,h:4,kind:'hall'}));
const glance=(crouching:boolean,distance:number,finale=false)=>{
 const enemies=new Enemies(corridor,[]),e=enemies.actors[0];enemies.actors=[e];
 if(finale)e.kind='hatred';
 e.position={x:0,z:0};e.facing=Math.PI/2;enemies.playerCrouching=crouching;
 enemies.update(.05,{x:distance,z:0},[],0,undefined,true,undefined,true);
 return e.brain.mode;
};
test('a lit crouching visitor is seen over a shorter range, but never by a final pursuer',()=>{
 // A blue-area normal enemy sees 10 m; crouching shortens it to 6 m.
 assert.equal(glance(false,8),'chase');assert.equal(glance(true,8),'patrol');
 assert.equal(glance(true,5),'chase');assert.equal(glance(true,8,true),'chase');
});
test('posture eases the eye height and any sprint request stands the visitor up',()=>{
 const p=new Posture();assert.equal(p.step(.05),STAND_EYE);
 assert.equal(p.toggle(),true);assert.equal(p.resolve(false,true),false);assert.equal(p.crouching,true);
 for(let i=0;i<40;i++)p.step(.05);assert.equal(p.eye,CROUCH_EYE);
 assert.equal(p.resolve(true,false),false,'holding sprint while still keeps the crouch');assert.equal(p.crouching,true);
 assert.equal(p.resolve(true,true),true);assert.equal(p.crouching,false);
 p.toggle();p.reset();assert.deepEqual([p.crouching,p.eye],[false,STAND_EYE]);
});
test('Triangle and R3 toggle crouch once per press',()=>{
 for(const button of [3,11]){
  const pad=(pressed:boolean)=>({id:'DualSense',mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:pressed&&i===button}))});
  const edges=new ButtonEdges();assert.equal(edges.update(pad(true)).crouch,true);assert.equal(edges.update(pad(true)).crouch,false);assert.equal(edges.update(pad(false)).crouch,false);
 }
});
test('world crouch halves the walking pace, lowers the view, informs enemies and resets on capture',t=>{
 const crouched:boolean[]=[];let caught=false;
 t.mock.method(Enemies.prototype,'update',function(this:Enemies){crouched.push(this.playerCrouching);return caught;});
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,1);
 try{
  world.configure({...DEFAULTS,quality:'low'});world.setMode('normal');
  assert.equal(world.toggleCrouch(),true);assert.equal(world.crouching,true);
  world.camera.position.set(0,1.68,5);let p=world.move(0,-1,0,false,.05);
  assert.ok(Math.abs(5-p.z-WALK_SPEED*.05*CROUCH_PACE)<1e-6);assert.equal(p.running,false);
  for(let i=0;i<40;i++)p=world.move(0,0,0,false,.05);assert.ok(Math.abs(p.y-CROUCH_EYE)<1e-3);
  world.step(.05);assert.equal(crouched.at(-1),true);
  world.camera.position.set(0,1.68,5);p=world.move(0,-1,0,true,.05);assert.equal(world.crouching,false);assert.equal(p.running,true);
  world.toggleCrouch();caught=true;world.step(.05);assert.equal(world.crouching,false);
 }finally{world.dispose();}
});
test('Nightmare always limits sprinting even when the stamina option is off',t=>{
 t.mock.method(Enemies.prototype,'update',()=>false);
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,3);
 try{
  world.configure({...DEFAULTS,quality:'low',stamina:false});assert.equal(world.staminaStatus().enabled,false);
  world.setMode('nightmare');assert.equal(world.staminaStatus().enabled,true);
  world.configure({...DEFAULTS,quality:'low',stamina:false});assert.equal(world.staminaStatus().enabled,true);
  world.setMode('normal');assert.equal(world.staminaStatus().enabled,false);
 }finally{world.dispose();}
});
