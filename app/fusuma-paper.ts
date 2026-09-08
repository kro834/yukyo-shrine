import type {MeshStandardMaterial} from 'three';
/** Filtered cellulose fibres add grazing relief without glitter or transparent holes. */
export function fusumaPaperFinish(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-fusuma-cellulose-v1';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 fusumaPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfusumaPosition=transformed;');
  shader.fragmentShader='varying vec3 fusumaPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 fibreCoord=fusumaPosition.xy*vec2(1700.,1300.);
   float fibreFilter=1.-smoothstep(.5,2.,max(fwidth(fibreCoord.x),fwidth(fibreCoord.y)));
   float paperRelief=(sin(fibreCoord.x+sin(fibreCoord.y*.071))*sin(fibreCoord.y*.22))*.00012*fibreFilter;
   vec3 paperDx=dFdx(-vViewPosition),paperDy=dFdy(-vViewPosition),paperR1=cross(paperDy,normal),paperR2=cross(normal,paperDx);
   float paperDet=dot(paperDx,paperR1);
   if(abs(paperDet)>1e-12)normal=normalize(abs(paperDet)*normal-sign(paperDet)*(dFdx(paperRelief)*paperR1+dFdy(paperRelief)*paperR2));
  `);
 };
}
