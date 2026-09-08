import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

export function waterReflectionUniforms(){return {
 waterReflectionMap:{value:null as THREE.Texture|null},waterReflectionMatrix:{value:new THREE.Matrix4()},
 waterReflectionLevel:{value:0},waterReflectionGain:{value:0},
};}
type Uniforms=ReturnType<typeof waterReflectionUniforms>;
type WaterTile={x:number;z:number;waterY:number|null};

/** Reflector reuses the main camera's shadow atlases. On the first frame or
 * after a quality switch those depth textures may not have been rendered yet. */
export function reflectionShadowsReady(scene:THREE.Object3D){
 let ready=true;
 scene.traverseVisible(object=>{
  const light=object as THREE.Light&{shadow?:THREE.LightShadow};
  if(light.isLight&&light.castShadow&&!light.shadow?.map)ready=false;
 });
 return ready;
}

export function reflectedWaterFinish(material:THREE.MeshStandardMaterial,uniforms:Uniforms){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>`outdoor-reflection-v1-${key}`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader=`uniform sampler2D waterReflectionMap;uniform mat4 waterReflectionMatrix;
   uniform float waterReflectionLevel;uniform float waterReflectionGain;\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',`
   if(waterReflectionGain>0.0&&abs(waterWorld.y-waterReflectionLevel)<.02){
    vec3 surfaceUp=inverseTransformDirection(normal,viewMatrix);
    vec4 projection=waterReflectionMatrix*vec4(waterWorld,1.0);
    vec2 reflectionUV=projection.xy/max(projection.w,.0001)+surfaceUp.xz*.012;
    vec2 edge=min(reflectionUV,1.0-reflectionUV);
    float validity=smoothstep(0.0,.025,min(edge.x,edge.y))*step(.001,projection.w)*smoothstep(.65,.95,surfaceUp.y);
    float fresnel=.0204+.9796*pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),5.0);
    vec3 reflection=texture2D(waterReflectionMap,clamp(reflectionUV,0.001,.999)).rgb;
    reflectedLight.indirectSpecular=mix(reflectedLight.indirectSpecular,reflection*fresnel,validity*waterReflectionGain);
   }
   vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
  `);
 };
}

/** One shared, bounded reflection view for the nearest water level. The capture
 * excludes water and pool mirrors to prevent recursive texture feedback. */
export class OutdoorReflection{
 private reflector=new Reflector(new THREE.PlaneGeometry(1,1),{textureWidth:1,textureHeight:1,multisample:0});
 private last=-Infinity;private position=new THREE.Vector3(Infinity,Infinity,Infinity);private rotation=new THREE.Quaternion();
 private inverse=new THREE.Matrix4();private active=false;private captured=false;
 constructor(private uniforms:Uniforms,private tiles:readonly WaterTile[]){
  this.reflector.rotation.x=-Math.PI/2;this.reflector.visible=false;
  uniforms.waterReflectionMap.value=this.reflector.getRenderTarget().texture;
 }
 update(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,time:number,enabled:boolean,excluded:readonly THREE.Object3D[]){
  let nearest:WaterTile|undefined,best=26*26;
  if(enabled)for(const tile of this.tiles){
   if(tile.waterY===null||camera.position.y<tile.waterY+.2)continue;
   const dx=Math.max(0,Math.abs(camera.position.x-tile.x*4)-2),dz=Math.max(0,Math.abs(camera.position.z-tile.z*4)-2),d=dx*dx+dz*dz;
   if(d<best){best=d;nearest=tile;}
  }
  this.uniforms.waterReflectionGain.value=0;
  if(!nearest){if(this.active)this.reflector.getRenderTarget().setSize(1,1);this.active=this.captured=false;return false;}
  const changed=!this.active||this.reflector.position.y!==nearest.waterY;
  if(changed)this.captured=false;
  if(!this.active)this.reflector.getRenderTarget().setSize(512,512);this.active=true;
  this.reflector.position.y=nearest.waterY!;this.reflector.updateMatrixWorld();
  if(changed||time-this.last>90||camera.position.distanceToSquared(this.position)>.0009||camera.quaternion.angleTo(this.rotation)>.002){
   if(renderer.shadowMap.enabled&&!reflectionShadowsReady(scene)){
    // The normal render below will allocate the missing atlas. Reuse only a
    // completed capture at this same water level, never an uninitialized target.
    if(this.captured){this.uniforms.waterReflectionLevel.value=nearest.waterY!;this.uniforms.waterReflectionGain.value=.85;}
    return this.captured;
   }
   scene.updateMatrixWorld();camera.updateMatrixWorld();const visibility=excluded.map(o=>o.visible);
   try{
    excluded.forEach(o=>o.visible=false);
    const material=this.reflector.material as THREE.ShaderMaterial;
    this.reflector.onBeforeRender(renderer,scene,camera,this.reflector.geometry,material,null!);
    this.inverse.copy(this.reflector.matrixWorld).invert();
    this.uniforms.waterReflectionMatrix.value.copy(material.uniforms.textureMatrix.value).multiply(this.inverse);
    this.last=time;this.position.copy(camera.position);this.rotation.copy(camera.quaternion);this.captured=true;
   }finally{excluded.forEach((o,i)=>o.visible=visibility[i]);this.reflector.visible=false;}
  }
  this.uniforms.waterReflectionLevel.value=nearest.waterY!;this.uniforms.waterReflectionGain.value=.85;
  return true;
 }
 dispose(){this.uniforms.waterReflectionGain.value=0;this.uniforms.waterReflectionMap.value=null;this.reflector.geometry.dispose();this.reflector.dispose();}
}
