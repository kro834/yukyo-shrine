import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {terrainFinish} from '../app/terrain-finish.ts';
import {bankShoreFinish} from '../app/bank-shore-finish.ts';
import {installBankPathFinish} from '../app/bank-path-finish.ts';
import {finiteFixture} from '../app/finite-fixture.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';

const compile=(material:THREE.MeshStandardMaterial)=>{
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{} as Record<string,THREE.IUniform>};
 material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as THREE.WebGLRenderer);return shader;
};
const materials=()=>{
 const bank=new THREE.MeshStandardMaterial(),earth=new THREE.MeshStandardMaterial();terrainFinish(bank);bankShoreFinish(bank);
 const key=bank.customProgramCacheKey(),finish=installBankPathFinish(bank,earth);assert.ok(bank.customProgramCacheKey().endsWith(key));
 return {bank,earth,finish};
};

void test('path PBR blending composes with terrain, shore dampness and finite lighting using explicit gradients',()=>{
 const {bank,earth}=materials();finiteFixture(bank);const shader=compile(bank),fragment=shader.fragmentShader;
 assert.match(shader.vertexShader,/bankPathGap=bankPathDistance;/);
 assert.match(shader.vertexShader,/bankPathPosition=\(modelMatrix\*vec4\(transformed,1\.0\)\)\.xz;/);
 assert.equal((fragment.match(/vec4 terrainSample\(/g)??[]).length,1);
 assert.equal((fragment.match(/vec4 bankPathTerrainSample\(/g)??[]).length,1);
 assert.equal((fragment.match(/textureGrad\(/g)??[]).length,3,'reuse the original triangular sampler for every path PBR map');
 assert.match(fragment,/bankPathTerrainSample\(source,uv,dFdx\(uv\),dFdy\(uv\)\)/);
 const firstBranch=fragment.indexOf('if(bankPathBlend>0.0)');
 assert.ok(fragment.indexOf('bankPathNormalDy=dFdy')<firstBranch);
 assert.ok(fragment.indexOf('bankPathViewDy=dFdy')<firstBranch);
 assert.equal((fragment.match(/if\(bankPathBlend>0\.0\)/g)??[]).length,3,'all three material samples are gated by the edge strip');
 assert.ok(fragment.indexOf('pathAlbedo=')<fragment.indexOf('float bankShoreWet='));
 assert.ok(fragment.indexOf('roughnessFactor=mix(roughnessFactor,pathRoughness')<fragment.indexOf('roughnessFactor=mix(roughnessFactor,clamp'));
 assert.ok(fragment.indexOf('normal=normalize(mix(normal,pathNormal')<fragment.indexOf('#include <lights_physical_fragment>'));
 assert.match(fragment,/pathMapN\.xy\*=bankPathNormalScale;/);
 assert.equal((fragment.match(/sqrt\( lightDistance \* lightDistance \+/g)??[]).length,1);
 bank.dispose();earth.dispose();
});

void test('transition matches the source exactly at the path and remains below 80 cm for every noise value',()=>{
 const {bank,earth}=materials(),source=compile(bank).fragmentShader;
 const body=source.match(/float bankPathWeight\(float gap,float grain\)\{([^}]+)\}/)![1];
 const smoothstep=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const weight=runInNewContext('(function(gap,grain){'+body+'})',{smoothstep,max:Math.max}) as (gap:number,grain:number)=>number;
 for(const grain of [-1,-.5,0,.5,1]){
  assert.equal(weight(0,grain),1);assert.equal(weight(-.01,grain),1);
  assert.ok(weight(.1,grain)>weight(.3,grain)&&weight(.3,grain)>weight(.5,grain));
  for(const gap of [.8,1,4])assert.equal(weight(gap,grain),0);
 }
 bank.dispose();earth.dispose();
});

void test('late and replaced maps update shared uniforms safely without recompiles or resource ownership',()=>{
 const {bank,earth,finish}=materials(),shader=compile(bank),u=shader.uniforms,key=bank.customProgramCacheKey(),version=bank.version;
 assert.equal(u.bankPathMapReady.value,0);assert.equal(u.bankPathMap.value,null);
 assert.equal(u.bankPathRoughnessReady.value,0);assert.equal(u.bankPathNormalReady.value,0);
 const texture=new THREE.Texture();earth.map=texture;finish();assert.equal(u.bankPathMapReady.value,0,'a not-yet-loaded texture cannot replace bank albedo');
 texture.image={width:1,height:1};texture.repeat.set(2,3);texture.offset.set(.1,.2);earth.roughnessMap=texture;earth.normalMap=texture;earth.color.set('#476341');earth.roughness=.81;earth.normalScale.set(.5,.7);finish();
 assert.equal(u.bankPathMapReady.value,1);assert.equal(u.bankPathMap.value,texture);assert.equal(u.bankPathRoughnessMap.value,texture);assert.equal(u.bankPathNormalMap.value,texture);
 assert.deepEqual(u.bankPathMapTransform.value,texture.matrix);assert.deepEqual(u.bankPathTint.value,earth.color);assert.deepEqual(u.bankPathNormalScale.value,earth.normalScale);assert.equal(u.bankPathRoughness.value,.81);
 const next=new THREE.Texture({width:2,height:2});earth.map=next;earth.roughnessMap=null;earth.normalMap=null;finish();
 assert.equal(u.bankPathMap.value,next);assert.equal(u.bankPathRoughnessReady.value,0);assert.equal(u.bankPathNormalReady.value,0);
 const nextShader=compile(bank);assert.equal(nextShader.uniforms.bankPathMap,u.bankPathMap,'all compiled variants share current texture references');
 assert.equal(bank.version,version);assert.equal(bank.customProgramCacheKey(),key);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);next.addEventListener('dispose',()=>disposed++);bank.dispose();earth.dispose();assert.equal(disposed,0,'finish does not own source assets');texture.dispose();next.dispose();
});

void test('SurfaceLibrary removes all path sampling on low and medium and restores it on high and ultra',()=>{
 const {bank,earth,finish}=materials(),library=new SurfaceLibrary([bank],4);library.setLightingFinish(finiteFixture);
 for(const quality of ['high','low','medium','ultra','medium','high'] as const){
  library.setQuality(quality);finish();const source=compile(bank).fragmentShader;
  assert.equal(source.includes('bankPathTerrainSample'),quality==='high'||quality==='ultra');
  assert.equal((source.match(/sqrt\( lightDistance \* lightDistance \+/g)??[]).length,1);
 }
 library.dispose();bank.dispose();earth.dispose();
});
