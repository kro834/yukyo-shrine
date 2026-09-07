import type {MeshStandardMaterial} from 'three';
/** Subtle floor grime, water tides and nonuniform fading at physical metre scale. */
export function circusFabric(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-circus-wear-v1';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 circusSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncircusSurface=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader='varying vec3 circusSurface;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float groundDirt=1.0-smoothstep(.08,.68,circusSurface.y);
   float weather=sin(dot(circusSurface.xz,vec2(.67,.49))) * sin(dot(circusSurface.xz,vec2(.17,-.83)));
   float drip=sin((circusSurface.x+circusSurface.z)*18.3+weather*2.0)*.5+.5;
   float tide=1.0-smoothstep(.015,.09,abs(circusSurface.y-(.22+.055*weather)));
   diffuseColor.rgb*=vec3(.91,.90,.87)*(1.0-groundDirt*(.11+.08*drip)-tide*.06+weather*.055);
  `);
 };
}
