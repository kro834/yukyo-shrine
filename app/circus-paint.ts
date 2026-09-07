import type {MeshStandardMaterial} from 'three';

/** Painted machinery has broad satin highlights and small oxidized pits, unlike
 * the matte canvas. Object coordinates keep the wear attached while it moves. */
export function circusPaint(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-circus-enamel-v1';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 machineryPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmachineryPosition=position;');
  shader.fragmentShader=`varying vec3 machineryPosition;
   float machineryHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float machineryNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(machineryHash(i),machineryHash(i+vec3(1,0,0)),f.x),mix(machineryHash(i+vec3(0,1,0)),machineryHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(machineryHash(i+vec3(0,0,1)),machineryHash(i+vec3(1,0,1)),f.x),mix(machineryHash(i+vec3(0,1,1)),machineryHash(i+vec3(1,1,1)),f.x),f.y),f.z);
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float machineryWear=machineryNoise(machineryPosition*19.0);
   float machineryDetail=1.0-smoothstep(.004,.022,length(fwidth(machineryPosition)));
   float machineryPits=smoothstep(.67,.83,machineryNoise(machineryPosition*145.0))*smoothstep(.45,.75,machineryWear)*machineryDetail;
   diffuseColor.rgb*=.95+.08*machineryWear;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.046,.022,.011),machineryPits*.45);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(machineryWear-.5)*.15+machineryPits*.34,.3,.95);');
 };
}
