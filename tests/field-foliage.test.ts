import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSectorLayout} from '../app/sector-layout.ts';
import {fieldFoliageRoots} from '../app/field-landscape.ts';
import {makeFoliageGeometry,FOLIAGE_LIMITS} from '../app/field-foliage.ts';

test('curved plants respect visual heights and stay below the global geometry budget',()=>{
 for(const kind of ['short','verge','reed'] as const)for(let seed=0;seed<12;seed++){
  const g=makeFoliageGeometry(kind,seed),p=g.getAttribute('position'),n=g.getAttribute('normal');
  assert.equal(g.index!.count/3,FOLIAGE_LIMITS[kind].triangles);
  for(let i=0;i<p.count;i++){assert.ok(p.getY(i)>=0);assert.ok(p.getY(i)<=({short:.13,verge:.62,reed:.98}[kind])+.000001);assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.0001);}
  g.dispose();
 }
});
test('tall field plants have no vertices on walkable cells and scatter is deterministic',()=>{
 const v=new THREE.Vector3();
 for(const stage of ['shrine','abyss','outer','orchestra','circus'] as const){
  const layout=createSectorLayout(17,stage),scatter=fieldFoliageRoots(layout,17,()=>0,layout.obstacles),variants=new Map<string,THREE.BufferGeometry>();
  if(stage!=='outer')assert.equal(scatter.counts.verge,0);
  assert.ok(Object.entries(scatter.counts).reduce((sum,[kind,count])=>sum+count*FOLIAGE_LIMITS[kind as keyof typeof FOLIAGE_LIMITS].triangles,0)<=143600);
  for(const root of scatter.roots){
   assert.ok(!layout.rooms.some(r=>root.x>=r.x1*4-2&&root.x<=r.x2*4+2&&root.z>=r.z1*4-2&&root.z<=r.z2*4+2));
   if(root.kind!=='verge')continue;
   const key=root.kind+':'+root.variant;if(!variants.has(key))variants.set(key,makeFoliageGeometry(root.kind,17^Math.imul(root.variant+1,7331)));
   const p=variants.get(key)!.getAttribute('position'),m=new THREE.Matrix4().makeRotationY(root.yaw).setPosition(root.x,root.y,root.z);
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);assert.ok(!layout.grid.has(Math.round(v.x/4)+','+Math.round(v.z/4)));assert.ok(v.y>=-.252001);}
  }
  variants.forEach(g=>g.dispose());
  assert.deepEqual(scatter,fieldFoliageRoots(layout,17,()=>0,layout.obstacles));
 }
});
