import type {MeshStandardMaterial} from 'three';
/** Low-cost wear in world units, stable across merged architecture and door leaves. */
export function agedFinish(material:MeshStandardMaterial,kind:'paper'|'plaster'|'tatami'){
 material.customProgramCacheKey=()=> 'aged-interior-v1-'+kind;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 agedPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nagedPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 agedPosition;\nfloat agedNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=dot(i,vec2(127.1,311.7));return mix(mix(fract(sin(a)*43758.54),fract(sin(a+127.1)*43758.54),f.x),mix(fract(sin(a+311.7)*43758.54),fract(sin(a+438.8)*43758.54),f.x),f.y); }\n'+shader.fragmentShader;
  const finish=kind==='tatami'
   ? 'float weave=.5+.5*sin(agedPosition.x*150.0)*sin(agedPosition.z*28.0);float detail=1.0-smoothstep(.25,1.0,fwidth(agedPosition.x*150.0));diffuseColor.rgb*=.87+.10*weave*detail;'
   : 'vec2 surface=vec2(agedPosition.x+agedPosition.z,agedPosition.y);float stain=agedNoise(surface*.65);float damp=(1.0-smoothstep(.2,1.4,mod(max(agedPosition.y,0.0),4.8)))*(.5+.5*stain);diffuseColor.rgb*=.76+.24*stain-.22*damp;';
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+finish);
 };
}
