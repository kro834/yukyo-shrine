import * as THREE from 'three';
import {GOAL,ALTAR,type ShrineGoal} from './shrine-goal.ts';
export function createGoalMeshes(scene:THREE.Scene,goal:ShrineGoal){
 const root=new THREE.Group();root.position.set(GOAL.x+goal.offset.x,0,GOAL.z+goal.offset.z);scene.add(root);
 const wood=new THREE.MeshStandardMaterial({color:'#261c19',roughness:.68}),gold=new THREE.MeshStandardMaterial({color:'#967343',metalness:.75,roughness:.32}),jade=new THREE.MeshStandardMaterial({color:'#497d65',emissive:'#497d65',emissiveIntensity:.15,roughness:.3});
 const lit=new THREE.MeshBasicMaterial({color:'#72bfff'}),red=new THREE.MeshBasicMaterial({color:'#d9404e'}),dark=new THREE.MeshStandardMaterial({color:'#15271e',roughness:.35,metalness:.18});
 const box=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 for(const side of [-1,1]){
  box(root,side*2.9,1.8,0,2.2,3.6,.46,wood);box(root,side*4,1.8,1.25,.3,3.6,2.5,wood);
  box(root,side*1.88,1.9,-.28,.16,3.8,.18,gold);
  for(let j=0;j<4;j++)box(root,side*(2.12+j*.51),1.75,-.26,.045,3.4,.06,gold);
 }
 box(root,0,3.7,0,8.4,.32,.6,wood);box(root,0,3.9,0,8.7,.1,.72,gold);box(root,0,1.8,2.3,8,3.6,.1,wood);
 const leaves=[-1,1].map(side=>{const leaf=new THREE.Group();root.add(leaf);leaf.position.x=side*.9;box(leaf,0,1.75,0,1.79,3.5,.18,wood);for(const x of [-.83,.83])box(leaf,x,1.75,-.11,.055,3.48,.055,gold);for(const y of [.2,1.05,2.4,3.3])box(leaf,0,y,-.11,1.7,.045,.055,gold);return {leaf,side};});
 const gems=Array.from({length:goal.required},(_,i)=>{const gem=new THREE.Mesh<THREE.OctahedronGeometry,THREE.Material>(new THREE.OctahedronGeometry(.09),dark);gem.position.set((i-(goal.required-1)/2)*.24,3.69,-.34);root.add(gem);return gem;});
 const seal=new THREE.Mesh(new THREE.TorusGeometry(.47,.035,8,40),jade);seal.position.set(0,1.78,-.18);root.add(seal);
 const altar=new THREE.Group();altar.position.set(goal.altar.x,0,goal.altar.z);scene.add(altar);box(altar,0,.45,0,1.7,.9,.8,wood);box(altar,0,.92,0,1.8,.12,.9,gold);box(altar,0,1,0,1.7,.05,.85,wood);
 const offerings=Array.from({length:5},(_,i)=>{const m=new THREE.Mesh<THREE.SphereGeometry,THREE.Material>(new THREE.SphereGeometry(.085,10,8),dark);m.position.set((i-2)*.25,1.1,0);altar.add(m);return m;});
 const redOffering=new THREE.Mesh<THREE.OctahedronGeometry,THREE.Material>(new THREE.OctahedronGeometry(.13),dark);redOffering.position.set(0,1.27,.18);altar.add(redOffering);
 return {update(){for(const {leaf,side} of leaves)leaf.position.x=side*(.9+goal.progress*1.78);gems.forEach((g,i)=>g.material=goal.redOffered?red:i<goal.blueOffered?lit:dark);offerings.forEach((g,i)=>g.material=i<goal.blueOffered?lit:dark);redOffering.material=goal.redOffered?red:dark;seal.visible=goal.progress===0;jade.emissiveIntensity=goal.unlocked?.6:.15;},dispose(){for(const m of [wood,gold,jade,lit,red,dark])m.dispose();}};
}
