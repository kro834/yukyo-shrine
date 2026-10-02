import * as THREE from 'three';
import type {Bead} from './magatama.ts';
/** `glowTex` lights a pale sprite under dropped beads, so a guarded bundle is findable from across a hall. */
export function createMagatamaMeshes(scene:THREE.Scene,beads:Bead[],glowTex?:THREE.Texture){
  const shape=new THREE.Shape();shape.moveTo(.02,.3);shape.bezierCurveTo(-.3,.35,-.4,.02,-.22,-.2);shape.bezierCurveTo(-.05,-.39,.26,-.24,.3,-.03);shape.bezierCurveTo(.16,-.14,.07,-.13,.04,-.04);shape.bezierCurveTo(.32,.04,.29,.29,.02,.3);
  const hole=new THREE.Path();hole.absarc(.015,.16,.055,0,Math.PI*2,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:20});geometry.center();
  const blue=new THREE.MeshPhysicalMaterial({color:'#367bb8',roughness:.21,metalness:.1,clearcoat:1,clearcoatRoughness:.17,emissive:'#327aaa',emissiveIntensity:.55});
  const red=blue.clone();red.color.set('#b6313e');red.emissive.set('#d33b49');red.emissiveIntensity=.72;
  const gold=blue.clone();gold.color.set("#ffd878");gold.emissive.set("#e7a62b");gold.metalness=.85;gold.roughness=.24;
  gold.emissiveIntensity=.68;
  const haloGeometry=new THREE.PlaneGeometry(.94,.94);
  const haloMaterial=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{haloColor:{value:new THREE.Color('#ffc96d')},haloOpacity:{value:.10}}]),
    vertexShader:`varying vec2 haloUv;
      #include <fog_pars_vertex>
      void main(){
        haloUv=uv;vec4 mvPosition=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);
        mvPosition.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform vec3 haloColor;uniform float haloOpacity;varying vec2 haloUv;
      #include <fog_pars_fragment>
      void main(){
        float radius=length(haloUv-.5)*2.0;
        float alpha=pow(1.0-smoothstep(.08,1.0,radius),2.0)*haloOpacity;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            alpha*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
          #else
            alpha*=1.0-smoothstep(fogNear,fogFar,vFogDepth);
          #endif
        #endif
        if(alpha<.001)discard;
        gl_FragColor=vec4(haloColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:true,
  });
  const dropGlow=glowTex?new THREE.SpriteMaterial({map:glowTex,color:'#9fb8c9',transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending}):null;
  const sprites=new Map<number,THREE.Sprite>();
  const dropSprite=(i:number)=>{let sprite=sprites.get(i);if(!sprite&&dropGlow){sprite=new THREE.Sprite(dropGlow);sprite.name='magatama-drop-glow';sprite.scale.set(1.3,1.3,1);scene.add(sprite);sprites.set(i,sprite);}return sprite;};
  const meshes=beads.map(b=>{const m=new THREE.Mesh(geometry,b.color==='gold'?gold:b.color==='red'?red:blue);m.name='magatama-'+b.id;if(b.color==='gold'){m.scale.setScalar(2.4);const halo=new THREE.Mesh(haloGeometry,haloMaterial);halo.name='magatama-gold-halo';halo.castShadow=false;halo.receiveShadow=false;m.add(halo);}else if(b.color==='red')m.scale.setScalar(1.2);m.position.set(b.position.x,b.floor+.95,b.position.z);m.castShadow=true;scene.add(m);return m;});
  return {update(time:number){const pulse=Math.sin(time*.00125);gold.emissiveIntensity=.68+.07*pulse;haloMaterial.uniforms.haloOpacity.value=.10+.025*pulse;beads.forEach((b,i)=>{const m=meshes[i];m.visible=!b.collected;if(m.visible){m.rotation.y=time*.00065+i;const drift=b.dropped?time*.0007+i*2.1:0;m.position.x=b.position.x+(b.dropped?Math.cos(drift)*.12:0);m.position.z=b.position.z+(b.dropped?Math.sin(drift)*.12:0);m.position.y=b.floor+.95+Math.sin(time*.0018+i)*.07;}const sprite=m.visible&&b.dropped?dropSprite(i):sprites.get(i);if(sprite){sprite.visible=m.visible&&!!b.dropped;if(sprite.visible)sprite.position.set(m.position.x,b.floor+.55,m.position.z);}});},dispose(){for(const mesh of meshes)mesh.removeFromParent();for(const sprite of sprites.values())sprite.removeFromParent();dropGlow?.dispose();geometry.dispose();haloGeometry.dispose();haloMaterial.dispose();blue.dispose();red.dispose();gold.dispose();}};
}
