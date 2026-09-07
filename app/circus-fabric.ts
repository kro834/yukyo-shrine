import type {MeshStandardMaterial} from 'three';
/** Retain photographed linen microstructure while dyeing its measured albedo.
 * Mean linear luminance of the unmodified 1K source: .39933174. */
export function circusFabric(material:MeshStandardMaterial){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.customProgramCacheKey=()=>key()+'-circus-linen-v3';
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 circusSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncircusSurface=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=`varying vec3 circusSurface;
float canvasHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float canvasNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(canvasHash(i),canvasHash(i+vec2(1.0,0.0)),f.x),mix(canvasHash(i+vec2(0.0,1.0)),canvasHash(i+vec2(1.0)),f.x),f.y);}
`+shader.fragmentShader;
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
   vec2 clothMetres=vec2(circusSurface.x+circusSurface.z*.71,circusSurface.y+circusSurface.z*.31);
   float broad=canvasNoise(clothMetres*.19+vec2(3.7,9.1));
   float weather=canvasNoise(clothMetres*.71+vec2(broad,-broad))*.65+broad*.35;
   float drip=canvasNoise(clothMetres*vec2(7.3,.4));
   float tide=1.0-smoothstep(.015,.09,abs(circusSurface.y-(.22+.055*weather)));
   float faded=smoothstep(.48,.78,weather)*.16;
   float dyeLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dyeLuminance),faded);
   diffuseColor.rgb*=vec3(.91,.90,.87)*(1.0-groundDirt*(.11+.08*drip)-tide*.06+(weather-.5)*.16);
  `);
 };
}

