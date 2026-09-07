import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {waterFinish} from '../app/water-finish.ts';
import {finiteFixture} from '../app/finite-fixture.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';

test('water retains world-space ripples and shared simulation time across quality changes',()=>{
 const material=new THREE.MeshStandardMaterial(),clock={value:0};waterFinish(material,clock);
 const library=new SurfaceLibrary([material],4);library.setLightingFinish(finiteFixture);library.preserveBaseFinish(material);
 for(const quality of ['low','high','ultra','low'] as const){
  library.setQuality(quality);
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as THREE.WebGLRenderer);
  assert.equal(shader.uniforms.waterTime,clock,'tile materials must sample the same paused/live clock');
  assert.ok(shader.vertexShader.includes('modelMatrix*vec4(transformed,1.0)'),'world-space phase prevents batch seams');
  assert.equal(shader.fragmentShader.split('vec2 slope=').length,2);
  assert.ok(shader.fragmentShader.includes('fwidth(waveA)'),'distant waves need antialiasing');
  assert.ok(shader.fragmentShader.includes('waterHorizontal'),'vertical wet walls must keep their normal');
  assert.ok(shader.fragmentShader.includes('pointLight.distance'),'finite light finish must survive water shading');
 }
 library.dispose();material.dispose();
});
