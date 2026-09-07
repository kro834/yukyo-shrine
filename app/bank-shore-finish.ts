import type {MeshStandardMaterial} from 'three';

/** bankWater carries the nearby basin's actual water height and its horizontal
 * reach. A zero reach keeps exterior support terrain dry, regardless of height.
 * Install after terrainFinish, before SurfaceLibrary records the base finish.
 */
export function bankShoreFinish(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile.bind(material),previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`bank-shore-v1-${previousKey}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.vertexShader='attribute vec2 bankWater;\nvarying vec2 bankShoreWater;\nvarying vec3 bankShorePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   bankShoreWater=bankWater;
   bankShorePosition=(modelMatrix*vec4(transformed,1.0)).xyz;
  `);
  shader.fragmentShader=`varying vec2 bankShoreWater;
   varying vec3 bankShorePosition;
   float bankShoreMoisture(float heightAboveWater,float reach,float grain){
    float capillaryHeight=.24+.035*grain;
    return clamp(reach,0.0,1.0)*(1.0-smoothstep(.015,capillaryHeight,heightAboveWater));
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float bankShoreGrain=.65*sin(bankShorePosition.x*1.7+sin(bankShorePosition.z*1.3))+.35*sin(bankShorePosition.z*3.1-bankShorePosition.x*.71);
   float bankShoreWet=bankShoreMoisture(bankShorePosition.y-bankShoreWater.x,bankShoreWater.y,bankShoreGrain);
   diffuseColor.rgb*=mix(vec3(1.0),vec3(.68,.73,.69),bankShoreWet);
  `);
  // terrainFinish expands roughnessmap_fragment itself; metalness remains a
  // stable insertion point after the mapped roughness and before PBR lighting.
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor*.72,.32,1.0),bankShoreWet);
  `);
 };
 material.needsUpdate=true;
}
