import type {MeshStandardMaterial} from 'three';
/** Local, derivative-filtered surface detail; never slides as an actor moves. */
export function organicFinish(material:MeshStandardMaterial,kind:'skin'|'mask'){
 const previous=material.onBeforeCompile.bind(material),previousKey=material.customProgramCacheKey(),skin=kind==='skin';material.roughness=skin?.73:.78;
 material.customProgramCacheKey=()=>`organic-surface-v2-${kind}-${previousKey}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);
  shader.vertexShader='varying vec3 organicPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\norganicPosition=transformed;');
  shader.fragmentShader=`varying vec3 organicPosition;
   float organicHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   float organicNoise(vec3 p){vec3 i=floor(p),u=fract(p);u=u*u*(3.0-2.0*u);return mix(mix(mix(organicHash(i),organicHash(i+vec3(1,0,0)),u.x),mix(organicHash(i+vec3(0,1,0)),organicHash(i+vec3(1,1,0)),u.x),u.y),mix(mix(organicHash(i+vec3(0,0,1)),organicHash(i+vec3(1,0,1)),u.x),mix(organicHash(i+vec3(0,1,1)),organicHash(i+vec3(1)),u.x),u.y),u.z);}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 organicMacroCoord=organicPosition*${skin?'35.0':'70.0'};
   float organicMacroWeight=1.0-smoothstep(.15,.5,max(max(fwidth(organicMacroCoord.x),fwidth(organicMacroCoord.y)),fwidth(organicMacroCoord.z)));
   float organicMacro=(organicNoise(organicMacroCoord)-.5)*organicMacroWeight;
   vec3 poreCoord=organicPosition*${skin?'700.0':'220.0'};
   float poreWeight=1.0-smoothstep(.15,.5,max(max(fwidth(poreCoord.x),fwidth(poreCoord.y)),fwidth(poreCoord.z)));
   float pore=(organicNoise(poreCoord)-.5)*poreWeight;
   diffuseColor.rgb*=vec3(1.0)+organicMacro*${skin?'vec3(.09,.13,.16)':'vec3(.05,.06,.08)'};
   float organicRelief=pore*${skin?'.00035+organicMacro*.00065':'.00025'};
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+organicMacro*.10+pore*.05,.35,1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 organicDx=dFdx(-vViewPosition),organicDy=dFdy(-vViewPosition),organicR1=cross(organicDy,normal),organicR2=cross(normal,organicDx);
   float organicDet=dot(organicDx,organicR1);
   if(abs(organicDet)>1e-12)normal=normalize(abs(organicDet)*normal-sign(organicDet)*(dFdx(organicRelief)*organicR1+dFdy(organicRelief)*organicR2));
  `);
 };
}
