import type {MeshStandardMaterial} from 'three';
/** Retain photographed linen microstructure while dyeing its measured albedo.
 * Mean linear luminance of the unmodified 1K source: .39933174. */
export function circusFabric(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-circus-linen-v2';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 circusSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncircusSurface=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader='varying vec3 circusSurface;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec4 linenSample=texture2D(map,vMapUv);
    float linenY=dot(linenSample.rgb,vec3(.2126,.7152,.0722));
    diffuseColor.rgb*=clamp(linenY/.39933174,.60,1.45);
    diffuseColor.a*=linenSample.a;
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float groundDirt=1.0-smoothstep(.08,.68,circusSurface.y);
   float weather=sin(dot(circusSurface.xz,vec2(.67,.49))) * sin(dot(circusSurface.xz,vec2(.17,-.83)));
   float drip=sin((circusSurface.x+circusSurface.z)*18.3+weather*2.0)*.5+.5;
   float tide=1.0-smoothstep(.015,.09,abs(circusSurface.y-(.22+.055*weather)));
   diffuseColor.rgb*=vec3(.91,.90,.87)*(1.0-groundDirt*(.11+.08*drip)-tide*.06+weather*.055);
  `);
 };
}
