import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Doors,Enemies} from './shrine-gameplay';
export function createDoorMeshes(scene:THREE.Scene,doors:Doors){
  const wood=new THREE.MeshStandardMaterial({color:'#211815',roughness:.8});
  const paper=new THREE.MeshStandardMaterial({color:'#c8b58e',roughness:.85});
  const metal=new THREE.MeshStandardMaterial({color:'#352e23',metalness:.65,roughness:.45});
  const panels:THREE.Group[]=[];
  for(const door of doors.states){
    const group=new THREE.Group();group.position.set(door.spec.x,door.spec.floor??0,door.spec.z);if(!door.spec.alongX)group.rotation.y=Math.PI/2;scene.add(group);
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
  const mergeFixed=(group:THREE.Group,animated=new Set<THREE.Object3D>())=>{
    const batches=new Map<string,THREE.Mesh[]>();
    for(const child of group.children)if(child instanceof THREE.Mesh&&!animated.has(child)&&!Array.isArray(child.material)){
      const key=child.material.uuid+':'+child.layers.mask+':'+Boolean(child.geometry.index);
      if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(child);
    }
    for(const pieces of batches.values()){
      if(pieces.length<2)continue;
      const copies=pieces.map(p=>{p.updateMatrix();return p.geometry.clone().applyMatrix4(p.matrix);});
      const g=mergeGeometries(copies);copies.forEach(c=>c.dispose());if(!g)continue;
      const first=pieces[0],mesh=new THREE.Mesh(g,first.material);mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;
      for(const p of pieces){group.remove(p);p.geometry.dispose();}group.add(mesh);
    }
  };
  const materials:THREE.Material[]=[];
  const make=<T extends THREE.Material>(m:T)=>{materials.push(m);return m;};
  const cloth=make(new THREE.MeshStandardMaterial({color:'#240d25',metalness:.35,roughness:.5}));
  const gold=make(new THREE.MeshStandardMaterial({color:'#f2bf57',metalness:.8,roughness:.24,emissive:'#b17621',emissiveIntensity:.35}));
  const black=make(new THREE.MeshStandardMaterial({color:'#080813',roughness:.5}));
  const colors=['#ff386a','#5fffe0','#bb78ff','#ffbc40','#ff201e'];
  const actors=enemies.actors.map((enemy,index)=>{
    const root=new THREE.Group();scene.add(root);if(enemy.kind==='danger')root.scale.set(1.14,1.1,1.14);
    if(enemy.kind==='watcher')root.scale.set(.8,1.25,.8);
    if(enemy.kind==='stalker')root.scale.set(1.13,.82,1.1);
    const glow=make(new THREE.MeshBasicMaterial({color:(enemy.kind==='danger'?colors[4]:colors[index%4]),toneMapped:false}));
    const mask=make(new THREE.MeshStandardMaterial({color:'#fff2d0',metalness:.25,roughness:.3,emissive:(enemy.kind==='danger'?colors[4]:colors[index%4]),emissiveIntensity:.18}));
    const aura=make(new THREE.MeshBasicMaterial({color:(enemy.kind==='danger'?colors[4]:colors[index%4]),transparent:true,opacity:.13,depthWrite:false,depthTest:false,fog:false,toneMapped:false}));
    const part=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Group=root)=>{
      const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=m!==aura;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    part(new THREE.CylinderGeometry(.32,.67,1.75,12,5),cloth,0,.98,0);
    part(new THREE.CylinderGeometry(.34,.38,.23,12),gold,0,1.4,0);
    // Distinct silhouettes: shrine bearer, listening bell, many-eyed sentinel,
    // crouching crawler, and the broad crowned pursuer.
    if(enemy.kind==='normal'){
      part(new THREE.BoxGeometry(.09,2.8,.09),black,.85,1.4,0);
      part(new THREE.CylinderGeometry(.22,.28,.7,8),glow,.85,2.2,0);
      part(new THREE.ConeGeometry(.55,.35,8),gold,0,2.45,0);
    }
    if(enemy.kind==='listener'){
      const bell=part(new THREE.CylinderGeometry(.35,.7,.95,12),gold,0,2.2,0);bell.scale.z=.8;
      for(const side of [-1,1])part(new THREE.TorusGeometry(.4,.07,6,16),black,side*.75,1.6,0);
    }
    if(enemy.kind==='watcher'){
      for(let j=0;j<5;j++){const a=(j-2)*.48;part(new THREE.SphereGeometry(.12,8,6),glow,Math.sin(a)*.9,2.5+Math.cos(a)*.35,.2);}
      part(new THREE.ConeGeometry(.85,1.1,6),cloth,0,1.75,-.2);
    }
    if(enemy.kind==='stalker'){
      for(const side of [-1,1])for(let j=0;j<3;j++){const leg=part(new THREE.CylinderGeometry(.06,.13,1.3,6),black,side*(.6+j*.16),.55,-.25+j*.3);leg.rotation.z=side*(.7+j*.12);}
      part(new THREE.ConeGeometry(.35,.95,6),mask,0,1.75,.6).rotation.x=Math.PI/2;
    }
    if(enemy.kind==='danger'){
      for(const side of [-1,1]){part(new THREE.BoxGeometry(.55,.65,.75),gold,side*.85,1.75,0);part(new THREE.ConeGeometry(.16,1.3,6),glow,side*.55,2.9,-.1);}
    }
    if(enemy.kind==='listener')for(const side of [-1,1]){
      const ear=part(new THREE.TorusGeometry(.23,.045,7,20),gold,side*.35,2.1,0);ear.rotation.y=Math.PI/2;
      part(new THREE.SphereGeometry(.09,8,6),glow,side*.37,2.1,0);
    }
    if(enemy.kind==='watcher'){
      const veil=part(new THREE.ConeGeometry(.58,.38,12),black,0,2.42,0);veil.scale.z=.8;
      part(new THREE.OctahedronGeometry(.12),glow,0,2.33,.26);
    }
    if(enemy.kind==='stalker')for(const side of [-1,1]){
      const claw=part(new THREE.ConeGeometry(.08,.75,5),gold,side*.6,.45,.3);claw.rotation.x=.6;
    }
    part(new THREE.SphereGeometry(.29,16,12),black,0,2.04,0);
    const face=part(new THREE.SphereGeometry(.27,18,12),mask,0,2.04,.15);face.scale.set(.87,1.22,.45);
    for(const side of [-1,1]){
      const horn=part(new THREE.ConeGeometry(.12,.77,10),gold,side*.23,2.58,.02);horn.rotation.z=-side*.32;
      const eye=part(new THREE.SphereGeometry(.052,10,8),glow,side*.095,2.09,.272);eye.scale.set(1.4,.38,.65);
      const tusk=part(new THREE.ConeGeometry(.045,.2,8),gold,side*.12,1.85,.24);tusk.rotation.z=-side*.2;
      for(let j=0;j<3;j++){
        const armor=part(new THREE.ConeGeometry(.19,.74,4),gold,side*(.46+j*.1),1.65-j*.17,-.03);
        armor.rotation.z=-side*(.85+j*.13);
      }
    }
    const arms=[-1,1].map(side=>{const a=part(new THREE.CylinderGeometry(.19,.09,1.0,10),cloth,side*.43,1.19,.02);a.rotation.z=side*.25;part(new THREE.ConeGeometry(.13,.4,5),gold,side*.56,.62,.02);return a;});
    const halo=new THREE.Group();halo.position.set(0,1.72,-.27);root.add(halo);
    part(new THREE.TorusGeometry(.86,.035,8,64),gold,0,0,0,halo);
    part(new THREE.TorusGeometry(.77,.013,6,64),glow,0,0,0,halo);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6,spike=part(new THREE.ConeGeometry(.075,.34,4),glow,Math.sin(a)*1.02,Math.cos(a)*1.02,0,halo);spike.rotation.z=-a;
    }
    const ribbons=[-1,1].flatMap(side=>[0,1,2].map(j=>{
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.28,1.65,-.1),new THREE.Vector3(side*(.55+j*.1),1.1,-.45),new THREE.Vector3(side*(.65+j*.14),.35,-.15)]);
      return part(new THREE.TubeGeometry(curve,14,.018,5,false),glow,0,0,0);
    }));
    // A faint full-body echo renders after walls, without changing enemy line of sight.
    for(const [g,x,y,z] of [
      [new THREE.CylinderGeometry(.34,.69,1.78,10),0,.98,0],
      [new THREE.SphereGeometry(.3,12,10),0,2.04,.1],
      [new THREE.TorusGeometry(.88,.035,6,40),0,1.72,-.27],
    ] as [THREE.BufferGeometry,number,number,number][]){const echo=part(g,aura,x,y,z);echo.layers.set(1);echo.renderOrder=20;echo.castShadow=false;}
    const ringMat=make(new THREE.MeshBasicMaterial({color:'#b8ffff',transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
    const ring=part(new THREE.TorusGeometry(.85,.025,6,48),ringMat,0,.065,0);ring.rotation.x=Math.PI/2;
    if(enemy.kind==='danger'){
      const crown=part(new THREE.TorusGeometry(1.18,.045,8,64),glow,0,1.65,-.4);crown.rotation.y=.35;
      for(const side of [-1,1]){
        const blade=part(new THREE.ConeGeometry(.15,1.3,4),gold,side*.82,1.4,-.2);blade.rotation.z=-side*.55;
        for(let j=0;j<4;j++){const spine=part(new THREE.ConeGeometry(.08,.45,4),glow,side*(.42+j*.18),2.2-j*.18,-.35);spine.rotation.z=-side*.8;}
      }
      for(let j=0;j<5;j++)part(new THREE.OctahedronGeometry(.055,0),glow,0,1.1+j*.15,.36);
    }
    mergeFixed(halo);mergeFixed(root,new Set([...arms,...ribbons]));
    return {root,arms,halo,ribbons,glow,aura,mask,ringMat,index};
  });
  return {update(time:number,viewer?:{x:number;z:number},range=125){enemies.actors.forEach((e,i)=>{
    const a=actors[i],stunned=e.brain.mode==='stunned';
    a.root.visible=!viewer||Math.hypot(e.position.x-viewer.x,e.position.z-viewer.z)<range;
    if(!a.root.visible)return;
    a.root.position.set(e.position.x,e.floor+.035*Math.sin(time*.0018+i),e.position.z);a.root.rotation.y=e.facing;
    a.arms.forEach((arm,j)=>arm.rotation.x=stunned?0:Math.sin(time*.0035+i+j)*.12);
    a.halo.rotation.z=stunned?0:time*.00018*(i%2?1:-1);
    a.ribbons.forEach((r,j)=>r.rotation.z=Math.sin(time*.0018+j)*.045);
    const color=stunned?'#b8ffff':(e.kind==='danger'?colors[4]:colors[i%4]);a.glow.color.set(color);a.aura.color.set(color);
    a.mask.emissiveIntensity=stunned?.65:e.brain.mode==='chase'?.55+Math.sin(time*.007)*.12:.22;a.ringMat.opacity=stunned?.7:0;
  });},dispose(){materials.forEach(m=>m.dispose());}};
}



