import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {createEffects} from '../app/shrine-effects.ts';
import {lanternBody} from '../app/lantern-body.ts';

test('changing effect quality releases every bloom high-pass filter exactly once',t=>{
 Object.assign(globalThis,{innerWidth:320,innerHeight:180});
 const records=new Map<UnrealBloomPass,{disposed:number}>(),setSize=UnrealBloomPass.prototype.setSize;
 t.mock.method(UnrealBloomPass.prototype,'setSize',function(this:UnrealBloomPass,w:number,h:number){
  if(!records.has(this)){const record={disposed:0};records.set(this,record);this.materialHighPassFilter.addEventListener('dispose',()=>record.disposed++);}
  return setSize.call(this,w,h);
 });
 const renderer={getPixelRatio:()=>1,getSize:(v:THREE.Vector2)=>v.set(320,180),getDrawingBufferSize:(v:THREE.Vector2)=>v.set(320,180),capabilities:{maxSamples:4}} as THREE.WebGLRenderer;
 for(const quality of ['ultra','high','ultra'] as const){const effects=createEffects(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),false,quality==='ultra');effects.configure(quality);effects.resize();effects.dispose();}
 assert.equal(records.size,3);for(const r of records.values())assert.equal(r.disposed,1);
});

test('both fitted lantern bodies have nondegenerate indexed surfaces and visible outward faces',()=>{
 for(const large of [false,true]){
  const body=lanternBody(large);
  for(const g of [body.shade,body.caps,body.ribs]){
   assert.ok(g.index);const p=g.getAttribute('position'),n=g.getAttribute('normal');
   for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<.001);assert.ok(p.getY(i)>=body.bottom-1e-6&&p.getY(i)<=body.top+1e-6);}
   for(let i=0;i<g.index.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(i)),b=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(p,g.index.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-9);}
  }
  const mesh=new THREE.Mesh(body.shade,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();assert.ok(new THREE.Raycaster(new THREE.Vector3(0,0,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0);mesh.material.dispose();body.shade.dispose();body.caps.dispose();body.ribs.dispose();
 }
});
