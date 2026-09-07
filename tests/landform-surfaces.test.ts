import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createOuterLandformSurfaces} from '../app/outer-landform-surfaces.ts';
import {belowUpperDeck} from '../app/ground-clearance.ts';
import {fieldFoliageRoots} from '../app/field-landscape.ts';

test('lowered banks join exactly, cover new landscape voids, and match planting heights',()=>{
 for(const seed of [1,7,17,31]){
  const layout=createSectorLayout(seed,'outer'),terrain=createOuterLandformSurfaces(layout.grid,layout.landforms,{belowUpperDeck});
  assert.equal(new Set(layout.landforms.map(r=>r.identity)).size,6);
  assert.ok(terrain.triangleCount<80000);
  const shared=new Map<string,number[]>(),covered=new Set(terrain.tiles.map(t=>t.x+','+t.z));
  for(const r of layout.landforms)for(const c of r.removed)if(!belowUpperDeck(c.x*4-2,c.x*4+2,c.z*4-2,c.z*4+2))assert.ok(covered.has(c.x+','+c.z));
  for(const s of terrain.surfaces){
   assert.ok(!layout.grid.has(s.x+','+s.z));
   if(s.water){assert.ok(!['underpass','greenway'].includes(s.identity));continue;}
   const p=s.geometry.getAttribute('position'),n=s.geometry.getAttribute('normal'),index=s.geometry.index!;
   for(let i=0;i<32*3;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],average=(axis:'X'|'Y'|'Z')=>ids.reduce((sum,j)=>sum+p['get'+axis as 'getX'](j),0)/3;
    assert.ok(Math.abs(terrain.height(average('X'),average('Z'))-average('Y'))<1e-6);
   }
   for(let i=0;i<25;i++){
    const k=p.getX(i)+','+p.getZ(i),record=[p.getY(i),n.getX(i),n.getY(i),n.getZ(i)];
    assert.ok(record.every(Number.isFinite));assert.ok(n.getY(i)>0);assert.ok(p.getY(i)<=0);
    if(shared.has(k))assert.deepEqual(record,shared.get(k));else shared.set(k,record);
   }
  }
  const roots=fieldFoliageRoots(layout,seed,()=>0,layout.obstacles,terrain.height).roots;
  for(const p of roots.filter(p=>p.kind==='verge'))assert.ok(Math.abs(p.y+.002-terrain.height(p.x,p.z))<1e-7);
  assert.ok(roots.some(p=>p.kind==='verge'&&p.y<-.4),'plants must follow sloped banks');
  terrain.surfaces.forEach(s=>s.geometry.dispose());
 }
});

test('organic bank relief leaves paths level and concrete drainage slopes unwarped',()=>{
 const grid=new Map([['0,0',{x:0,z:0,kind:'field'}]]);
 for(const identity of ['levee','underpass'] as const){
  const terrain=createOuterLandformSurfaces(grid,[{sectorId:'bank',identity,cx:0,cz:0,rotation:0,removed:[{x:1,z:0,kind:'field'}]}]);
  try{
   for(const z of [-1,0,1])assert.equal(terrain.analyticalHeight(2,z),0,'path edge must meet the bank exactly');
   const depth=identity==='levee'?1.8:1.25;
   const residuals=[-.8,0,.8].map(z=>terrain.analyticalHeight(4,z)+depth*2/4.8);
   if(identity==='underpass')assert.ok(residuals.every(r=>Math.abs(r)<1e-10));
   else {assert.ok(residuals.some(r=>Math.abs(r)>.005));assert.ok(residuals.every(r=>Math.abs(r)<.175));}
  }finally{terrain.surfaces.forEach(s=>s.geometry.dispose());}
 }
});
