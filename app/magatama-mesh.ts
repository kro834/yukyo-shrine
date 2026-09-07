import * as THREE from 'three';
import type {Bead} from './magatama.ts';
export function createMagatamaMeshes(scene:THREE.Scene,beads:Bead[]){
  const shape=new THREE.Shape();shape.moveTo(.02,.3);shape.bezierCurveTo(-.3,.35,-.4,.02,-.22,-.2);shape.bezierCurveTo(-.05,-.39,.26,-.24,.3,-.03);shape.bezierCurveTo(.16,-.14,.07,-.13,.04,-.04);shape.bezierCurveTo(.32,.04,.29,.29,.02,.3);
  const hole=new THREE.Path();hole.absarc(.015,.16,.055,0,Math.PI*2,true);shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:20});geometry.center();
  const blue=new THREE.MeshPhysicalMaterial({color:'#367bb8',roughness:.21,metalness:.1,clearcoat:1,clearcoatRoughness:.17,emissive:'#327aaa',emissiveIntensity:.55});
  const red=blue.clone();red.color.set('#ad2836');red.emissive.set('#c02c3d');
  const gold=blue.clone();gold.color.set("#ffd878");gold.emissive.set("#e7a62b");gold.metalness=.85;gold.roughness=.24;
  const meshes=beads.map(b=>{const m=new THREE.Mesh(geometry,b.color==='gold'?gold:b.color==='red'?red:blue);if(b.color==="gold")m.scale.setScalar(2.4);m.position.set(b.position.x,b.floor+.95,b.position.z);m.castShadow=true;scene.add(m);return m;});
  return {update(time:number){beads.forEach((b,i)=>{const m=meshes[i];m.visible=!b.collected;if(m.visible){m.rotation.y=time*.00065+i;m.position.y=b.floor+.95+Math.sin(time*.0018+i)*.07;}});},dispose(){geometry.dispose();blue.dispose();red.dispose();gold.dispose();}};
}
