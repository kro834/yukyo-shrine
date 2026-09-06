import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

/** Render the architecture in HDR; keep through-wall enemy echoes outside AO. */
export function createEffects(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  const composer=new EffectComposer(renderer);
  composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;
  const base=new RenderPass(scene,camera),ao=new SSAOPass(scene,camera,innerWidth,innerHeight,16);
  ao.kernelRadius=.65;ao.minDistance=.001;ao.maxDistance=.025;
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.55,1.05);
  const output=new OutputPass();
  for(const pass of [base,ao,bloom,output])composer.addPass(pass);
  let enabled=true;
  return {
    configure(quality:'low'|'medium'|'high'){
      enabled=quality!=='low';ao.enabled=quality==='high';
      bloom.strength=quality==='high'?.32:.22;
      composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
    },
    resize(){composer.setSize(innerWidth,innerHeight);},
    render(){
      if(enabled)composer.render();else renderer.render(scene,camera);
      const background=scene.background,mask=camera.layers.mask,autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.autoUpdate;
      scene.background=null;camera.layers.set(1);renderer.autoClear=false;renderer.clearDepth();
      renderer.shadowMap.autoUpdate=false;
      renderer.render(scene,camera);
      scene.background=background;camera.layers.mask=mask;renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowUpdate;
    },
    dispose(){for(const pass of [base,ao,bloom,output])pass.dispose();ao.ssaoMaterial.dispose();ao.noiseTexture.dispose();composer.dispose();},
  };
}
