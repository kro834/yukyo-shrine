import type {MeshStandardMaterial} from 'three';
import {fabricFinish} from './fabric-finish.ts';

/** Photo linen supplies millimetre weave; stable object-space wear supplies
 * larger stains. Keeping them separate avoids baking lighting into the robe. */
export function enemyFabricFinish(material:MeshStandardMaterial,pale=false){
 fabricFinish(material,pale,true);
 material.color.set(pale?'#b2a58f':'#4b453b');
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-enemy-linen-v1';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 garmentSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngarmentSurface=transformed;');
  shader.fragmentShader=`varying vec3 garmentSurface;
float garmentHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float garmentNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(garmentHash(i),garmentHash(i+vec3(1,0,0)),f.x),mix(garmentHash(i+vec3(0,1,0)),garmentHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(garmentHash(i+vec3(0,0,1)),garmentHash(i+vec3(1,0,1)),f.x),mix(garmentHash(i+vec3(0,1,1)),garmentHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float garmentBroad=garmentNoise(garmentSurface*2.7+vec3(7.1,2.3,4.7));
   float garmentWeather=garmentNoise(garmentSurface*9.0+garmentBroad)*.30+garmentBroad*.70;
   float garmentStain=smoothstep(.40,.72,garmentWeather);
   diffuseColor.rgb*=mix(vec3(1.0),vec3(.58,.53,.43),garmentStain*${pale?'.72':'.44'});
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+garmentStain*.08,.72,1.0);
  `);
 };
}
