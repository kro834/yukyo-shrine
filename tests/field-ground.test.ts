import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fieldGround,fieldGroundHeight,fieldSurfaceHeight} from '../app/field-ground.ts';

test('field tiles share exact edge heights and join non-field floors without a raised lip',()=>{
 const isField=(x:number,z:number)=>x>=-2&&x<=2&&z>=-2&&z<=2&&!(x===1&&z===1);
 for(const seed of [1,17,4294967295])for(let cx=-2;cx<=2;cx++)for(let cz=-2;cz<=2;cz++)if(isField(cx,cz)){
  const g=fieldGround(cx*4,cz*4,seed,isField),p=g.getAttribute('position'),n=g.getAttribute('normal');
  for(let i=0;i<p.count;i++){
   assert.ok(p.getY(i)>=0&&p.getY(i)<=.014001);assert.ok(n.getY(i)>.98);
   if(!isField(Math.round(p.getX(i)/4),Math.round(p.getZ(i)/4)))assert.equal(p.getY(i),0);
  }
  for(const [dx,dz] of [[1,0],[0,1]])if(isField(cx+dx,cz+dz)){
   const neighbor=fieldGround((cx+dx)*4,(cz+dz)*4,seed,isField),next=neighbor.getAttribute('position');
   const edge=(a:typeof p)=>Array.from({length:a.count},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]).filter(v=>Math.abs((dx?v[0]:v[2])-(dx?cx*4+2:cz*4+2))<.00001).sort((a,b)=>(dx?a[2]-b[2]:a[0]-b[0]));
   assert.deepEqual(edge(p),edge(next));
   neighbor.dispose();
  }
  g.dispose();
 }
 for(const x of [-10,10])for(let z=-10;z<=10;z+=.25)assert.equal(fieldGroundHeight(x,z,17,isField),0);
});
test('plant support height matches actual rendered floor intersections',()=>{
 const isField=(x:number,z:number)=>x>=-2&&x<=2&&z>=-2&&z<=2,material=new THREE.MeshBasicMaterial();
 for(const [x,z] of [[0,0],[-4,8],[8,-8]]){
  const g=fieldGround(x,z,17,isField),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
  for(let i=0;i<40;i++){
   const px=x+Math.sin(i*2.71)*1.99,pz=z+Math.cos(i*1.71)*1.99,ray=new THREE.Raycaster(new THREE.Vector3(px,1,pz),new THREE.Vector3(0,-1,0),0,2),hit=ray.intersectObject(mesh)[0];
   assert.ok(hit);assert.ok(Math.abs(hit.point.y-fieldSurfaceHeight(px,pz,17,isField))<.000001);
  }g.dispose();
 }material.dispose();
});
