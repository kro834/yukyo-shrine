import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {ContactOcclusion,contactDistances} from '../app/contact-occlusion.ts';
import {surfaceUV} from '../app/surface-uv.ts';
import {createWorld} from '../app/shrine-world.ts';
import {DEFAULTS} from '../app/preferences.ts';

test('contact thresholds retain centimetre-scale crevices regardless of view distance',()=>{
 for(const far of [50,180,500]){const near=.08,p=contactDistances(near,far);assert.ok(Math.abs(p.minDistance*(far-near)-.018)<1e-10);assert.ok(Math.abs(p.maxDistance*(far-near)-.55)<1e-10);assert.ok(.025/(far-near)>p.minDistance);assert.ok(.8/(far-near)>p.maxDistance);assert.equal(p.kernelRadius,.5);}
});

test('contact pass excludes overlays, restores state after exceptions, and follows changing camera settings',t=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,180),solid=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 const translucent=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial({transparent:true,opacity:.5,depthWrite:false})),hidden=translucent.clone(),points=new THREE.Points(),reflection=new THREE.Mesh();
 Object.assign(reflection,{isReflector:true});hidden.visible=false;scene.add(solid,translucent,hidden,points,reflection);
 const pass=new ContactOcclusion(scene,camera,1280,720),override=new THREE.MeshNormalMaterial();scene.overrideMaterial=override;
 let target=new THREE.WebGLRenderTarget(8,8),color=new THREE.Color('#123456'),alpha=.6;const originalTarget=target,originalColor=color.clone();
 const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:true},getRenderTarget:()=>target,setRenderTarget(v:THREE.WebGLRenderTarget){target=v;},getClearColor:(v:THREE.Color)=>v.copy(color),getClearAlpha:()=>alpha,setClearColor(v:THREE.Color,a:number){color.copy(v);alpha=a;}} as unknown as THREE.WebGLRenderer;
 t.mock.method(SSAOPass.prototype,'render',()=>{
  assert.equal(solid.visible,true);for(const o of [translucent,hidden,points,reflection])assert.equal(o.visible,false);
  assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(renderer.shadowMap.needsUpdate,false);
  renderer.autoClear=false;renderer.setRenderTarget(null);renderer.setClearColor('#ffffff',1);scene.overrideMaterial=null;throw new Error('render failure');
 });
 camera.far=250;camera.fov=90;camera.updateProjectionMatrix();
 try{
  assert.throws(()=>pass.render(renderer,originalTarget,originalTarget),/render failure/);
  assert.equal(target,originalTarget);assert.deepEqual(color,originalColor);assert.equal(alpha,.6);assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,true);assert.equal(scene.overrideMaterial,override);
  assert.equal(hidden.visible,false);for(const o of [solid,translucent,points,reflection])assert.equal(o.visible,true);
  assert.deepEqual(pass.ssaoMaterial.uniforms.cameraProjectionMatrix.value,camera.projectionMatrix);assert.deepEqual(pass.blurMaterial.uniforms.cameraInverseProjectionMatrix.value,camera.projectionMatrixInverse);assert.equal(pass.blurMaterial.uniforms.cameraFar.value,250);
  pass.setSize(1920,1080);assert.equal(pass.normalRenderTarget.width,960);assert.equal(pass.normalRenderTarget.height,540);
 }finally{pass.dispose();pass.ssaoMaterial.dispose();pass.noiseTexture.dispose();originalTarget.dispose();}
});

