import test from 'node:test';import assert from 'node:assert/strict';
import {RunProgress,threatTarget} from '../app/run-progress.ts';
const chase={chasing:true,searching:false,hidden:false,frozen:false,burden:0,distance:8};

test('danger grows with proximity and distinguishes a search from a pursuit without revealing idle foes',()=>{
 for(const distance of [2,5,10,20,40,80]){
  assert.ok(threatTarget({...chase,distance})>threatTarget({...chase,distance:distance+.1}));
  assert.ok(threatTarget({...chase,distance})>threatTarget({...chase,chasing:false,searching:true,distance}));
 }
 assert.equal(threatTarget({...chase,chasing:false,distance:0}),0);
 assert.equal(threatTarget({...chase,chasing:false,hidden:true,distance:0}),0);
});

test('the fill is smooth, urgent at close range and independent of refresh rate',()=>{
 const a=new RunProgress(),b=new RunProgress(),search=new RunProgress();
 a.step(1/60,chase);assert.ok(a.pressure>0&&a.pressure<threatTarget(chase)*.2,'no one-frame jump to a full warning');
 for(let i=1;i<60;i++)a.step(1/60,chase);
 for(let i=0;i<30;i++)b.step(1/30,chase);
 assert.ok(Math.abs(a.pressure-b.pressure)<1e-8);
 for(let i=0;i<60;i++)search.step(1/60,{...chase,chasing:false,searching:true});
 assert.ok(a.pressure>search.pressure&&a.pressure>threatTarget(chase)*.98);
 const close=a.pressure;a.step(.1,{...chase,distance:50});assert.ok(a.pressure<close&&a.pressure>threatTarget({...chase,distance:50}));
});

test('safety and incapacitation clear immediately; invalid samples and zero-time frames cannot corrupt the gauge',()=>{
 for(const status of [{...chase,chasing:false,hidden:true},{...chase,frozen:true},{...chase,stunned:true},{...chase,distance:Infinity},{...chase,distance:NaN}]){
  const run=new RunProgress();run.step(.1,chase);run.step(.01,status);assert.equal(run.pressure,0);
 }
 const run=new RunProgress();run.step(.1,chase);const old=run.pressure;
 for(const dt of [NaN,Infinity,-.1,0]){run.step(dt,chase);assert.equal(run.pressure,old);assert.ok(Number.isFinite(run.elapsed));}
 run.defeated();assert.equal(run.pressure,0);run.step(.1,chase);run.beginFinale();assert.equal(run.pressure,0);
});
