import test from 'node:test';
import assert from 'node:assert/strict';
import {planOuterLandforms,type GridCell} from '../app/outer-landform-plan.ts';

test('all six landforms close unused ports and preserve protected room loops',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const source=new Map<string,GridCell>(),sectors=[],rooms=[];
  for(let i=0;i<6;i++){
   const cx=i*20;sectors.push({id:'field-'+i,x1:cx-8,x2:cx+8,z1:-8,z2:8,kind:'field',rotation});rooms.push({x1:cx-5,x2:cx-3,z1:3,z2:5});
   for(let x=cx-8;x<=cx+8;x++)for(let z=-8;z<=8;z++)source.set(x+','+z,{x,z,h:5,kind:'field'});
  }
  const {grid,regions}=planOuterLandforms(source,sectors,rooms,c=>c.z===7&&c.x%20===0);
  for(const c of grid.values())assert.ok([[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>grid.has((c.x+dx)+','+(c.z+dz))).length>=2,'new blind endpoint');
  for(const r of regions){
   const sector=sectors.find(s=>s.id===r.sectorId)!;
   assert.ok(grid.has((sector.x1+8)+',7'));
   assert.ok(r.removed.length>40);
   assert.equal(r.removed.length+r.routeCells.length,17*17);
   for(const c of r.removed)assert.ok(!grid.has(c.x+','+c.z));
   for(const [x,z] of r.routeCells)assert.ok(grid.has(x+','+z));
  }
 }
});
