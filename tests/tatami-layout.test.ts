import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {interlockedTatami} from '../app/tatami-layout.ts';
import {createTatamiGeometry,tatamiPlacementsForRectangle,TATAMI} from '../app/tatami-geometry.ts';

test('six- and eight-mat rooms use complete T-junction layouts with both mat directions',()=>{
 for(const [columns,rows] of [[3,4],[4,4],[4,8],[6,8]]){
  const result=interlockedTatami(columns,rows);assert.ok(result);assert.equal(result.length,columns*rows/2);
  const cells=new Int16Array(columns*rows);
  result.forEach(([a,b],i)=>{assert.ok((b===a+1&&Math.floor(a/columns)===Math.floor(b/columns))||b===a+columns);assert.equal(cells[a],0);assert.equal(cells[b],0);cells[a]=cells[b]=i+1;});
  assert.ok(cells.every(c=>c>0));
  for(let z=1;z<rows;z++)for(let x=1;x<columns;x++)assert.ok(new Set([cells[(z-1)*columns+x-1],cells[(z-1)*columns+x],cells[z*columns+x-1],cells[z*columns+x]]).size<4);
  assert.ok(result.some(([a,b])=>b-a===1)&&result.some(([a,b])=>b-a===columns));
 }
});

test('alternating mat placement preserves whole-mat dimensions, clearance and full floor coverage',()=>{
 for(const [columns,rows] of [[3,4],[4,8],[12,16],[20,24]])for(const variation of [0,1]){
  const width=columns*.9,depth=rows*.9,mats=tatamiPlacementsForRectangle({x:0,z:0,width:width+.2,depth:depth+.2,floorY:4.78,inset:.09,variation});
  assert.equal(mats.length,columns*rows/2);
  const occupancy=new Uint8Array(columns*rows);
  for(const m of mats){
   const horizontal=!!m.rotation,hw=horizontal?.9:.45,hd=horizontal?.45:.9;
   assert.ok(m.x-hw>=-width/2-1e-7&&m.x+hw<=width/2+1e-7&&m.z-hd>=-depth/2-1e-7&&m.z+hd<=depth/2+1e-7);
   for(let z=0;z<rows;z++)for(let x=0;x<columns;x++)if(Math.abs((x+.5)*.9-width/2-m.x)<hw&&Math.abs((z+.5)*.9-depth/2-m.z)<hd)occupancy[z*columns+x]++;
  }
  assert.ok(occupancy.every(n=>n===1),'no overlaps or holes');
 }
});

test('short mat edges are straw, while the two long edges alone carry heri cloth',()=>{
 const g=createTatamiGeometry([{x:0,z:0,floorY:0}]),material=new THREE.MeshBasicMaterial();
 const reed=new THREE.Mesh(g.reed,material),border=new THREE.Mesh(g.border,material);reed.updateMatrixWorld();border.updateMatrixWorld();
 for(const z of [-.89,.89]){
  const ray=new THREE.Raycaster(new THREE.Vector3(0,1,z),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObject(reed).length);assert.equal(ray.intersectObject(border).length,0);
 }
 for(const x of [-.44,.44])assert.ok(new THREE.Raycaster(new THREE.Vector3(x,1,0),new THREE.Vector3(0,-1,0)).intersectObject(border).length);
 assert.equal((g.reed.index!.count+g.border.index!.count)/3,TATAMI.trianglesPerMat);
 g.reed.dispose();g.border.dispose();material.dispose();
});
