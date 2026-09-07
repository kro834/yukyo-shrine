import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import {bankShoreFinish} from '../app/bank-shore-finish.ts';
import {terrainFinish} from '../app/terrain-finish.ts';
import {finiteFixture} from '../app/finite-fixture.ts';

function compile(){
 const material=new THREE.MeshStandardMaterial();terrainFinish(material);
 const previousKey=material.customProgramCacheKey();bankShoreFinish(material);
 assert.ok(material.customProgramCacheKey().endsWith(previousKey));finiteFixture(material);
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
 material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as THREE.WebGLRenderer);
 material.dispose();return shader;
}

void test('bank dampness composes after terrain maps and before physical lighting without extra samples',()=>{
 const shader=compile(),fragment=shader.fragmentShader;
 assert.match(shader.vertexShader,/attribute vec2 bankWater;/);
 assert.match(shader.vertexShader,/bankShoreWater=bankWater;/);
 assert.match(shader.vertexShader,/bankShorePosition=\(modelMatrix\*vec4\(transformed,1\.0\)\)\.xyz;/);
 assert.match(fragment,/bankShorePosition\.y-bankShoreWater\.x,bankShoreWater\.y/);
 const mapped=fragment.indexOf('roughnessFactor*=terrainSample'),wet=fragment.indexOf('roughnessFactor=mix');
 assert.ok(mapped>0&&wet>mapped,'wet response must survive terrainFinish expanding roughnessmap_fragment');
 assert.ok(wet>fragment.indexOf('#include <metalnessmap_fragment>'));
 assert.ok(wet<fragment.indexOf('#include <lights_physical_fragment>'));
 assert.match(fragment,/clamp\(roughnessFactor\*\.72,\.32,1\.0\)/);
 assert.match(fragment,/vec3\(\.68,\.73,\.69\)/);
 assert.equal((fragment.match(/textureGrad\(/g)??[]).length,3,'shore response adds no texture lookups');
 assert.equal((fragment.match(/sqrt\( lightDistance \* lightDistance \+/g)??[]).length,1);
 assert.match(fragment,/getDistanceAttenuation\( lightDistance, spotLight\.distance, spotLight\.decay \)/);
});

void test('actual shader moisture leaves dry halo unchanged and follows each basin water level',()=>{
 const fragment=compile().fragmentShader;
 // Evaluate the emitted scalar GLSL helper directly, supplying standard GLSL
 // scalar operations; this checks the installed shader rather than a copy.
 const body=fragment.match(/float bankShoreMoisture\(float heightAboveWater,float reach,float grain\)\{([^}]+)\}/)![1].replace(/\bfloat\s+/g,'let ');
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const smoothstep=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
 const moisture=runInNewContext('(function(heightAboveWater,reach,grain){'+body+'})',{clamp,smoothstep}) as (height:number,reach:number,grain:number)=>number;
 const wet=(worldY:number,level:number,reach:number,grain=0)=>moisture(worldY-level,reach,grain);
 for(const level of [-1.68,-1.28,-2.08,-.68]){
  for(const offset of [-4,-.1,0,.1,.3,4])for(const grain of [-1,0,1])assert.equal(wet(level+offset,level,0,grain),0,'no nearby water means no dampness at any height');
  assert.equal(wet(level,level,1),1);
  assert.ok(wet(level+.1,level,1)>wet(level+.2,level,1));
  for(const grain of [-1,0,1])assert.equal(wet(level+.3,level,1,grain),0,'capillary rise remains below 30 cm');
  assert.ok(Math.abs(wet(level+.1,level,.5)-wet(level+.1,level,1)*.5)<1e-12);
 }
 assert.equal(wet(-.9,-1.68,1),0,'a levee water reference cannot damp the same height as a paddy');
 assert.equal(wet(-.9,-.68,1),1);
});
