import test from 'node:test';
import assert from 'node:assert/strict';
import {GamepadSession} from '../app/gamepad-input.ts';
import {TouchInput,allowExploration,needsControllerLock} from '../app/input-actions.ts';
import {RunProgress} from '../app/run-progress.ts';
const pad=(held=false)=>({index:0,id:'DualSense',mapping:'standard',axes:[held?.8:0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false}))});
test('touch can repeatedly resume, move and toggle sprint without Pointer Lock support',()=>{
 const s=new GamepadSession(),touch=new TouchInput();
 for(let i=0;i<5;i++){
  s.poll([]);touch.clear();assert.equal(allowExploration(s.mode,true,true,false),false);
  assert.ok(s.useTouch());assert.equal(new PointerLockPolicy().resume(s.mode),null);
  assert.equal(needsControllerLock(s.mode,false,false),false);assert.equal(allowExploration(s.mode,false,true,false),true);
  assert.ok(touch.start(i,'move',100,100));touch.move(i,100,60);assert.ok(touch.z<0);
  assert.equal(touch.toggleSprint(),true);assert.equal(touch.toggleSprint(),false);touch.end(i);
 }
});
test('real touch in settings can resume from idle controller; held controller rejects emulated handoff',()=>{
 const s=new GamepadSession();s.poll([pad(true)]);assert.equal(s.useTouch(),false);
 assert.equal(new PointerLockPolicy().resume(s.mode),'gamepad');assert.equal(needsControllerLock(s.mode,false,false),true);
 s.poll([pad(false)]);assert.ok(s.useTouch());assert.equal(s.mode,'touch');
 // An old lock rejection must consult current mode, pause and actual lock state.
 assert.equal(needsControllerLock(s.mode,false,false),false);
 s.poll([pad(true)]);assert.equal(needsControllerLock(s.mode,true,false),false);
 assert.equal(needsControllerLock(s.mode,false,true),false);
 assert.equal(needsControllerLock(s.mode,false,false),true);
});
test('switching the lamp off does not erase chase or search warnings',()=>{
 const run=new RunProgress();const status={chasing:true,searching:true,hidden:true,frozen:false,burden:0};
 run.step(.05,status);assert.equal(run.state,'chase');run.step(.05,{...status,chasing:false});assert.equal(run.state,'search');
 run.step(.05,{...status,chasing:false,searching:false});assert.equal(run.state,'hidden');
 run.step(.05,{...status,frozen:true});assert.equal(run.state,'frozen');
});

import {PointerLockPolicy} from '../app/pointer-lock-policy.ts';
test('stale lock success and failure cannot claim a resumed touch session',()=>{
 const p=new PointerLockPolicy(),first=p.begin('gamepad');p.openMenu('gamepad',false);p.touch();
 assert.equal(p.resume('touch'),null);assert.equal(p.accepts(false,'touch'),false);assert.equal(p.reject(first),false);
 const second=p.begin('gamepad');assert.equal(p.reject(first),false);assert.equal(p.pending,second.generation);
 assert.equal(p.accepts(false,'gamepad'),true);assert.equal(p.accepts(true,'gamepad'),false);p.acquired();assert.equal(p.pending,null);
 p.openMenu('gamepad',true);p.touch();assert.equal(p.resume('touch'),null);assert.equal(p.accepts(false,'touch'),false);
});
test('real touch cancels restoration, including a dismissal through a portal backdrop',()=>{
 const p=new PointerLockPolicy();p.begin('mouse');p.acquired();p.openMenu('touch',true);assert.equal(p.resume('touch'),'mouse');
 p.begin('mouse');p.openMenu('touch',true);p.touch();assert.equal(p.resume('touch'),null);
});
