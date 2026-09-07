import * as THREE from 'three';

export const FIXTURE_RADIUS=.24;
const prepared=new WeakMap<THREE.Material,THREE.Material['onBeforeCompile']>();

/** A finite-source approximation for the existing point-light pool. Preserve
 * inverse-square falloff at distance, without the near-field point singularity.
 * Spot lights (player flashlight and the pooled shadow cone) are untouched. */
export function finiteFixture(material:THREE.MeshStandardMaterial){
 if(prepared.get(material)===material.onBeforeCompile)return;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.customProgramCacheKey=()=>`finite-fixture-v1-${key.call(material)}`;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  const pointFalloff='getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay )';
  const finiteFalloff=`getDistanceAttenuation( sqrt( lightDistance * lightDistance + ${FIXTURE_RADIUS*FIXTURE_RADIUS} ), pointLight.distance, pointLight.decay )`;
  const lights=THREE.ShaderChunk.lights_pars_begin.replace(pointFalloff,finiteFalloff);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_pars_begin>',lights);
 };
 prepared.set(material,material.onBeforeCompile);
 material.needsUpdate=true;
}

export function finiteSceneFixtures(scene:THREE.Object3D){
 scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(material instanceof THREE.MeshStandardMaterial)finiteFixture(material);
  }
 });
}
