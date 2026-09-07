import {ShaderChunk,type MeshStandardMaterial} from 'three';
/** Translate all PBR maps by the same triangular-lattice offsets, keeping their detail registered. */
export function terrainFinish(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile;
 material.customProgramCacheKey=()=> 'terrain-offset-blend-v1';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.fragmentShader=`
   vec2 terrainOffset(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy)*17.0;}
   vec4 terrainSample(sampler2D source,vec2 uv){
    vec2 q=uv/2.7,cell=floor(q),f=fract(q),a,b,c,dx=dFdx(uv),dy=dFdy(uv);vec3 w;
    if(f.x+f.y<1.0){a=cell;b=cell+vec2(1,0);c=cell+vec2(0,1);w=vec3(1.0-f.x-f.y,f.x,f.y);}
    else{a=cell+vec2(1);b=cell+vec2(0,1);c=cell+vec2(1,0);w=vec3(f.x+f.y-1.0,1.0-f.x,1.0-f.y);}
    w=w*w*w;w/=dot(w,vec3(1));
    return textureGrad(source,uv+terrainOffset(a),dx,dy)*w.x+textureGrad(source,uv+terrainOffset(b),dx,dy)*w.y+textureGrad(source,uv+terrainOffset(c),dx,dy)*w.z;
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    diffuseColor*=terrainSample(map,vMapUv);
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   float roughnessFactor=roughness;
   #ifdef USE_ROUGHNESSMAP
    roughnessFactor*=terrainSample(roughnessMap,vRoughnessMapUv).g;
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )','terrainSample(normalMap,vNormalMapUv)'));
 };
}
