import * as THREE from 'three';
import fs from 'node:fs/promises';
import {specialEnemyRig} from '../app/enemy-rigs.ts';
import {mergeEnemyParts,drapedBatches} from '../app/enemy-batches.ts';
const encode=mesh=>{
 mesh.updateMatrix();const g=mesh.geometry;
 return {positions:Array.from(g.getAttribute('position').array),uvs:Array.from(g.getAttribute('uv').array),indices:Array.from(g.index.array),matrix:mesh.matrix.toArray(),drape:g.userData.drape??null};
};
const result={};
for(const kind of ['errorWatch','errorWeep','hatred','wrath','warden','fox','pilgrim','mire']){
 const materials=Object.fromEntries(['cloth','paleCloth','sculpt','skin','mask','black','cord'].map(name=>[name,new THREE.MeshStandardMaterial({name})]));
 const root=new THREE.Group(),captured=new WeakMap();
 specialEnemyRig(root,kind,materials,group=>mergeEnemyParts(group,(geometry,parts)=>captured.set(geometry,parts.map(encode))));
 result[kind]=drapedBatches(root).map((mesh,i)=>({name:'cloth_'+i,material:mesh.material.name,parts:captured.get(mesh.geometry)??[encode(mesh)]}));
 root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(materials).forEach(m=>m.dispose());
}
await fs.mkdir('assets/blender',{recursive:true});await fs.writeFile('assets/blender/cloth-bases.json',JSON.stringify(result));
console.log(Object.fromEntries(Object.entries(result).map(([kind,batches])=>[kind,batches.map(b=>b.parts.filter(p=>p.drape).map(p=>p.drape.role))])));
