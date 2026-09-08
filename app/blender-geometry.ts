import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const assets=new Map<string,Promise<THREE.BufferGeometry>>();
export function prepareBlenderGeometry(geometry:THREE.BufferGeometry){
 // glTF UVs expect flipY=false. Our shared TextureLoader maps use flipY=true.
 const uv=geometry.getAttribute('uv');if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
 const color=geometry.getAttribute('color');
 if(color?.itemSize===4){const rgb=new Float32Array(color.count*3);for(let i=0;i<color.count;i++){rgb[i*3]=color.getX(i);rgb[i*3+1]=color.getY(i);rgb[i*3+2]=color.getZ(i);}geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));}
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
/** Geometry-only Blender assets reuse the game's quality-scaled material library. */
export function upgradeBlenderGeometry(target:THREE.BufferGeometry,url:string){
 if(typeof window==='undefined')return;
 let live=true;const disposed=()=>{live=false;};target.addEventListener('dispose',disposed);
 let asset=assets.get(url);
 if(!asset){asset=new GLTFLoader().loadAsync(url).then(gltf=>{
  gltf.scene.updateMatrixWorld(true);let geometry:THREE.BufferGeometry|undefined;
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){if(!geometry)geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  if(!geometry)throw new Error('Blender mesh is empty');
  return prepareBlenderGeometry(geometry);
 });assets.set(url,asset);}
 void asset.then(geometry=>{if(live){target.copy(geometry);target.userData.blenderAsset=url;}target.removeEventListener('dispose',disposed);}).catch(()=>{target.removeEventListener('dispose',disposed);assets.delete(url);});
}
