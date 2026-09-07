import * as THREE from 'three';
import type {MirrorPickup} from './mirror-inventory.ts';
export function createMirrorMeshes(scene:THREE.Scene,pickups:MirrorPickup[]){
 const rim=new THREE.MeshStandardMaterial({color:'#8b7350',metalness:.75,roughness:.42}),silver=new THREE.MeshStandardMaterial({color:'#c6c9bb',metalness:.92,roughness:.16,emissive:'#778f89',emissiveIntensity:.18});
 const disk=new THREE.CylinderGeometry(.21,.21,.032,24),frame=new THREE.TorusGeometry(.22,.025,6,24),handle=new THREE.CylinderGeometry(.025,.035,.26,8);
 const items=pickups.map(p=>{const root=new THREE.Group();root.name='mirror-pickup';root.position.set(p.position.x,p.floor+.85,p.position.z);const face=new THREE.Mesh(disk,silver);face.rotation.x=Math.PI/2;root.add(face,new THREE.Mesh(frame,rim));const grip=new THREE.Mesh(handle,rim);grip.position.y=-.34;root.add(grip);scene.add(root);return root;});
 return {update(time:number){items.forEach((m,i)=>{m.visible=!pickups[i].collected;if(m.visible)m.rotation.y=Math.sin(time*.0005+i)*.25;});},dispose(){for(const m of items){scene.remove(m);}disk.dispose();frame.dispose();handle.dispose();rim.dispose();silver.dispose();}};
}

