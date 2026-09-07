import type {MeshStandardMaterial} from 'three';

/** World-space capillary ripples: continuous across batched tiles, with no extra
 * geometry, textures or reflection pass. The shared clock freezes with L2. */
export function waterFinish(material:MeshStandardMaterial,clock:{value:number}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`water-ripples-v2-${key}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);shader.uniforms.waterTime=clock;
  shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=`varying vec3 waterWorld;uniform float waterTime;
   float waterHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
   vec2 waterGradient(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f),du=6.0*f*(1.0-f);
    float a=waterHash(i),b=waterHash(i+vec2(1,0)),c=waterHash(i+vec2(0,1)),d=waterHash(i+vec2(1));
    return vec2(mix(b-a,d-c,u.y)*du.x,mix(c-a,d-b,u.x)*du.y);
   }
   float waterVisibility(vec2 p){return 1.0-smoothstep(.2,.9,max(fwidth(p.x),fwidth(p.y)));}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 waterUp=inverseTransformDirection(normal,viewMatrix);
   float waterHorizontal=smoothstep(.65,.95,abs(waterUp.y));
   float waveA=dot(waterWorld.xz,vec2(7.7,3.1))-waterTime*.85+sin(dot(waterWorld.xz,vec2(.43,.29)))*2.0;
   float waveB=dot(waterWorld.xz,vec2(-4.3,11.2))+waterTime*.64+sin(dot(waterWorld.xz,vec2(-.33,.51)))*1.6;
   float waveC=dot(waterWorld.xz,vec2(19.0,-12.0))-waterTime*1.2+sin(dot(waterWorld.xz,vec2(.87,-.68)))*.7;
   // Filter sub-pixel waves rather than letting their specular highlights sparkle.
   float a=cos(waveA)*(.012/(1.0+fwidth(waveA)*fwidth(waveA)));
   float b=cos(waveB)*(.008/(1.0+fwidth(waveB)*fwidth(waveB)));
   float c=cos(waveC)*(.004/(1.0+fwidth(waveC)*fwidth(waveC)));
   vec2 slope=a*vec2(.928,.374)+b*vec2(-.358,.934)+c*vec2(.845,-.534);
   // Unequal wavelengths and two wind directions break the long parallel bands.
   vec2 broad=waterWorld.xz*vec2(3.7,8.3)+waterTime*vec2(.12,-.17);
   mat2 turn=mat2(.8,.6,-.6,.8);
   vec2 fine=turn*waterWorld.xz*13.7+waterTime*vec2(-.23,.11);
   float broadVisibility=waterVisibility(broad),fineVisibility=waterVisibility(fine);
   slope+=waterGradient(broad)*vec2(.021,.037)*broadVisibility;
   slope+=transpose(turn)*waterGradient(fine)*.014*fineVisibility;
   normal=normalize(normal+(viewMatrix*vec4(-slope.x,0.0,-slope.y,0.0)).xyz*waterHorizontal);
   // Unresolved ripples become surface roughness instead of sparkling pixels.
   roughnessFactor=min(1.0,roughnessFactor+.035*(1.0-fineVisibility)*waterHorizontal);
  `);
 };
}
