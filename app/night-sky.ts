import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** The captured twilight panorama contains a solar peak above 90,000. Limit
 * only those extreme highlights before night exposure and bloom, preserving
 * RGB ratios and all ordinary sky detail. Bake once; reflection and background
 * share the same linear half-float panorama without a new per-frame pass. */
export function prepareNightSky(renderer:THREE.WebGLRenderer,source:THREE.DataTexture){
 const target=new THREE.WebGLRenderTarget(source.image.width,source.image.height,{
  type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
  depthBuffer:false,stencilBuffer:false,
 });
 target.texture.mapping=THREE.EquirectangularReflectionMapping;
 target.texture.colorSpace=THREE.LinearSRGBColorSpace;
 target.texture.name='night-sky-highlight-shoulder';
 const material=new THREE.ShaderMaterial({
  uniforms:{panorama:{value:source}},depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 skyUv;void main(){skyUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform sampler2D panorama;varying vec2 skyUv;
   void main(){
    vec3 radiance=texture2D(panorama,skyUv).rgb;
    float peak=max(max(radiance.r,radiance.g),radiance.b);
    float shoulder=8.0+32.0*(1.0-exp(-max(peak-8.0,0.0)/32.0));
    float scale=peak>8.0?shoulder/max(peak,.0001):1.0;
    gl_FragColor=vec4(radiance*scale,1.0);
   }`,
 });
 const quad=new FullScreenQuad(material),previous=renderer.getRenderTarget();
 const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
 const scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear;
 try{
  renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);
  quad.render(renderer);
 }catch(error){target.dispose();throw error;}
 finally{
  renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);
  renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;quad.dispose();material.dispose();
 }
 return target;
}
