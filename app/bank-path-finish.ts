import {Color,Matrix3,TangentSpaceNormalMap,Vector2,type MeshStandardMaterial,type Texture} from 'three';

/** Blend bank vertices near actual earth paths into the existing path material.
 * Install after terrainFinish and bankShoreFinish, before SurfaceLibrary records
 * the High/Ultra base hook. Call sync before rendering; it owns no GPU resources.
 */
export function installBankPathFinish(bank:MeshStandardMaterial,earth:MeshStandardMaterial){
 const uniforms={
  bankPathMap:{value:null as Texture|null},bankPathMapReady:{value:0},bankPathMapTransform:{value:new Matrix3()},
  bankPathRoughnessMap:{value:null as Texture|null},bankPathRoughnessReady:{value:0},bankPathRoughnessTransform:{value:new Matrix3()},
  bankPathNormalMap:{value:null as Texture|null},bankPathNormalReady:{value:0},bankPathNormalTransform:{value:new Matrix3()},
  bankPathTint:{value:new Color()},bankPathRoughness:{value:1},bankPathNormalScale:{value:new Vector2(1,1)},
 };
 const copyTexture=(texture:Texture|null,target:{value:Texture|null},ready:{value:number},transform:{value:Matrix3})=>{
  target.value=texture;ready.value=texture?.source.data?1:0;
  if(texture){if(texture.matrixAutoUpdate)texture.updateMatrix();transform.value.copy(texture.matrix);}
 };
 const sync=()=>{
  copyTexture(earth.map,uniforms.bankPathMap,uniforms.bankPathMapReady,uniforms.bankPathMapTransform);
  copyTexture(earth.roughnessMap,uniforms.bankPathRoughnessMap,uniforms.bankPathRoughnessReady,uniforms.bankPathRoughnessTransform);
  copyTexture(earth.normalMapType===TangentSpaceNormalMap?earth.normalMap:null,uniforms.bankPathNormalMap,uniforms.bankPathNormalReady,uniforms.bankPathNormalTransform);
  uniforms.bankPathTint.value.copy(earth.color);uniforms.bankPathRoughness.value=earth.roughness;uniforms.bankPathNormalScale.value.copy(earth.normalScale);
 };
 const previous=bank.onBeforeCompile.bind(bank),previousKey=bank.customProgramCacheKey();
 bank.customProgramCacheKey=()=>`bank-path-v1-${previousKey}`;
 bank.onBeforeCompile=(shader,renderer)=>{
  previous(shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute float bankPathDistance;\nvarying float bankPathGap;\nvarying vec2 bankPathPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   bankPathGap=bankPathDistance;
   bankPathPosition=(modelMatrix*vec4(transformed,1.0)).xz;
  `);
  // Reuse the installed terrain sampler's exact lattice and hash. An explicit
  // gradient entry point permits sampling only inside the transition strip;
  // derivatives calculated inside that varying branch would select wrong mips.
  shader.fragmentShader=shader.fragmentShader
   .replace('vec4 terrainSample(sampler2D source,vec2 uv){','vec4 bankPathTerrainSample(sampler2D source,vec2 uv,vec2 dx,vec2 dy){')
   .replace('a,b,c,dx=dFdx(uv),dy=dFdy(uv);vec3 w;','a,b,c;vec3 w;')
   .replace('void main() {',`vec4 terrainSample(sampler2D source,vec2 uv){return bankPathTerrainSample(source,uv,dFdx(uv),dFdy(uv));}
void main() {`);
  shader.fragmentShader=`
   uniform sampler2D bankPathMap,bankPathRoughnessMap,bankPathNormalMap;
   uniform float bankPathMapReady,bankPathRoughnessReady,bankPathNormalReady,bankPathRoughness;
   uniform mat3 bankPathMapTransform,bankPathRoughnessTransform,bankPathNormalTransform;
   uniform vec3 bankPathTint;
   uniform vec2 bankPathNormalScale;
   varying float bankPathGap;
   varying vec2 bankPathPosition;
   float bankPathWeight(float gap,float grain){return 1.0-smoothstep(0.0,.70+.08*grain,max(gap,0.0));}
   mat3 bankPathFrame(vec3 q0,vec3 q1,vec3 n,vec2 st0,vec2 st1){
    vec3 q1perp=cross(q1,n),q0perp=cross(n,q0);
    vec3 t=q1perp*st0.x+q0perp*st1.x,b=q1perp*st0.y+q0perp*st1.y;
    float det=max(dot(t,t),dot(b,b)),scale=det==0.0?0.0:inversesqrt(det);
    return mat3(t*scale,b*scale,n);
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float bankPathGrain=.65*sin(bankPathPosition.x*1.3+sin(bankPathPosition.y*.9))+.35*sin(bankPathPosition.y*2.1-bankPathPosition.x*.7);
   float bankPathBlend=bankPathWeight(bankPathGap,bankPathGrain)*bankPathMapReady;
   vec2 bankPathUv=(bankPathMapTransform*vec3(bankPathPosition,1.0)).xy;
   vec2 bankPathRoughUv=(bankPathRoughnessTransform*vec3(bankPathPosition,1.0)).xy;
   vec2 bankPathNormalUv=(bankPathNormalTransform*vec3(bankPathPosition,1.0)).xy;
   vec2 bankPathDx=dFdx(bankPathUv),bankPathDy=dFdy(bankPathUv);
   vec2 bankPathRoughDx=dFdx(bankPathRoughUv),bankPathRoughDy=dFdy(bankPathRoughUv);
   vec2 bankPathNormalDx=dFdx(bankPathNormalUv),bankPathNormalDy=dFdy(bankPathNormalUv);
   vec3 bankPathViewDx=dFdx(-vViewPosition),bankPathViewDy=dFdy(-vViewPosition);
   if(bankPathBlend>0.0){
    vec3 pathAlbedo=bankPathTerrainSample(bankPathMap,bankPathUv,bankPathDx,bankPathDy).rgb*bankPathTint;
    diffuseColor.rgb=mix(diffuseColor.rgb,pathAlbedo,bankPathBlend);
   }
  `);
  // Run before the later shoreline darkening/roughness response, which was
  // already appended to these shared insertion points by bankShoreFinish.
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   if(bankPathBlend>0.0){
    float pathRoughness=bankPathRoughness;
    if(bankPathRoughnessReady>0.0)pathRoughness*=bankPathTerrainSample(bankPathRoughnessMap,bankPathRoughUv,bankPathRoughDx,bankPathRoughDy).g;
    roughnessFactor=mix(roughnessFactor,pathRoughness,bankPathBlend);
   }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_begin>',`
   if(bankPathBlend>0.0){
    vec3 pathNormal=nonPerturbedNormal;
    if(bankPathNormalReady>0.0){
     vec3 pathMapN=bankPathTerrainSample(bankPathNormalMap,bankPathNormalUv,bankPathNormalDx,bankPathNormalDy).xyz*2.0-1.0;
     pathMapN.xy*=bankPathNormalScale;
     pathNormal=normalize(bankPathFrame(bankPathViewDx,bankPathViewDy,nonPerturbedNormal,bankPathNormalDx,bankPathNormalDy)*pathMapN);
    }
    normal=normalize(mix(normal,pathNormal,bankPathBlend));
   }
   #include <clearcoat_normal_fragment_begin>
  `);
 };
 sync();bank.needsUpdate=true;return sync;
}
