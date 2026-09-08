import * as THREE from 'three';

const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
/** Slow district voltage sag, unrelated to enemy positions; never strobe. */
export function hotelVoltage(p:{x:number;y:number;z:number},seconds:number,active=true){
 const sector=Math.floor((p.x+2)/16)+Math.floor((p.z+2)/16)*7+Math.floor(p.y/4.8)*13;
 const t=((seconds+Math.abs(sector)*17.31)%76+76)%76;
 return .78*(1-(active? .84*smooth(0,1.6,t)*(1-smooth(4,6.8,t)):0));
}
export class HotelAtmosphere {
 private time={value:0};private active={value:1};
 update(seconds:number,active:boolean){this.time.value=seconds;this.active.value=active?1:0;}
 gain(p:{x:number;y:number;z:number}){return hotelVoltage(p,this.time.value,!!this.active.value);}
 /** Use the same voltage curve for the visible diffuser and its pooled light. */
 finish(material:THREE.MeshStandardMaterial){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),time=this.time,active=this.active;
  material.customProgramCacheKey=()=>key()+'-hotel-voltage-v65';
  material.onBeforeCompile=(shader,renderer)=>{
   compile.call(material,shader,renderer);shader.uniforms.hotelTime=time;shader.uniforms.hotelActive=active;
   shader.vertexShader='varying vec3 vHotelPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHotelPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
   shader.fragmentShader='varying vec3 vHotelPosition; uniform float hotelTime; uniform float hotelActive;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float hs = floor((vHotelPosition.x+2.)/16.) + floor((vHotelPosition.z+2.)/16.)*7. + floor(vHotelPosition.y/4.8)*13.;
    float ht = mod(hotelTime+abs(hs)*17.31,76.);
    totalEmissiveRadiance *= .78*(1.-hotelActive*.84*smoothstep(0.,1.6,ht)*(1.-smoothstep(4.,6.8,ht)));`);
  };
 }
}
