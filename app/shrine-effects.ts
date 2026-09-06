import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
// AO and the blurred light halo have low spatial frequency. Keep geometry and
// textures at the selected full resolution, sampling only these effects at half size.
class HalfAO extends SSAOPass {override setSize(w:number,h:number){super.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));}}
class HalfBloom extends UnrealBloomPass {override setSize(w:number,h:number){super.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));}}
export function renderEnemyEcho(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
 const background=scene.background,mask=camera.layers.mask,autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate;
 scene.background=null;camera.layers.set(1);renderer.autoClear=false;renderer.clearDepth();renderer.shadowMap.autoUpdate=false;
 renderer.render(scene,camera);
 scene.background=background;camera.layers.mask=mask;renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;
}

/** Render the architecture in HDR; keep through-wall enemy echoes outside AO. */
export function createEffects(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,mobile=false){
  const composer=new EffectComposer(renderer);
  composer.renderTarget1.samples=mobile?0:2;composer.renderTarget2.samples=mobile?0:2;
  const base=new RenderPass(scene,camera),ao=new HalfAO(scene,camera,innerWidth,innerHeight,16);
  ao.kernelRadius=.65;ao.minDistance=.001;ao.maxDistance=.025;
  const bloom=new HalfBloom(new THREE.Vector2(innerWidth,innerHeight),.16,.55,1.15);
  const output=new OutputPass();
  for(const pass of [base,ao,bloom,output])composer.addPass(pass);
  let enabled=true;
  return {
    configure(quality:'low'|'medium'|'high'){
      enabled=quality!=='low';ao.enabled=quality==='high';
      bloom.strength=quality==='high'?.18:.14;
      composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
    },
    resize(){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);},
    render(){
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      if(enabled)composer.render();else renderer.render(scene,camera);
      renderEnemyEcho(renderer,scene,camera);
    },
    dispose(){for(const pass of [base,ao,bloom,output])pass.dispose();ao.ssaoMaterial.dispose();ao.noiseTexture.dispose();composer.dispose();},
  };
}
