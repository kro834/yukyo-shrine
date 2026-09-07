import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSectorLayout} from '../app/sector-layout.ts';
import {createOuterLandformSurfaces} from '../app/outer-landform-surfaces.ts';
import {belowUpperDeck} from '../app/ground-clearance.ts';
import {shrubPlacements} from '../app/shrub-placement.ts';
import {SHRUB_LIMITS} from '../app/shrub-meshes.ts';

test('bank shrub canopies stay outside walkable ground and away from rooms and steep banks',()=>{
 for(const seed of [1,7,17,71]){
  const l=createSectorLayout(seed,'outer'),t=createOuterLandformSurfaces(l.grid,l.landforms,{belowUpperDeck});
  try{
   const ps=shrubPlacements(l,seed,t.height,l.obstacles);assert.ok(ps.length>25&&ps.length<=120);
   assert.deepEqual(ps,shrubPlacements(l,seed,t.height,l.obstacles));
   for(const p of ps){
    assert.ok(Math.abs(p.y-t.height(p.x,p.z)+.035)<1e-6);
    assert.equal(belowUpperDeck(p.x-.55,p.x+.55,p.z-.55,p.z+.55),false);
    for(const c of l.cells){const dx=Math.max(0,Math.abs(c.x*4-p.x)-2),dz=Math.max(0,Math.abs(c.z*4-p.z)-2);assert.ok(Math.hypot(dx,dz)>.77,'canopy crosses walkable ground');}
    assert.ok(l.rooms.every(r=>p.x<r.x1*4-2-.55||p.x>r.x2*4+2+.55||p.z<r.z1*4-2-.55||p.z>r.z2*4+2+.55));
   }
  }finally{t.surfaces.forEach(s=>s.geometry.dispose());}
 }
});
test('all botanical model dependencies exist; visible triangle cost is bounded independently of stage size',()=>{
 const root=new URL('../public/models/shrub/',import.meta.url),g=JSON.parse(fs.readFileSync(new URL('shrub_02_1k.gltf',root),'utf8'));
 for(const r of [...g.images,...g.buffers])assert.ok(fs.existsSync(new URL(r.uri,root)));
 assert.ok(fs.existsSync(new URL('textures/shrub_02_alpha_1k.png',root)),'separate leaf cutout is required for JPEG glTF');
 const tris=g.meshes.map((m:{primitives:{indices:number}[]})=>m.primitives.reduce((n,p)=>n+g.accessors[p.indices].count/3,0));
 assert.equal(tris.length,4);
 assert.ok(Math.max(tris[1],tris[3])*SHRUB_LIMITS.low.count<32000);
 assert.ok(Math.max(...tris)*SHRUB_LIMITS.ultra.count<222000);
});
