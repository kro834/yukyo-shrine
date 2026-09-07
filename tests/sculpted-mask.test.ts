import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sculptedMask} from '../app/sculpted-mask.ts';

const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const ray=(mesh:THREE.Mesh,x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh,false)[0];
const near=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

void test('photographic eye and mouth landmarks are actual front apertures backed by dark recessed linings',()=>{
 const geometry=sculptedMask(),front=geometry.clone();
 front.setIndex(Array.from(geometry.index!.array).slice(0,geometry.userData.maskFaceTriangles*3));
 const frontMesh=new THREE.Mesh(front,material),wholeMesh=new THREE.Mesh(geometry,material);
 const features=[[-.0633,.0219,.014],[.059,.0219,.014],[0,-.116,.018],[-.011,-.074,.0015],[.011,-.074,.0015]];
 features.forEach(([x,y,offset],feature)=>{
  for(const dx of [-offset,0,offset]){
   assert.equal(ray(frontMesh,x+dx,y),undefined,`front shell seals feature ${feature}`);
   const hit=ray(wholeMesh,x+dx,y);assert.ok(hit?.face,`feature ${feature} has no lining`);
   near(hit.point.z,geometry.userData.maskApertures[feature].lining);
   assert.ok(geometry.userData.maskApertures[feature].front-hit.point.z>.017);
   const color=geometry.getAttribute('color');
   for(const id of [hit.face.a,hit.face.b,hit.face.c])for(let c=0;c<3;c++)assert.ok(color.getComponent(id,c)<.025,'photo multiplication must preserve a dark cavity');
  }
 });
 front.dispose();geometry.dispose();
});

void test('nose silhouette has a supported tip, bridge and carved underside without broad painted eye stains',()=>{
 const geometry=sculptedMask(),mesh=new THREE.Mesh(geometry,material);
 const tip=ray(mesh,0,-.060)!.point.z,bridge=ray(mesh,0,-.029)!.point.z,cheek=ray(mesh,.040,-.060)!.point.z,underside=ray(mesh,0,-.085)!.point.z;
 assert.ok(tip>.087&&tip<.090);assert.ok(bridge>.079&&bridge<tip);
 assert.ok(tip-cheek>.035);assert.ok(tip-underside>.030);
 const color=geometry.getAttribute('color');
 for(let i=0;i<geometry.userData.maskFaceTriangles*3;i++)assert.ok(color.getX(geometry.index!.getX(i))>.96,'the photograph owns front-face pigmentation');
 geometry.dispose();
});

void test('every mask variant shares the frontal photo projection, clean indexed topology and existing envelope',()=>{
 const reference=sculptedMask(0),other=sculptedMask(7);
 assert.deepEqual(reference.index!.array,other.index!.array);
 assert.deepEqual(reference.getAttribute('position').array,other.getAttribute('position').array);
 assert.deepEqual(reference.getAttribute('uv').array,other.getAttribute('uv').array);
 assert.notDeepEqual(reference.getAttribute('color').array,other.getAttribute('color').array);
 for(const geometry of [reference,other]){
  assert.ok(geometry.index!.count/3<=2200);
  const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),ix=geometry.index!;
  assert.equal(normal.count,p.count);assert.equal(uv.count,p.count);assert.equal(geometry.getAttribute('color').count,p.count);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   assert.ok(Math.abs(x)<=.140001&&Math.abs(y)<=.230001&&Math.abs(z)<=.090001);
   near(uv.getX(i),x/.4+.5);near(uv.getY(i),y/.6+.5);
   near(new THREE.Vector3().fromBufferAttribute(normal,i).length(),1);
  }
  for(let i=0;i<ix.count;i+=3){
   const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+2));
   const cross=b.sub(a).cross(c.sub(a));assert.ok(cross.length()>1e-10,'degenerate geometry');
   if(i<geometry.userData.maskFaceTriangles*3){
    assert.ok(cross.z>0,'front shell winding must face the viewer');
    for(let edge=0;edge<3;edge++){
     const a=ix.getX(i+edge),b=ix.getX(i+(edge+1)%3);
     assert.ok(Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b))<.04,'long triangle fans fold the photographed face under lighting');
    }
   }
  }
 }
 const merged=mergeGeometries([reference,other]);assert.ok(merged);merged.dispose();reference.dispose();other.dispose();
});
