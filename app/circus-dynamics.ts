// Outside-Site imports for verification; use normal three/addons imports in the Site.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CircusPlan,CircusSnapshot,CircusPoint} from './circus-types.ts';
import {circusRoofHeight,type CircusMaterial,type CircusAdd} from './circus-scenery.ts';
type Materials=Record<CircusMaterial,THREE.Material>;

/** Dynamic geometry uses the same local +Z/yaw convention as CircusRuntime.
 * This module owns/disposes geometry only; root retains the shared materials.
 */
export function createCircusDynamics(plan:CircusPlan,materials:Materials){
 const group=new THREE.Group();group.name='circus-mechanisms';
 const ownedGeometries=new Set<THREE.BufferGeometry>(),ownedMaterials=new Set<THREE.Material>();
 const box=(add:CircusAdd,x:number,y:number,z:number,w:number,h:number,d:number,m:CircusMaterial)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
 const cyl=(add:CircusAdd,x:number,y:number,z:number,r:number,h:number,m:CircusMaterial,segments=16)=>add(new THREE.CylinderGeometry(r,r,h,segments).translate(x,y,z),m);
 const rod=(add:CircusAdd,a:THREE.Vector3,b:THREE.Vector3,r:number,m:CircusMaterial)=>{const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);};
 const batch=(parent:THREE.Group,draw:(add:CircusAdd)=>void)=>{
  const chunks=new Map<CircusMaterial,THREE.BufferGeometry[]>();
  draw((g,m)=>{if(!chunks.has(m))chunks.set(m,[]);chunks.get(m)!.push(g);});
  const meshes:THREE.Mesh[]=[];
  for(const [m,parts] of chunks){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.add(geometry);const mesh=new THREE.Mesh(geometry,materials[m]);mesh.castShadow=m!=='circusGlow';mesh.receiveShadow=m!=='circusGlow';parent.add(mesh);meshes.push(mesh);}
  return meshes;
 };
 const cart=new THREE.Group();cart.name='circus-rideable-cart';group.add(cart);
 batch(cart,add=>{
  box(add,0,.33,0,1.1,.13,1.76,'circusDark');
  for(const x of [-.38,0,.38])box(add,x,.415,0,.36,.065,1.69,'wood');
  for(const x of [-.57,.57]){
   box(add,x,.58,0,.055,.35,1.65,'circusRed');
   box(add,x,.79,0,.064,.065,1.75,'circusBrass');
  }
  for(const z of [-.78,.78]){
   box(add,0,.57,z,1.12,.32,.07,'circusRed');
   box(add,0,1.00,z,1.10,.048,.05,'circusMetal');
   for(const x of [-.49,.49])rod(add,new THREE.Vector3(x,.41,z),new THREE.Vector3(x,1.01,z),.023,'circusMetal');
  }
  box(add,0,.63,-.30,.92,.07,.35,'wood');
  for(const z of [-.53,.53]){const axle=new THREE.CylinderGeometry(.035,.035,1.05,8);axle.rotateZ(Math.PI/2);axle.translate(0,.205,z);add(axle,'circusMetal');}
 });
 const wheels:THREE.Mesh[]=[];
 for(const x of [-.41,.41])for(const z of [-.53,.53]){
  const wheelGeometry=new THREE.CylinderGeometry(.16,.16,.085,16);wheelGeometry.rotateZ(Math.PI/2);ownedGeometries.add(wheelGeometry);const wheel=new THREE.Mesh(wheelGeometry,materials.circusMetal);wheel.position.set(x,.205,z);wheel.castShadow=true;cart.add(wheel);wheels.push(wheel);
 }
 const mechanisms=new Map<string,{root:THREE.Group;update:(progress:number,time:number)=>void}>();
 for(const device of plan.devices){
  const root=new THREE.Group();root.name=device.id;root.position.set(device.position.x,0,device.position.z);root.rotation.y=device.yaw;group.add(root);
  const dx=device.control.x-device.position.x,dz=device.control.z-device.position.z,c=Math.cos(device.yaw),s=Math.sin(device.yaw),u=dx*c-dz*s,v=dx*s+dz*c;
  const handle=new THREE.Group();handle.position.set(u,1.35,v);root.add(handle);
  batch(handle,add=>{const ring=new THREE.TorusGeometry(.105,.014,5,16);add(ring,'circusBrass');});
  batch(root,add=>rod(add,new THREE.Vector3(u,1.50,v),new THREE.Vector3(u,circusRoofHeight(device.control.x,device.control.z)-.10,v),.012,'rope'));
  let update:(progress:number,time:number)=>void=()=>{};
  if(device.kind==='curtain'){
   batch(root,add=>{
    rod(add,new THREE.Vector3(-1.60,3.08,0),new THREE.Vector3(1.60,3.08,0),.04,'circusMetal');
    for(const x of [-1.52,1.52])rod(add,new THREE.Vector3(x,3.08,0),new THREE.Vector3(x,circusRoofHeight(device.position.x,device.position.z)-.12,0),.018,'rope');
   });
   const panels:THREE.Group[]=[];
   for(const side of [-1,1]){
    const panel=new THREE.Group();root.add(panel);panels.push(panel);
    batch(panel,add=>{
     const p:number[]=[],uv:number[]=[],idx:number[]=[],segments=20;
     for(let i=0;i<=segments;i++)for(const y of [.18,2.97]){const x=-.70+i*1.4/segments,z=Math.cos(i*Math.PI/2)*.055;p.push(x,y,z);uv.push(i/8,y/1.1);}
     for(let i=0;i<segments;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
     const cloth=new THREE.BufferGeometry();cloth.setAttribute('position',new THREE.Float32BufferAttribute(p,3));cloth.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));cloth.setIndex(idx);cloth.computeVertexNormals();add(cloth,'circusRed');
     box(add,0,.20,0,1.4,.065,.11,'circusBrass');
     for(const x of [-.60,0,.60]){const eye=new THREE.TorusGeometry(.033,.008,4,8);eye.translate(x,3.01,0);add(eye,'circusMetal');}
    });
    panel.position.x=side*.70;
   }
   update=progress=>{for(let i=0;i<2;i++){const side=i===0?-1:1;panels[i].scale.x=1-.86*progress;panels[i].position.x=side*(.70+.60*progress);}};
  }else if(device.kind==='turntable'){
   batch(root,add=>{const ring=new THREE.TorusGeometry(1.285,.035,6,48);ring.rotateX(Math.PI/2);ring.translate(0,.073,0);add(ring,'circusMetal');});
   const rotor=new THREE.Group();root.add(rotor);
   batch(rotor,add=>{
    cyl(add,0,.055,0,1.24,.10,'wood',40);
    for(let i=0;i<12;i++){
     const a=i*Math.PI/6,b=(i+1)*Math.PI/6,p=[0,.109,0,Math.sin(a)*1.21,.109,Math.cos(a)*1.21,Math.sin(b)*1.21,.109,Math.cos(b)*1.21];
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.5,.5,Math.sin(a)/2+.5,Math.cos(a)/2+.5,Math.sin(b)/2+.5,Math.cos(b)/2+.5],2));g.setIndex([0,1,2]);g.computeVertexNormals();add(g,i%2?'circusRed':'circusIvory');
    }
    cyl(add,0,.122,0,.11,.027,'circusBrass');
    // The turning screen changes the cross's concealment direction by 90 degrees.
    // Collision contract: width 2.4, depth .10, bottom .15, top 2.25.
    for(const x of [-1.17,1.17])rod(add,new THREE.Vector3(x,.14,0),new THREE.Vector3(x,2.27,0),.027,'circusMetal');
    rod(add,new THREE.Vector3(-1.20,2.25,0),new THREE.Vector3(1.20,2.25,0),.025,'circusBrass');
    for(let stripe=0;stripe<8;stripe++){
     const points:number[]=[],uvs:number[]=[],indices:number[]=[];
     for(let i=0;i<=4;i++)for(const y of [.15,2.25]){const x=-1.2+(stripe+i/4)*.30,z=Math.sin(i*Math.PI/2)*.028;points.push(x,y,z);uvs.push((stripe+i/4)*.3,y);}
     for(let i=0;i<4;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
     const screen=new THREE.BufferGeometry();screen.setAttribute('position',new THREE.Float32BufferAttribute(points,3));screen.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));screen.setIndex(indices);screen.computeVertexNormals();add(screen,stripe%3?'circusRed':'circusIvory');
    }
   });
   update=progress=>{rotor.rotation.y=progress*Math.PI/2;};
  }else if(device.kind==='drawbridge'){
   batch(root,add=>{
    // Machinery is narrow enough to leave the original side walking strips clear.
    for(const x of [-.87,.87])cyl(add,x,.16,-1.6,.10,.24,'circusMetal',10);
    const hinge=new THREE.CylinderGeometry(.09,.09,1.75,12);hinge.rotateZ(Math.PI/2);hinge.translate(0,.10,-1.6);add(hinge,'circusBrass');
   });
   const leaf=new THREE.Group();leaf.position.set(0,.10,-1.6);root.add(leaf);
   batch(leaf,add=>{
    box(add,0,0,1.6,1.5,.08,3.2,'circusDark');
    for(let i=0;i<10;i++)box(add,0,.052,.16+i*.32,1.48,.024,.303,i%3===0?'circusIvory':'wood');
    for(const x of [-.72,.72])box(add,x,.06,1.6,.06,.085,3.20,'circusMetal');
   });
   update=progress=>{leaf.rotation.x=-progress*Math.PI/2;};
  }else{
   // The lure is suspended: neither its foot nor an invisible pedestal blocks the cross.
   batch(root,add=>{
    rod(add,new THREE.Vector3(-.48,3.16,0),new THREE.Vector3(.48,3.16,0),.035,'circusMetal');
    for(const x of [-.43,.43])rod(add,new THREE.Vector3(x,3.16,0),new THREE.Vector3(x,circusRoofHeight(device.position.x,device.position.z)-.1,0),.014,'rope');
   });
   const gong=new THREE.Group();gong.position.y=2.67;root.add(gong);
   batch(gong,add=>{const g=new THREE.CylinderGeometry(.34,.34,.05,24);g.rotateX(Math.PI/2);add(g,'circusBrass');const boss=new THREE.SphereGeometry(.075,10,6);boss.scale(1,1,.4);boss.translate(0,0,.05);add(boss,'circusMetal');});
   const beacon=new THREE.Group();beacon.position.y=3.05;root.add(beacon);
   const meshes=batch(beacon,add=>{box(add,0,0,0,.18,.22,.18,'circusGlow');});
   const glow=(materials.circusGlow as THREE.MeshStandardMaterial).clone();ownedMaterials.add(glow);meshes[0].material=glow;
   update=(progress,time)=>{gong.rotation.z=Math.sin(time*8)*progress*.16;beacon.rotation.y=time*progress*1.3;glow.emissiveIntensity=.30+progress*(.30+.16*Math.sin(time*4));};
  }
  mechanisms.set(device.id,{root,update:(progress,time)=>{handle.position.y=1.35-.14*progress;update(progress,time);}});
 }
 return {
  group,cart,
  update(snapshot:CircusSnapshot,timeSeconds=0,viewer?:CircusPoint){
   cart.position.set(snapshot.cart.x,0,snapshot.cart.z);cart.rotation.y=snapshot.yaw;
   for(const wheel of wheels)wheel.rotation.x=snapshot.distance/.16;
   cart.visible=!viewer||snapshot.riding||Math.hypot(viewer.x-snapshot.cart.x,viewer.z-snapshot.cart.z)<100;
   for(const state of snapshot.devices){const mechanism=mechanisms.get(state.id);if(!mechanism)continue;mechanism.update(Math.max(0,Math.min(1,state.progress)),timeSeconds);mechanism.root.visible=!viewer||Math.hypot(viewer.x-mechanism.root.position.x,viewer.z-mechanism.root.position.z)<100;}
  },
  dispose(){group.removeFromParent();ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());},
 };
}



