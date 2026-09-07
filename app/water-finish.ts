import type {MeshStandardMaterial} from 'three';

/** World-space capillary ripples: continuous across batched tiles, with no extra
 * geometry, textures or reflection pass. The shared clock freezes with L2. */
export function waterFinish(material:MeshStandardMaterial,clock:{value:number}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`water-ripples-v1-${key}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);shader.uniforms.waterTime=clock;
  shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 waterWorld;uniform float waterTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 waterUp=inverseTransformDirection(normal,viewMatrix);
   float waterHorizontal=smoothstep(.65,.95,abs(waterUp.y));
   float waveA=dot(waterWorld.xz,vec2(7.7,3.1))-waterTime*.85+sin(dot(waterWorld.xz,vec2(.43,.29)))*2.0;
   float waveB=dot(waterWorld.xz,vec2(-4.3,11.2))+waterTime*.64+sin(dot(waterWorld.xz,vec2(-.33,.51)))*1.6;
   float waveC=dot(waterWorld.xz,vec2(19.0,-12.0))-waterTime*1.2+sin(dot(waterWorld.xz,vec2(.87,-.68)))*.7;
   // Filter sub-pixel waves rather than letting their specular highlights sparkle.
   float a=cos(waveA)*(.035/(1.0+fwidth(waveA)*fwidth(waveA)));
   float b=cos(waveB)*(.022/(1.0+fwidth(waveB)*fwidth(waveB)));
   float c=cos(waveC)*(.009/(1.0+fwidth(waveC)*fwidth(waveC)));
   vec2 slope=a*vec2(.928,.374)+b*vec2(-.358,.934)+c*vec2(.845,-.534);
   normal=normalize(normal+(viewMatrix*vec4(-slope.x,0.0,-slope.y,0.0)).xyz*waterHorizontal);
  `);
 };
}
