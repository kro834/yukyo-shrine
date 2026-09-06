import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustRange,viewDelta,hidePlayCursor} from '../app/view-controls.ts';
import {DEFAULTS} from '../app/preferences.ts';
test('controller setting changes immediately affect next-frame yaw and pitch',()=>{
 let p={...DEFAULTS};
 const before=viewDelta('gamepad',.6,.4,1/60,p);
 for(let i=0;i<4;i++)p=adjustRange(p,'stickSensitivity',1);
 assert.equal(p.stickSensitivity,2);
 const after=viewDelta('gamepad',.6,.4,1/60,p);
 assert.equal(after.yaw,before.yaw*2);assert.equal(after.pitch,before.pitch*2);
});
test('touch and mouse sensitivity scale actual angular deltas independently',()=>{
 for(const source of ['touch','mouse'] as const){
   const key=source==='touch'?'touchSensitivity':'mouseSensitivity';
   const low=viewDelta(source,20,10,0,{...DEFAULTS,[key]:.25});
   const high=viewDelta(source,20,10,0,{...DEFAULTS,[key]:3});
   assert.ok(Math.abs(high.yaw/low.yaw-12)<1e-10);
   assert.ok(Math.abs(high.pitch/low.pitch-12)<1e-10);
 }
});
test('sensitivity edits preserve view direction and clamp to usable limits',()=>{
 let p={...DEFAULTS};
 for(let i=0;i<100;i++)p=adjustRange(p,'stickSensitivity',-1);
 assert.equal(p.stickSensitivity,.25);
 for(let i=0;i<100;i++)p=adjustRange(p,'stickSensitivity',1);
 assert.equal(p.stickSensitivity,3);
 const normal=viewDelta('gamepad',1,1,.01,p),inverted=viewDelta('gamepad',1,1,.01,{...p,invertY:true});
 assert.equal(normal.yaw,inverted.yaw);assert.equal(normal.pitch,-inverted.pitch);
});
test('cursor is hidden throughout play, regardless of input mode or changed sensitivity',()=>{
 for(const mode of ['gamepad','touch','mouse','disconnected']){
   assert.equal(hidePlayCursor(false),true,mode);
   for(let i=0;i<20;i++){adjustRange(DEFAULTS,'stickSensitivity',i%2?1:-1);assert.equal(hidePlayCursor(false),true);}
   assert.equal(hidePlayCursor(true),false,mode);
   assert.equal(hidePlayCursor(false),true,mode);
 }
});

