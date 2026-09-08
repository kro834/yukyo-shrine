import type * as THREE from 'three';
const prepared=new WeakMap<THREE.Material,THREE.Material['onBeforeCompile']>();
/** Valley fog obscures low terrain while the high ridges remain silhouettes. */
export function mountainAtmosphere(material:THREE.MeshStandardMaterial){
 if(prepared.get(material)===material.onBeforeCompile)return;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>`mountain-valley-fog-v1-${key.call(material)}`;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  // Surface quality and late texture arrival may wrap the lighting finish again.
  // Only the innermost instance edits a compiled shader.
  if(shader.vertexShader.includes('varying float mountainWorldY;'))return;
  shader.vertexShader='varying float mountainWorldY;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\n mountainWorldY=(modelMatrix*vec4(transformed,1.)).y;');
  shader.fragmentShader='varying float mountainWorldY;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
   #ifdef USE_FOG
    float valleyDensity=fogDensity*exp(-max(0.,mountainWorldY-cameraPosition.y-3.)*.044);
    float valleyFog=1.-exp(-valleyDensity*valleyDensity*vFogDepth*vFogDepth);
    valleyFog=max(valleyFog,smoothstep(35.,220.,vFogDepth)*.25);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,valleyFog);
   #endif`);
 };
 prepared.set(material,material.onBeforeCompile);material.needsUpdate=true;
}
