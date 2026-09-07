import * as THREE from 'three';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';

/** SSAO compares normalized linear depth; keep its contact distances in metres. */
export function contactDistances(near:number,far:number){
 const span=Math.max(.001,far-near);
 return {minDistance:.018/span,maxDistance:.55/span,kernelRadius:.5};
}

const bilateralBlur=`
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 cameraInverseProjectionMatrix;
varying vec2 vUv;
#include <packing>
vec3 contactPosition(vec2 uv,float depth){vec4 p=cameraInverseProjectionMatrix*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);return p.xyz/p.w;}
void main(){
 float rawDepth=texture2D(tDepth,vUv).x;
 if(rawDepth>=1.0){gl_FragColor=vec4(1.0);return;}
 float depth=perspectiveDepthToViewZ(rawDepth,cameraNear,cameraFar);
 vec3 normal=normalize(unpackRGBToNormal(texture2D(tNormal,vUv).xyz)),position=contactPosition(vUv,rawDepth);
 float sum=0.0,weightSum=0.0,tolerance=.035+.002*abs(depth);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 uv=vUv+vec2(float(x),float(y))/resolution;
   float sampleDepth=texture2D(tDepth,uv).x;
   if(sampleDepth>=1.0)continue;
   vec3 sampleNormal=normalize(unpackRGBToNormal(texture2D(tNormal,uv).xyz));
   float difference=abs(dot(contactPosition(uv,sampleDepth)-position,normal))/tolerance;
   float weight=exp(-difference*difference)*pow(max(dot(normal,sampleNormal),0.0),8.0)/(1.0+float(x*x+y*y));
   sum+=texture2D(tDiffuse,uv).r*weight;weightSum+=weight;
 }
 // A restrained contact shadow leaves the material's dark albedo readable.
 gl_FragColor=vec4(vec3(mix(1.0,sum/max(weightSum,.00001),.62)),1.0);
}`;

/** Half-resolution contact detail on High only; no additional scene pass. */
export class ContactOcclusion extends SSAOPass {
 private excluded:THREE.Object3D[]=[];
 private resolutionScale:number;
 constructor(scene:THREE.Scene,camera:THREE.PerspectiveCamera,width:number,height:number,ultra=false){
  const scale=ultra?.75:.5;
  super(scene,camera,Math.max(1,Math.ceil(width*scale)),Math.max(1,Math.ceil(height*scale)),ultra?32:16);this.resolutionScale=scale;
  scene.traverse(object=>{
   const mesh=object as THREE.Mesh,materials=mesh.isMesh?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];
   if(object instanceof THREE.Points||object instanceof THREE.Line||object instanceof THREE.Sprite||'isReflector' in object||materials.length&&materials.every(m=>m.transparent||!m.depthWrite))this.excluded.push(object);
  });
  this.blurMaterial.fragmentShader=bilateralBlur;
  Object.assign(this.blurMaterial.uniforms,{
   tDepth:{value:this.normalRenderTarget.depthTexture},tNormal:{value:this.normalRenderTarget.texture},
   cameraNear:{value:camera.near},cameraFar:{value:camera.far},cameraInverseProjectionMatrix:{value:camera.projectionMatrixInverse.clone()},
  });
  // A true rotation around a stable tangent basis avoids degenerate normals.
  this.ssaoMaterial.fragmentShader=this.ssaoMaterial.fragmentShader
   .replace('vec3 random = vec3( texture2D( tNoise, vUv * noiseScale ).r );','float angle = texture2D( tNoise, vUv * noiseScale ).r * 6.2831853;')
   .replace('vec3 tangent = normalize( random - viewNormal * dot( random, viewNormal ) );',`vec3 reference = abs(viewNormal.z)<.99 ? vec3(0.0,0.0,1.0) : vec3(0.0,1.0,0.0);
     vec3 basis = normalize(cross(reference,viewNormal));
     vec3 tangent = basis*cos(angle)+cross(viewNormal,basis)*sin(angle);`);
  this.syncCamera();
 }
 private syncCamera(){
  const camera=this.camera as THREE.PerspectiveCamera;
  Object.assign(this,contactDistances(camera.near,camera.far));
  for(const uniforms of [this.ssaoMaterial.uniforms,this.blurMaterial.uniforms,this.depthRenderMaterial.uniforms]){uniforms.cameraNear.value=camera.near;uniforms.cameraFar.value=camera.far;}
  this.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
  this.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  this.blurMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
 }
 override setSize(w:number,h:number){super.setSize(Math.max(1,Math.ceil(w*this.resolutionScale)),Math.max(1,Math.ceil(h*this.resolutionScale)));}
 override render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget){
  this.syncCamera();
  const hidden=this.excluded.filter(o=>o.visible),override=this.scene.overrideMaterial;
  const autoClear=renderer.autoClear,autoUpdate=renderer.shadowMap.autoUpdate,needsUpdate=renderer.shadowMap.needsUpdate;
  const target=renderer.getRenderTarget(),clearColor=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  hidden.forEach(o=>o.visible=false);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
  try{super.render(renderer,writeBuffer,readBuffer,0,false);}
  finally{hidden.forEach(o=>o.visible=true);this.scene.overrideMaterial=override;renderer.shadowMap.autoUpdate=autoUpdate;renderer.shadowMap.needsUpdate=needsUpdate;renderer.autoClear=autoClear;renderer.setRenderTarget(target);renderer.setClearColor(clearColor,alpha);}
 }
}
