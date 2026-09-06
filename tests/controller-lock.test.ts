import test from 'node:test';
import assert from 'node:assert/strict';
import {allowExploration,allowMouseLook} from '../app/input-actions.ts';
test('controller simulation requires an actual pointer lock, including after settings and Escape',()=>{
 assert.equal(allowExploration('gamepad',false,true,false),false);
 assert.equal(allowExploration('gamepad',false,true,true),true);
 assert.equal(allowExploration('gamepad',true,true,true),false);
 assert.equal(allowExploration('gamepad',false,false,true),false);
 for(const locked of [true,false,true,false,true])assert.equal(allowExploration('gamepad',false,true,locked),locked);
});
test('controller mouse movement is ignored even while locked; touch needs no mouse lock',()=>{
 assert.equal(allowMouseLook('gamepad',false,true),false);
 assert.equal(allowExploration('touch',false,true,false),true);
 assert.equal(allowExploration('touch',true,true,false),false);
});
