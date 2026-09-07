import type {MeshStandardMaterial} from 'three';
export type SurfaceFinish='paper'|'plaster'|'tatami'|'lacquer'|'stone'|'tile'|'wood';
/** Metre-scale detail. Local fibres follow moving doors; only actual ground-level walls get damp hems. */
export function agedFinish(material:MeshStandardMaterial,kind:SurfaceFinish){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=> 'aged-interior-v3-'+kind+'-'+previousKey;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 agedPosition;\nvarying vec3 agedSurfaceNormal;\nvarying float agedWorldY;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nagedPosition=transformed;agedSurfaceNormal=objectNormal;agedWorldY=(modelMatrix*vec4(transformed,1.0)).y;');
  shader.fragmentShader=`varying vec3 agedPosition;
varying vec3 agedSurfaceNormal;
varying float agedWorldY;
float agedNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=dot(i,vec2(127.1,311.7));return mix(mix(fract(sin(a)*43758.54),fract(sin(a+127.1)*43758.54),f.x),mix(fract(sin(a+311.7)*43758.54),fract(sin(a+438.8)*43758.54),f.x),f.y);}
vec2 agedNoiseGradient(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f),du=6.0*f*(1.0-f);float a=dot(i,vec2(127.1,311.7)),v0=fract(sin(a)*43758.54),v1=fract(sin(a+127.1)*43758.54),v2=fract(sin(a+311.7)*43758.54),v3=fract(sin(a+438.8)*43758.54);return vec2(mix(v1-v0,v3-v2,u.y)*du.x,mix(v2-v0,v3-v1,u.x)*du.y);}
float agedVisibility(vec2 p){return 1.0-smoothstep(.15,.5,max(fwidth(p.x),fwidth(p.y)));}
float agedFilteredNoise(vec2 p){return mix(.5,agedNoise(p),agedVisibility(p));}
float agedWave(float cycles){return sin(6.2831853*cycles)*(1.0-smoothstep(.15,.5,fwidth(cycles)));}
`+shader.fragmentShader;
  const finishes:Record<SurfaceFinish,string>={
   tatami:`float reed=agedWave(agedSurface.x*330.0),binding=agedWave(agedSurface.y*38.0);
     diffuseColor.rgb*=.99+.024*reed+.006*binding+.035*(agedMacro-.5);
     agedRoughnessDelta=.018*reed+.025*(agedMacro-.5);agedGradient=vec2(.00016*330.0*6.2831853*cos(agedSurface.x*330.0*6.2831853)*(1.0-smoothstep(.15,.5,fwidth(agedSurface.x*330.0))),.00004*38.0*6.2831853*cos(agedSurface.y*38.0*6.2831853)*(1.0-smoothstep(.15,.5,fwidth(agedSurface.y*38.0))));`,
   paper:`float fibre=agedFilteredNoise(agedSurface*vec2(280.0,22.0))-.5,crossFibre=agedFilteredNoise(agedSurface*vec2(31.0,210.0))-.5;
     diffuseColor.rgb*=.98+.05*(agedMacro-.5)+.045*fibre+.018*crossFibre;
     agedRoughnessDelta=.035*fibre+.025*(agedMacro-.5);agedGradient=.0003*vec2(280.0,22.0)*agedNoiseGradient(agedSurface*vec2(280.0,22.0))*agedVisibility(agedSurface*vec2(280.0,22.0))+.00015*vec2(31.0,210.0)*agedNoiseGradient(agedSurface*vec2(31.0,210.0))*agedVisibility(agedSurface*vec2(31.0,210.0));`,
   plaster:`diffuseColor.rgb*=.98+.045*(agedMacro-.5);agedRoughnessDelta=.025*(agedMacro-.5);`,
   lacquer:`float wear=smoothstep(.54,.79,.6*agedNoise(agedSurface*2.8)+.4*agedMacro);
     float scratches=smoothstep(.65,.83,agedFilteredNoise(agedSurface*vec2(420.0,8.0)));
     diffuseColor.rgb*=1.0-.10*wear-.025*scratches;agedRoughnessDelta=.24*wear+.045*scratches;`,
   stone:`float wet=smoothstep(.48,.8,agedNoise(agedSurface*.43))*(1.0-smoothstep(.14,1.4,max(agedWorldY,0.0)));
     diffuseColor.rgb*=1.0-.2*wet;agedRoughnessDelta=-.38*wet;`,
   wood:`float wear=agedNoise(agedSurface*.37);diffuseColor.rgb*=.97+.065*(wear-.5);agedRoughnessDelta=.07*(wear-.5);`,
   tile:`vec2 tileUV=agedSurface*4.0,edge=min(fract(tileUV),1.0-fract(tileUV));
     float seam=1.0-smoothstep(.015,.027,min(edge.x,edge.y));seam*=agedVisibility(tileUV);
     float tileShade=mix(.5,agedNoise(floor(tileUV)*7.13),agedVisibility(tileUV));diffuseColor.rgb*=mix(.94+.09*tileShade,.28,seam);
     agedRoughnessDelta=.55*seam+.06*(tileShade-.5);`,
  };
  const common=`vec3 agedN=abs(normalize(agedSurfaceNormal));
    vec2 agedSurface=agedN.y>max(agedN.x,agedN.z)?agedPosition.xz:agedN.x>agedN.z?agedPosition.zy:agedPosition.xy;
    float agedMacro=agedNoise(agedSurface*.8),agedRoughnessDelta=0.0;vec2 agedGradient=vec2(0.0);
    ${finishes[kind]}
    float vertical=1.0-smoothstep(.2,.65,agedN.y);
    float damp=vertical*(1.0-smoothstep(.12,1.05,max(agedWorldY,0.0)))*smoothstep(.25,.8,agedNoise(agedSurface*.7));
    diffuseColor.rgb*=1.0-.13*damp;agedRoughnessDelta-=.04*damp;`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+common);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+agedRoughnessDelta,.08,1.0);');
  if(['tatami','paper'].includes(kind))shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 agedDx=dFdx(-vViewPosition),agedDy=dFdy(-vViewPosition),agedR1=cross(agedDy,normal),agedR2=cross(normal,agedDx);
    float agedDet=dot(agedDx,agedR1),agedReliefDx=dot(agedGradient,dFdx(agedSurface)),agedReliefDy=dot(agedGradient,dFdy(agedSurface));
    if(abs(agedDet)>1e-12)normal=normalize(abs(agedDet)*normal-sign(agedDet)*(agedReliefDx*agedR1+agedReliefDy*agedR2));`);
 };
}
