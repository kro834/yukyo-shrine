import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createWallPostCollector} from '../app/wall-posts.ts';
import {RunProgress} from '../app/run-progress.ts';

test('shared straight and corner wall joints produce a single full height post',()=>{
 const c=createWallPostCollector();
 c.add({x:0,z:2,alongX:true,h:3.8});c.add({x:4,z:2,alongX:true,h:4.2});
 c.add({x:2,z:4,alongX:false,h:3.6});
 assert.equal(c.values().length,4);
 assert.deepEqual(c.values().find(p=>p.x===2&&p.z===2),{x:2,z:2,h:4.2});
});

test('outer buildings have continuous indoor floors and room-height ceilings; other stages have no stray paddies',()=>{
 for(const seed of [1,7,17,31,71])for(const stage of ['shrine','outer','abyss','orchestra','circus'] as const){
  const l=createSectorLayout(seed,stage);assert.equal(l.paddies.length,0);
  if(stage!=='outer')continue;
  for(const r of l.rooms)for(let x=r.x1;x<=r.x2;x++)for(let z=r.z1;z<=r.z2;z++){
   const c=l.grid.get(x+','+z);assert.ok(c,'room lost to landscape carving');
   assert.notEqual(c.kind,'field','indoor room rendered as an open field');
   if(l.sectors.find(s=>x>=s.x1&&x<=s.x2&&z>=s.z1&&z<=s.z2)?.kind==='field')assert.equal(c.h,r.h);
  }
 }
});

test('alert meter follows small distance changes in both directions and clears on safety',()=>{
 const r=new RunProgress(),s={chasing:true,searching:false,hidden:false,frozen:false,burden:0};
 const value=(distance:number)=>{r.step(.016,{...s,distance});return r.pressure;};
 const a=value(20),b=value(20.1),c=value(19.9);
 assert.ok(b<a&&c>a);assert.ok(a<1&&a>0);
 assert.equal(value(20),a,'no accumulated or random drift');
 r.step(.016,{...s,chasing:false,searching:true,distance:20});const search=r.pressure;
 r.step(.016,{...s,chasing:false,searching:true,distance:20.1});assert.ok(r.pressure<search);
 r.step(.016,{...s,chasing:false,distance:0});assert.equal(r.pressure,0);
 r.step(.016,{...s,frozen:true,distance:0});assert.equal(r.pressure,0);
 r.step(.016,{...s,stunned:true,distance:0});assert.equal(r.pressure,0);
});
