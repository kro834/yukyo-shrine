import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** The exporter and live actor use the same material batches and joint boundaries. */
export function mergeEnemyParts(group:THREE.Group,capture?:(merged:THREE.BufferGeometry,parts:THREE.Mesh[])=>void){
 const batches=new Map<string,THREE.Mesh[]>();
 for(const child of group.children)if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){
  const key=child.material.uuid+':'+child.layers.mask+':'+Boolean(child.geometry.index);
  if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(child);
 }
 for(const pieces of batches.values()){
  if(pieces.length<2)continue;
  const copies=pieces.map(p=>{p.updateMatrix();return p.geometry.clone().applyMatrix4(p.matrix);});
  const geometry=mergeGeometries(copies);copies.forEach(g=>g.dispose());if(!geometry)continue;
  if(pieces.some(p=>p.geometry.userData.drape)){geometry.userData.drapeBatch=true;capture?.(geometry,pieces);}
  const first=pieces[0],mesh=new THREE.Mesh(geometry,first.material);mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;
  for(const piece of pieces){group.remove(piece);piece.geometry.dispose();}group.add(mesh);
 }
}

export function drapedBatches(root:THREE.Object3D){
 const result:THREE.Mesh<THREE.BufferGeometry>[]=[];
 root.traverse(object=>{if(object instanceof THREE.Mesh&&(object.geometry.userData.drape||object.geometry.userData.drapeBatch))result.push(object);});return result;
}
