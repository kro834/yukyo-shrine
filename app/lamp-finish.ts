import type {MeshStandardMaterial} from 'three';

/** Thin shade transmission: filtered fibres remain visible in the emission itself. */
export function lampFinish(material:MeshStandardMaterial,kind:'paper'|'diffuser'){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`lamp-transmission-v2-${kind}-${previousKey}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 lampPosition;\nvarying vec2 lampUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlampPosition=position;lampUv=uv;');
  shader.fragmentShader=`varying vec3 lampPosition;varying vec2 lampUv;
   float lampHash(vec3 p){vec3 q=fract(p*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
   float lampNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(lampHash(i),lampHash(i+vec3(1,0,0)),f.x),mix(lampHash(i+vec3(0,1,0)),lampHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(lampHash(i+vec3(0,0,1)),lampHash(i+vec3(1,0,1)),f.x),mix(lampHash(i+vec3(0,1,1)),lampHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   float lampFiltered(vec3 p){vec3 footprint=fwidth(p);float visibility=1.0-smoothstep(.15,.55,max(max(footprint.x,footprint.y),footprint.z));return mix(.5,lampNoise(p),visibility);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float lampCloud=lampFiltered(lampPosition*5.0),lampGrain=lampFiltered(lampPosition*vec3(${kind==='paper'?'175.0,24.0,175.0':'110.0'}));
   float lampEnd=smoothstep(0.0,.14,lampUv.y)*smoothstep(0.0,.14,1.0-lampUv.y);
   float lampTransmission=${kind==='paper'?'.66+.24*lampCloud+.10*lampGrain':'.78+.12*lampCloud+.04*lampGrain'};
   totalEmissiveRadiance*=lampTransmission${kind==='diffuser'?'*mix(.77,1.0,lampEnd)':''};
   diffuseColor.rgb*=.92+.08*lampCloud;
  `);
 };
}
