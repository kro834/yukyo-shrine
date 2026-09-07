import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {exteriorRoof,exteriorRoofSites} from '../app/exterior-roofs.ts';
import {createSectorLayout} from '../app/sector-layout.ts';
import {belowUpperDeck} from '../app/ground-clearance.ts';

test('exterior roof caps retain headroom and are solid from above and both gable ends',()=>{
 const roof=exteriorRoof(12.5,16.5),material=new THREE.MeshBasicMaterial();
 const metal=new THREE.Mesh(roof.metal,material),gables=new THREE.Mesh(roof.gables,material);metal.updateMatrixWorld();gables.updateMatrixWorld();
 for(const x of [-5,5])assert.ok(new THREE.Raycaster(new THREE.Vector3(x,4,0),new THREE.Vector3(0,-1,0)).intersectObject(metal).length);
 for(const sign of [-1,1])assert.ok(new THREE.Raycaster(new THREE.Vector3(0,.5,sign*10),new THREE.Vector3(0,0,-sign)).intersectObject(gables).length);
 const trim=new THREE.Mesh(roof.trim,material);trim.updateMatrixWorld();
 for(const sign of [-1,1])assert.ok(new THREE.Raycaster(new THREE.Vector3(sign*10,-.6,0),new THREE.Vector3(-sign,0,0)).intersectObject(trim).length,'collar seals the gap above shorter exterior walls');
 let triangles=0;
 for(const g of [roof.metal,roof.gables,roof.trim]){
  const p=g.getAttribute('position'),n=g.getAttribute('normal');triangles+=g.index!.count/3;
  for(let i=0;i<p.count;i++){assert.ok(p.getY(i)>=-.900001);assert.ok(Math.abs(n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2-1)<1e-5);}
  g.dispose();
 }
 assert.ok(triangles<1500,'corrugation, sealed collar and four rake boards fit within 1500 triangles per representative roof');material.dispose();
});

test('only buildings near outdoor paths receive caps, and upper walkways remain clear',()=>{
 for(const seed of [1,17,71]){
  const layout=createSectorLayout(seed,'outer'),sites=exteriorRoofSites(layout.rooms,layout.cells);assert.ok(sites.length>0&&sites.length<30);
  for(const r of sites){
   assert.equal(belowUpperDeck(r.x1*4-2.3,r.x2*4+2.3,r.z1*4-2.3,r.z2*4+2.3),false);
   assert.ok(layout.cells.some(c=>c.kind==='field'&&c.x>=r.x1-2&&c.x<=r.x2+2&&c.z>=r.z1-2&&c.z<=r.z2+2));
  }
 }
});
