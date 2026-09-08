import * as THREE from 'three';
import type {Preferences} from './preferences.ts';
/** Small backlit motes, with soft coverage rather than bright square point sprites. */
export function createAirborneDust(scene:THREE.Scene){
 const count=420,positions=new Float32Array(count*3),seeds=new Float32Array(count);
 for(let i=0;i<count;i++){const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};positions[i*3]=(hash(i*3)-.5)*24;positions[i*3+1]=(hash(i*3+1)-.5)*8;positions[i*3+2]=(hash(i*3+2)-.5)*24;seeds[i]=hash(i+928);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('moteSeed',new THREE.BufferAttribute(seeds,1));
 const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{airTime:{value:0},eye:{value:new THREE.Vector3()},beamForward:{value:new THREE.Vector3(0,0,-1)},lampOn:{value:1},pixelScale:{value:500}}]);
 const material=new THREE.ShaderMaterial({name:'backlit-airborne-dust',uniforms,fog:true,transparent:true,depthTest:true,depthWrite:false,
  vertexShader:`attribute float moteSeed;uniform float airTime;uniform vec3 eye;uniform vec3 beamForward;uniform float lampOn;uniform float pixelScale;varying float coverage;
  #include <fog_pars_vertex>
  void main(){
   vec3 drift=vec3(sin(airTime*.21+moteSeed*41.)*.19,airTime*(.015+moteSeed*.012),cos(airTime*.17+moteSeed*29.)*.16);
   vec3 extent=vec3(24.,8.,24.);vec3 world=eye+mod(position+drift-eye+extent*.5,extent)-extent*.5;
   vec3 delta=world-eye;float distanceToEye=length(delta);float cone=smoothstep(.74,.96,dot(normalize(delta),beamForward));
   float range=1.-smoothstep(6.,12.,distanceToEye);float nearFade=smoothstep(.35,.9,distanceToEye);
   coverage=(.014+lampOn*cone*.58)*range*nearFade*(.35+.65*moteSeed);
   vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
   gl_PointSize=clamp((.003+moteSeed*.007)*pixelScale/max(.3,-mvPosition.z),1.1,4.5);
   #include <fog_vertex>
  }`,
  fragmentShader:`varying float coverage;
  #include <fog_pars_fragment>
  void main(){vec2 q=gl_PointCoord-.5;float r=dot(q,q)*4.;if(r>1.)discard;
   float soft=exp(-r*3.2)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(.58,.55,.49,coverage*soft);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #include <fog_fragment>
  }`});
 const points=new THREE.Points(geometry,material);points.name='airborne-dust';points.frustumCulled=false;scene.add(points);
 return {setQuality(quality:Preferences['quality']){geometry.setDrawRange(0,quality==='low'?96:quality==='medium'?180:quality==='high'?280:420);},
  update(time:number,camera:THREE.PerspectiveCamera,lightOn:boolean,height:number){uniforms.airTime.value=time/1000;uniforms.eye.value.copy(camera.position);camera.getWorldDirection(uniforms.beamForward.value);uniforms.lampOn.value=lightOn?1:0;uniforms.pixelScale.value=height*.5*camera.projectionMatrix.elements[5];},
  dispose(){points.removeFromParent();geometry.dispose();material.dispose();}};
}
