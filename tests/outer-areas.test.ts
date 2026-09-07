import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectorLayout} from '../app/sector-layout.ts';
import {NEW_HORROR_AREAS} from '../app/horror-areas.ts';
import {OUTER_MEMORY_AREAS,assignOuterAreas,buildOuterShell} from '../app/outer-areas.ts';
import {belowUpperDeck} from '../app/ground-clearance.ts';

test('Outer has eight dispersed nostalgic rooms without changing identities, routes or the original thirty themes',()=>{
 const ids=OUTER_MEMORY_AREAS.map(t=>t.id),idSet=new Set(ids),arrangements=new Set<string>();
 for(let seed=1;seed<=120;seed++){
  const l=createSectorLayout(seed,'outer'),selected=l.rooms.filter(r=>idSet.has(r.themeId??''));
  assert.equal(selected.length,8);assert.deepEqual(selected.map(r=>r.themeId).sort(),[...ids].sort());
  assert.equal(new Set(selected.map(r=>`${Math.round((r.x1+r.x2)/38)},${Math.round((r.z1+r.z2)/38)}`)).size,8);
  for(const r of selected)assert.equal(belowUpperDeck(r.x1*4-2,r.x2*4+2,r.z1*4-2,r.z2*4+2),false);
  for(const t of NEW_HORROR_AREAS)assert.equal(l.rooms.filter(r=>r.themeId===t.id).length,1);
  const restored=l.rooms.map(r=>({...r,themeId:idSet.has(r.themeId??'')?undefined:r.themeId}));
  const before=restored.map(({themeId,...r})=>r);assignOuterAreas(restored,seed,'outer');
  assert.deepEqual(restored,l.rooms);assert.deepEqual(restored.map(({themeId,...r})=>r),before);
  for(const stage of ['shrine','abyss','orchestra'] as const){const copy=restored.map(r=>({...r,themeId:idSet.has(r.themeId??'')?undefined:r.themeId}));const snapshot=structuredClone(copy);assignOuterAreas(copy,seed,stage);assert.deepEqual(copy,snapshot);}
  arrangements.add(selected.map(r=>r.themeId+':'+r.x1+','+r.z1).join(';'));
 }
 assert.equal(arrangements.size,120);
});

test('Outer ceiling and wall signatures keep offset doors and floor clearances unobstructed',()=>{
 for(const theme of OUTER_MEMORY_AREAS)for(const width of [3,4])for(const depth of [3,4]){
  const r={id:'test',themeId:theme.id,x1:0,x2:width-1,z1:0,z2:depth-1,h:3.6,style:'tatami' as const},cx=(r.x1+r.x2)*2,cz=(r.z1+r.z2)*2;
  const boxes:{x:number;y:number;z:number;w:number;h:number;d:number}[]=[];
  assert.equal(buildOuterShell(r,{box:(x,y,z,w,h,d)=>boxes.push({x,y,z,w,h,d}),fixture(){},cylinder(){},block(){throw new Error('Signature must not add ground blockers');}}),true);
  for(const p of boxes){
   assert.ok(p.w>0&&p.h>0&&p.d>0);assert.ok(p.y+p.h/2<=r.h);
   if(p.y+p.h/2<.05||p.y-p.h/2>2.8)continue;
   assert.ok(Math.abs(p.x-cx)-p.w/2>=2.65||Math.abs(p.z-cz)-p.d/2>=2.65);
  }
 }
});
