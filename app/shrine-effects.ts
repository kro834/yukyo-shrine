import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ContactOcclusion} from './contact-occlusion.ts';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {GraphicsQuality} from './preferences.ts';
// AO and the blurred light halo have low spatial frequency. Keep geometry and
// textures at the selected full resolution, sampling only these effects at half size.
class HalfBloom extends UnrealBloomPass {override setSize(w:number,h:number){super.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));}}
export function renderEnemyEcho(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
 const background=scene.background,mask=camera.layers.mask,autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate;
 scene.background=null;camera.layers.set(1);renderer.autoClear=false;renderer.clearDepth();renderer.shadowMap.autoUpdate=false;
 renderer.render(scene,camera);
 scene.background=background;camera.layers.mask=mask;renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;
}

/** Render the architecture in HDR; keep through-wall enemy echoes outside AO. */
export function createEffects(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,mobile=false,ultra=false){
  const composer=new EffectComposer(renderer);
  const drawingSize=new THREE.Vector2();
  const syncTargets=()=>{
    renderer.getDrawingBufferSize(drawingSize);
    const samples=mobile?0:Math.min(ultra&&drawingSize.x*drawingSize.y<=3200000?4:2,renderer.capabilities.maxSamples);
    for(const target of [composer.renderTarget1,composer.renderTarget2])if(target.samples!==samples){target.dispose();target.samples=samples;}
    composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
  };
  const base=new RenderPass(scene,camera),ao=new ContactOcclusion(scene,camera,innerWidth,innerHeight,ultra);
  const bloom=new HalfBloom(new THREE.Vector2(innerWidth,innerHeight),.16,.55,1.15);
  const output=new OutputPass();
  for(const pass of [base,ao,bloom,output])composer.addPass(pass);
  let enabled=true;
  return {
    configure(quality:GraphicsQuality){
      enabled=quality!=='low';ao.enabled=quality==='high'||quality==='ultra';
      bloom.strength=ao.enabled?.12:.1;
      syncTargets();
    },
    resize(){syncTargets();},
    render(reveal=false){
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      if(enabled)composer.render();else renderer.render(scene,camera);
      if(reveal)renderEnemyEcho(renderer,scene,camera);
    },
    dispose(){for(const pass of [base,ao,bloom,output])pass.dispose();bloom.materialHighPassFilter.dispose();ao.ssaoMaterial.dispose();ao.noiseTexture.dispose();composer.dispose();},
  };
}
