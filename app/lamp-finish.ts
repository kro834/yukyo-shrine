import type {MeshStandardMaterial,PointsMaterial} from 'three';

/** Shade-only photographic response. World exposure, fixture pools, shadows and
 * scene illumination are intentionally unaffected. UV.y is normalized shade height.
 */
export function lampFinish(material:MeshStandardMaterial,kind:'paper'|'diffuser'){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`lamp-transmission-v3-${kind}-${previousKey}`;
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
   float lampCloud=lampFiltered(lampPosition*6.0);
   float lampGrain=lampFiltered(lampPosition*vec3(${kind==='paper'?'175.0,24.0,175.0':'110.0'}));
   float lampV=clamp(lampUv.y,0.0,1.0);
   float lampEnds=smoothstep(0.0,.16,lampV)*smoothstep(0.0,.16,1.0-lampV);
   float lampCore=exp(-pow((lampV-.54)/.27,2.0));
   float lampDensity=${kind==='paper'?'.20+.52*(1.0-lampCloud)+.16*(1.0-lampGrain)':'.16+.22*(1.0-lampCloud)+.06*(1.0-lampGrain)'};
   float lampTransmission=exp(-lampDensity)*${kind==='paper'?'mix(.48,.80,lampEnds)*(1.0+.52*lampCore)':'mix(.66,1.0,lampEnds)'};
   totalEmissiveRadiance*=lampTransmission;
   ${kind==='paper'?'totalEmissiveRadiance*=mix(vec3(1.0,.63,.31),vec3(1.0,.91,.73),lampCore);':''}
   diffuseColor.rgb*=.81+.19*lampCloud;
  `);
  // Preserve shadow/incident-light direction while softening ONLY reflected light
  // on thin glowing paper. A nearby flashlight must not erase the transmission.
  shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`
   vec3 lampReflection=totalDiffuse+totalSpecular;
   float lampReflectedPeak=max(max(lampReflection.r,lampReflection.g),lampReflection.b);
   lampReflection/=1.0+lampReflectedPeak/${kind==='paper'?'.72':'1.05'};
   vec3 outgoingLight=lampReflection+totalEmissiveRadiance;
  `);
 };
}

/** A local lens halo should disappear while inspecting the shade, but retain its
 * existing material intensity and colour at normal/distant viewing ranges.
 */
export function lampHaloFinish(material:PointsMaterial){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`lamp-halo-distance-v1-${previousKey}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying float lampHaloDistance;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nlampHaloDistance=length(mvPosition.xyz);');
  shader.fragmentShader='varying float lampHaloDistance;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=smoothstep(1.4,4.5,lampHaloDistance);');
 };
}
