import test from 'node:test';
import assert from 'node:assert/strict';
import {BurstRecharge} from '../app/burst-recharge.ts';
test('burst cannot chain stun and becomes reusable after fourteen simulation seconds',()=>{
 const b=new BurstRecharge();assert.equal(b.use(),true);assert.equal(b.use(),false);
 b.step(9);assert.equal(b.remaining,5);assert.equal(b.use(),false);
 b.step(-5);assert.equal(b.remaining,5);
 b.step(4.99);assert.equal(b.use(),false);b.step(.01);assert.equal(b.remaining,0);assert.equal(b.use(),true);
});