test('pipes and curved timber have continuous, translation-invariant texture scale',()=>{
 const geometries=[new THREE.CylinderGeometry(.28,.28,3,12),new THREE.ConeGeometry(.22,1.1,7),new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,0),new THREE.Vector3(3,1,0)]),12,.055,6,false)];
 for(const original of geometries){const moved=original.clone().rotateZ(Math.PI/2).translate(80,5,160);surfaceUV(original,.38);surfaceUV(moved,.38);assert.deepEqual(Array.from(original.getAttribute('uv').array),Array.from(moved.getAttribute('uv').array));assert.ok(Array.from(moved.getAttribute('uv').array).every(Number.isFinite));original.dispose();moved.dispose();}
 const pipe=new THREE.CylinderGeometry(.28,.28,3,12).translate(80,0,160);surfaceUV(pipe,.38);const uv=pipe.getAttribute('uv');let maxU=0;for(let i=0;i<12;i++)maxU=Math.max(maxU,Math.abs(uv.getX(i+1)-uv.getX(i)));assert.ok(maxU<.06);assert.ok(Math.abs(uv.getY(0)-uv.getY(13)-3*.38)<1e-6);pipe.dispose();
});

test('cedar grain follows structural length and narrow frames sample one board rather than ten miniature planks',()=>{
 for(const [w,h,d,along] of [[.05,2.9,.13,1],[4,.14,.2,0],[.15,.2,4,2]]){
  const g=new THREE.BoxGeometry(w,h,d);surfaceUV(g,.38,'timber');const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');let sampled=0;
  for(let i=0;i<p.count;i++)if(Math.abs(n.getComponent(i,along))<.5){assert.ok(Math.abs(uv.getY(i)-p.getComponent(i,along)/2.5)<1e-6);assert.ok(uv.getX(i)>.40&&uv.getX(i)<.50);sampled++;}assert.ok(sampled>0);g.dispose();
 }
 const floor=new THREE.BoxGeometry(4,.28,4);surfaceUV(floor,1/1.5,'floor');const p=floor.getAttribute('position'),n=floor.getAttribute('normal'),uv=floor.getAttribute('uv');for(let i=0;i<p.count;i++)if(n.getY(i)>.9){assert.ok(Math.abs(uv.getX(i)-p.getZ(i)/1.5)<1e-6);assert.ok(Math.abs(uv.getY(i)-p.getX(i)/1.5)<1e-6);}floor.dispose();
});

test('visible room overlay uses photographic planks; shaded lamp emission stays stable across quality changes',()=>{
 const globals=globalThis as unknown as Record<string,unknown>;globals.innerWidth=1280;globals.innerHeight=720;globals.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};globals.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,17);
 try{
  world.scene.updateMatrixWorld(true);const meshes=world.scene.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&!o.matrixAutoUpdate);
  const rooms=world.layout.rooms.filter(r=>r.id.startsWith('expansion-')&&!r.themeId&&![3,4].includes((Number(r.id.slice(-2))-1)%9));assert.ok(rooms.length>10);
  for(const r of rooms){const ray=new THREE.Raycaster(new THREE.Vector3((r.x1+r.x2)*2+.6,.3,(r.z1+r.z2)*2+.4),new THREE.Vector3(0,-1,0),0,1);const hit=ray.intersectObjects(meshes,false)[0];assert.ok(hit,r.id);assert.equal((hit.object as THREE.Mesh<THREE.BufferGeometry,THREE.Material>).material.name,'planks',r.id);}
  const lamps=new Set<THREE.Material>();world.scene.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&['light','coolLight'].includes(o.material.name))lamps.add(o.material);});
  assert.equal(lamps.size,2);
  const original=[...lamps].map(m=>{assert.ok(m instanceof THREE.MeshStandardMaterial);assert.ok(m.emissiveIntensity>1&&m.emissiveIntensity<=1.35);return {material:m,emission:m.emissive.clone(),intensity:m.emissiveIntensity,key:m.customProgramCacheKey()};});
  for(const quality of ['high','low','ultra','low'] as const){
   world.configure({...DEFAULTS,quality});
   for(const {material,emission,intensity,key} of original){assert.deepEqual(material.emissive,emission);assert.equal(material.emissiveIntensity,intensity);assert.equal(material.customProgramCacheKey(),key);assert.match(key,/lamp-transmission/);}
  }
  assert.equal(renderer.shadowMap.enabled,false);
 }finally{world.dispose();}
});
