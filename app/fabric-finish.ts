import type {MeshStandardMaterial} from 'three';
/** Decouple measured linen reflectance from illumination baked into the weave photo. */
export function fabricFinish(material:MeshStandardMaterial,pale=false){
 material.color.set(pale?'#bdb6a5':'#4e4a43');material.roughness=pale?.98:.94;
 const previous=material.onBeforeCompile;
 material.customProgramCacheKey=()=>`linen-reflectance-v1-${pale?'pale':'dark'}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec4 weaveSample=texture2D(map,vMapUv);
    float weaveY=dot(weaveSample.rgb,vec3(.2126,.7152,.0722));
    float weaveVariation=clamp(log2(max(weaveY,.0001)/.03355943),-1.5,1.5);
    diffuseColor.rgb*=1.0+weaveVariation*${pale?'.075':'.12'};
    diffuseColor.a*=weaveSample.a;
   #endif
  `);
 };
}
