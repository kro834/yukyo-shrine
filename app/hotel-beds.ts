import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {HotelBed} from './hotel-scenery.ts';

/** One shared simulated cover, instanced locally; texture resources belong to the world. */
export class HotelBeds {
 readonly ready:Promise<void>;private disposed=false;private meshes:THREE.InstancedMesh[]=[];private geometries:THREE.BufferGeometry[]=[];
 constructor(private scene:THREE.Scene,private beds:HotelBed[],private linen:THREE.MeshStandardMaterial,private wood:THREE.MeshStandardMaterial,enabled=true){
  this.ready=enabled&&beds.length?this.load():Promise.resolve();
 }
 private async load(){
  try{
   const gltf=await new GLTFLoader().loadAsync('/models/hotel/settled-bed-v64.glb');gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
    if(!this.disposed){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);const uv=geometry.getAttribute('uv');if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
     this.geometries.push(geometry);const groups=new Map<string,HotelBed[]>();for(const p of this.beds){const key=Math.floor(p.x/24)+':'+Math.floor(p.z/24);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(p);}
     for(const group of groups.values()){const mesh=new THREE.InstancedMesh(geometry,o.name==='bed_base'?this.wood:this.linen,group.length),matrix=new THREE.Matrix4();mesh.name='hotel-bed-'+o.name;mesh.castShadow=mesh.receiveShadow=true;
      group.forEach((p,i)=>{matrix.compose(new THREE.Vector3(p.x,0,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(p.width/1.65,1,1));mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();this.scene.add(mesh);this.meshes.push(mesh);
     }
    }
    o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
   });
  }catch(e){if(!this.disposed)console.warn('Hotel bed load failed',e);}
 }
 update(p:{x:number;z:number},low:boolean){for(const m of this.meshes){const b=m.boundingSphere!;m.visible=Math.hypot(p.x-b.center.x,p.z-b.center.z)<(low?40:70)+b.radius;m.castShadow=!low;}}
 dispose(){this.disposed=true;for(const m of this.meshes){m.removeFromParent();m.dispose();}this.geometries.forEach(g=>g.dispose());}
}
