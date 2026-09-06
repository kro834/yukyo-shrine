import * as THREE from 'three';
import type {Doors,Enemies} from './shrine-gameplay';
export function createDoorMeshes(scene:THREE.Scene,doors:Doors){
  const wood=new THREE.MeshStandardMaterial({color:'#211815',roughness:.8});
  const paper=new THREE.MeshStandardMaterial({color:'#979284',roughness:.95});
  const metal=new THREE.MeshStandardMaterial({color:'#352e23',metalness:.65,roughness:.45});
  const panels:THREE.Group[]=[];
  for(const door of doors.states){
    const group=new THREE.Group();group.position.set(door.spec.x,0,door.spec.z);if(!door.spec.alongX)group.rotation.y=Math.PI/2;scene.add(group);
    const box=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);};
    for(const x of [-1.76,1.76])box(group,x,1.7,0,.48,3.4,.36,wood);
    box(group,0,3.17,0,4,.48,.34,wood);box(group,0,.035,0,4,.07,.35,wood);
    const leaf=new THREE.Group();group.add(leaf);panels.push(leaf);
    box(leaf,0,1.48,0,2.97,2.88,.1,paper);
    for(const x of [-1.48,1.48])box(leaf,x,1.48,0,.05,2.92,.13,wood);
    for(const y of [.04,.52,2.94])box(leaf,0,y,0,2.99,.05,.13,wood);
    // Subtle grain bands and a low wood kick-panel, with no writing.
    box(leaf,0,.28,0,2.96,.46,.12,wood);
    for(const side of [-1,1]){const pull=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.018,20),metal);pull.rotation.x=Math.PI/2;pull.position.set(1.05,1.3,side*.065);leaf.add(pull);}
  }
  return {update(){doors.states.forEach((d,i)=>panels[i].position.x=d.progress*3.02);},dispose(){wood.dispose();paper.dispose();metal.dispose();}};
}
export function createEnemyMeshes(scene:THREE.Scene,enemies:Enemies){
  const cloth=new THREE.MeshStandardMaterial({color:'#242423',roughness:1});
  const under=new THREE.MeshStandardMaterial({color:'#090d0d',roughness:1});
  const masks:THREE.MeshStandardMaterial[]=[];
  const actors=enemies.actors.map((enemy,index)=>{
    const root=new THREE.Group();scene.add(root);
    const mask=new THREE.MeshStandardMaterial({color:'#9f9c90',roughness:.88,emissive:'#799baa',emissiveIntensity:0});masks.push(mask);
    const part=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
    const robe=part(new THREE.CylinderGeometry(.24,.55,1.55,18,5),cloth,0,.82,0);
    robe.geometry.rotateY(.15);
    part(new THREE.SphereGeometry(.24,16,12),under,0,1.79,0);
    const face=part(new THREE.SphereGeometry(.2,20,14),mask,0,1.78,.135);face.scale.set(.8,1.24,.35);
    for(const x of [-.07,.07]){const eye=part(new THREE.SphereGeometry(.026,8,6),under,x,1.82,.2);eye.scale.set(1.4,.4,.35);}
    const mouth=part(new THREE.SphereGeometry(.025,8,6),under,0,1.69,.205);mouth.scale.set(.6,1.5,.4);
    const arms=[-1,1].map(side=>{const arm=part(new THREE.CylinderGeometry(.13,.075,.9,10),cloth,side*.33,1.08,.02);arm.rotation.z=side*.17;part(new THREE.SphereGeometry(.072,10,8),mask,side*.4,.6,.035);return arm;});
    const belt=part(new THREE.CylinderGeometry(.305,.305,.17,18),under,0,1.15,0);
    belt.scale.z=.85;
    const ringMat=new THREE.MeshBasicMaterial({color:'#b8dcd4',transparent:true,opacity:0,depthWrite:false});
    const ring=part(new THREE.TorusGeometry(.69,.016,6,48),ringMat,0,.045,0);ring.rotation.x=Math.PI/2;
    return {root,arms,ringMat,face,index};
  });
  return {update(time:number){enemies.actors.forEach((e,i)=>{const a=actors[i],stunned=e.brain.mode==='stunned';a.root.position.set(e.position.x,0,e.position.z);a.root.rotation.y=e.facing;a.root.rotation.z=stunned?.08:Math.sin(time*.0015+i)*.012;a.arms.forEach((arm,j)=>arm.rotation.x=stunned?0:Math.sin(time*.0035+i+j)*.07);masks[i].emissiveIntensity=stunned?.4:0;a.ringMat.opacity=stunned?.45:0;});},dispose(){cloth.dispose();under.dispose();masks.forEach(m=>m.dispose());actors.forEach(a=>a.ringMat.dispose());}};
}

