import {SUSPECT_AT} from './notice.ts';
import {hotelHuman} from './hotel-human.ts';
import {specialEnemyRig} from './enemy-rigs.ts';
import {mergeEnemyParts} from './enemy-batches.ts';
import {EnemyLocomotion,footCycle} from './enemy-locomotion.ts';
import {upgradeBlenderGeometry} from './blender-geometry.ts';
import {fusumaPaperFinish} from './fusuma-paper.ts';
import {EXTRA_ENEMY_PROFILES} from './enemy-traits.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {agedFinish} from './surface-finish.ts';
import {SurfaceLibrary} from './surface-library.ts';
import {surfaceUV} from './surface-uv.ts';
import {chamferedBox} from './chamfered-box.ts';
import {finiteFixture} from './finite-fixture.ts';
import {fabricFinish} from './fabric-finish.ts';
import {enemyFabricFinish} from './enemy-fabric.ts';
import {organicFinish} from './organic-finish.ts';
import {slidingDoorLeaf} from './sliding-door-leaf.ts';
import type {Preferences} from './preferences.ts';
import type {Doors,Enemies,Enemy} from './shrine-gameplay';
export function createDoorMeshes(scene:THREE.Scene,doors:Doors,gothic=false,modern=false){
  const wood=new THREE.MeshStandardMaterial({color:'#251914',roughness:.88,vertexColors:true});
  const paper=new THREE.MeshStandardMaterial({color:gothic?'#716658':'#b7af9b',roughness:.97,vertexColors:true});
  agedFinish(paper,modern?'plaster':gothic?'wood':'paper');if(!gothic&&!modern)fusumaPaperFinish(paper);
  const metal=new THREE.MeshStandardMaterial({color:gothic?'#55524b':'#5e5141',metalness:.72,roughness:.48,vertexColors:true});
  const surfaces=new SurfaceLibrary([wood,paper],4);surfaces.setLightingFinish(finiteFixture);if(!gothic)surfaces.preserveBaseFinish(paper);if(!modern)surfaces.add('/materials/wood_planks_diff.jpg',[wood],{tint:gothic?'#837563':'#d9d0c2',normal:'/materials/wood_planks_nor_gl.jpg',roughness:'/materials/wood_planks_rough.jpg',normalStrength:.65,ultra:{full:'/materials/ultra/wood_planks_diff_2k.jpg',normal:'/materials/ultra/wood_planks_nor_gl_2k.jpg',roughness:'/materials/ultra/wood_planks_rough_2k.jpg'}});
  const box=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=chamferedBox(w,h,d).translate(x,y,z);surfaceUV(g,.38,'timber-photo');return g;};
  if(gothic)surfaces.add('/materials/wood_planks_diff.jpg',[paper],{tint:'#716658',normal:'/materials/wood_planks_nor_gl.jpg',roughness:'/materials/wood_planks_rough.jpg',normalStrength:.5,preserveFinish:true});
  else if(modern){wood.color.set('#788388');surfaces.add('/materials/urban/concrete_wall_007_diff_1k.jpg',[paper,wood],{tint:'#a0aaa8',normal:'/materials/urban/concrete_wall_007_nor_gl_1k.jpg',roughness:'/materials/urban/concrete_wall_007_rough_1k.jpg',normalStrength:.16,lowSize:256});}
  else surfaces.add('/materials/interior/decrepit_wallpaper/decrepit_wallpaper_diff_1k.jpg',[paper],{tint:'#d7cdb9',normal:'/materials/interior/decrepit_wallpaper/decrepit_wallpaper_nor_gl_1k.jpg',roughness:'/materials/interior/decrepit_wallpaper/decrepit_wallpaper_rough_1k.jpg',normalStrength:.35,lowSize:256});
  const merged=(parts:THREE.BufferGeometry[])=>{const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geometry;};
  const frameGeometry=merged([box(-1.76,1.7,0,.48,3.4,.36),box(1.76,1.7,0,.48,3.4,.36),box(0,3.17,0,4,.48,.34),box(0,.035,0,4,.07,.35)]);
  if(modern)frameGeometry.scale(1,.86,1);
  frameGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(frameGeometry.getAttribute('position').count*3).fill(1),3));
  const {paperGeometry,leafWoodGeometry,pullGeometry}=slidingDoorLeaf(gothic);
  if(!gothic)upgradeBlenderGeometry(pullGeometry,'/models/error/pull.glb');
  const chunks=new Map<string,number[]>();
  doors.states.forEach(({spec:d},i)=>{const key=Math.floor(d.x/24)+':'+Math.floor(d.z/24)+':'+(d.floor??0);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key)!.push(i);});
  const frames:THREE.InstancedMesh[]=[],matrix=new THREE.Matrix4();
  for(const indices of chunks.values()){
    const mesh=new THREE.InstancedMesh(frameGeometry,wood,indices.length);mesh.name='fusuma-frames';mesh.castShadow=mesh.receiveShadow=true;
    indices.forEach((id,i)=>{const d=doors.states[id].spec;matrix.makeRotationY(d.alongX?0:Math.PI/2);matrix.setPosition(d.x,d.floor??0,d.z);mesh.setMatrixAt(i,matrix);});
    mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;scene.add(mesh);frames.push(mesh);
  }
  const panels=doors.states.map(({spec:d})=>{
    const root=new THREE.Group(),leaf=new THREE.Group();root.name='fusuma';leaf.name='fusuma-leaf';root.position.set(d.x,d.floor??0,d.z);if(!d.alongX)root.rotation.y=Math.PI/2;
    if(modern)leaf.scale.y=.86;
    for(const [g,m] of [[paperGeometry,paper],[leafWoodGeometry,wood],[pullGeometry,metal]] as const){const mesh=new THREE.Mesh(g,m);mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;leaf.add(mesh);}
    root.add(leaf);root.updateMatrix();root.matrixAutoUpdate=false;scene.add(root);return {root,leaf,progress:0};
  });
  return {setQuality(quality:Preferences['quality']){surfaces.setQuality(quality);},update(viewer?:{x:number;y?:number;z:number},range=110){
    for(const frame of frames){const b=frame.boundingSphere!;frame.visible=!viewer||Math.hypot(b.center.x-viewer.x,b.center.z-viewer.z)<range+b.radius;}
    doors.states.forEach((d,i)=>{const p=panels[i];p.root.visible=!viewer||Math.hypot(d.spec.x-viewer.x,d.spec.z-viewer.z)<range;if(d.progress!==p.progress){p.progress=d.progress;p.leaf.position.x=d.progress*3.02;}});
  },dispose(disposeGeometry=true){surfaces.dispose();for(const frame of frames){frame.removeFromParent();frame.dispose();}for(const p of panels)p.root.removeFromParent();for(const m of [wood,paper,metal])m.dispose();if(disposeGeometry)for(const g of [frameGeometry,paperGeometry,leafWoodGeometry,pullGeometry])g.dispose();}};
}
export function createEnemyMeshes(scene:THREE.Scene,enemies:Enemies,human=false){
  const mergeFixed=mergeEnemyParts;
  const cloth=new THREE.MeshStandardMaterial({color:'#302822',metalness:0,roughness:.97});
  const skin=new THREE.MeshStandardMaterial({color:'#928477',roughness:.94});
  const mask=new THREE.MeshStandardMaterial({color:'#bdbaa9',roughness:.82});
  const sculpt=new THREE.MeshStandardMaterial({name:'carved-ritual-mask',color:'#b5ab96',roughness:.92,vertexColors:true});
  const paleCloth=new THREE.MeshStandardMaterial({color:'#ded6c6',roughness:1});
  const tailoredCloth=new THREE.MeshStandardMaterial({name:'tailored-dark-linen',roughness:.97});
  const tailoredPale=new THREE.MeshStandardMaterial({name:'tailored-pale-linen',roughness:1});
  fabricFinish(cloth);fabricFinish(paleCloth,true);
  enemyFabricFinish(tailoredCloth);enemyFabricFinish(tailoredPale,true);
  organicFinish(skin,'skin');organicFinish(mask,'mask');organicFinish(sculpt,'mask');
  const black=new THREE.MeshStandardMaterial({color:'#0c0a09',roughness:.98});
  const cord=new THREE.MeshStandardMaterial({color:'#6a5c40',roughness:1});
  const aura=new THREE.MeshBasicMaterial({color:'#a7c4c0',transparent:true,opacity:.23,depthWrite:false,depthTest:false,fog:false});
  let enabled=true;
  const surfaces=new SurfaceLibrary([cloth,paleCloth,tailoredCloth,tailoredPale,skin,mask,sculpt],4);surfaces.setLightingFinish(finiteFixture);surfaces.preserveBaseFinish(cloth,paleCloth,tailoredCloth,tailoredPale);surfaces.add('/horror-hemp.png',[cloth,paleCloth],{bump:.0015});
  surfaces.add('/materials/textile/rough_linen_diff_1k.jpg',[tailoredCloth,tailoredPale],{normal:'/materials/textile/rough_linen_nor_gl_1k.jpg',roughness:'/materials/textile/rough_linen_rough_1k.jpg',repeat:[.30/.2707081393,.30/.2712999880],normalStrength:.32,preserveFinish:true,lowSize:256,ultra:{full:'/materials/textile/rough_linen_diff_2k.jpg',normal:'/materials/textile/rough_linen_nor_gl_2k.jpg',roughness:'/materials/textile/rough_linen_rough_2k.jpg'}});
  surfaces.add('/materials/enemies/ritual-mask-v60.png',[sculpt],{tint:'#f3eee5',bump:.00035,lowSize:256});
  const part=(parent:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=m!==aura;parent.add(mesh);return mesh;};
  const robe=(top:number,bottom:number,height:number)=>{const g=new THREE.CylinderGeometry(top,bottom,height,24,8);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),fold=1+Math.sin(a*11+p.getY(i)*1.6)*.065;p.setX(i,p.getX(i)*fold);p.setZ(i,p.getZ(i)*fold*.72);}g.computeVertexNormals();return g;};
  const echoRig=(root:THREE.Group)=>{
    const echoGroup=root.clone(true),sources:THREE.Object3D[]=[],targets:THREE.Object3D[]=[];root.traverse(o=>sources.push(o));echoGroup.traverse(o=>{targets.push(o);if(o instanceof THREE.Mesh){o.material=aura;o.layers.set(1);o.castShadow=o.receiveShadow=false;o.renderOrder=20;}});echoGroup.position.set(0,0,0);echoGroup.rotation.set(0,0,0);echoGroup.scale.set(1,1,1);echoGroup.visible=false;root.add(echoGroup);
    return {echoGroup,sync(){for(let i=1;i<sources.length;i++){targets[i].position.copy(sources[i].position);targets[i].quaternion.copy(sources[i].quaternion);targets[i].scale.copy(sources[i].scale);}}};
  };
  const createActor=(e:Enemy)=>{const i=e.id;
    const root=new THREE.Group();root.name='horror-'+e.kind;scene.add(root);
    if(human){const rig=hotelHuman(root,e.kind,{cloth:tailoredCloth,paleCloth:tailoredPale,skin,black,cord},mergeFixed),echo=echoRig(root);return {root,...echo,animate:rig.animate};}
    if(e.kind in EXTRA_ENEMY_PROFILES){const rig=specialEnemyRig(root,e.kind,{cloth:tailoredCloth,paleCloth:tailoredPale,sculpt,skin,mask,black,cord},mergeFixed),echo=echoRig(root);return {root,...echo,animate:rig.animate};}
    if(e.kind==='stalker'){const rig=specialEnemyRig(root,'mire',{cloth:tailoredCloth,paleCloth:cloth,sculpt,skin,mask,black,cord},mergeFixed),echo=echoRig(root);return {root,...echo,animate:rig.animate};}
    const tall=e.kind==='watcher',large=e.kind==='danger';
    root.scale.set(large?1.13:1,tall?1.17:large?1.1:1,1);
    const body=new THREE.Group();root.add(body);const bodyLean=e.kind==='normal'?.13:large?.2:0;body.rotation.x=bodyLean;
    part(body,robe(.24,.43,1.35),cloth,0,.94,0);
    const feet:THREE.Group[]=[];
    for(const side of [-1,1]){
      const collar=part(body,new THREE.BoxGeometry(.095,.57,.055),cloth,side*.11,1.44,.19);collar.rotation.z=side*.43;
      const foot=new THREE.Group();foot.name='tailored-foot';foot.position.set(side*.14,0,.05);root.add(foot);feet.push(foot);
      part(foot,chamferedBox(.11,.12,.23),black,0,.064,.020);
      part(foot,new THREE.CylinderGeometry(.054,.036,.43,10),black,0,.305,-.035);mergeFixed(foot);
    }
    part(body,new THREE.CylinderGeometry(.10,.11,.22,10),skin,0,1.68,0);
    const sash=part(body,robe(.28,.29,.11),cord,0,1.03,.002);
    const head=new THREE.Group();head.position.set(0,1.96,.04);head.rotation.z=e.kind==='listener'?.48:large?-.12:0;head.rotation.x=.08;body.add(head);
    const skull=part(head,new THREE.SphereGeometry(.235,18,14),black,0,0,0);skull.scale.set(.78,1.23,.83);
    const face=part(head,new THREE.SphereGeometry(.224,20,14),e.kind==='normal'||tall?mask:skin,0,-.02,.072);face.scale.set(.76,1.18,.55);
    // Deep eye sockets and an unlit open mouth replace luminous eyes and armor.
    for(const side of [-1,1]){const eye=part(head,new THREE.SphereGeometry(.048,10,8),black,side*.074,.028,.184);eye.scale.set(1,.46,.32);const brow=part(head,new THREE.BoxGeometry(.085,.012,.018),skin,side*.073,.077,.17);brow.rotation.z=side*.16;}
    const nose=part(head,new THREE.ConeGeometry(.029,.115,7),skin,0,-.035,.205);nose.rotation.x=-.32;
    const mouth=part(head,new THREE.SphereGeometry(.039,10,8),black,0,-.139,.181);mouth.scale.set(.78,large?1.5:.45,.22);
    for(let j=0;j<13;j++){const a=(j/12)*Math.PI*1.6-Math.PI*.8;const lock=part(head,new THREE.CylinderGeometry(.024,.008,.35+(j%4)*.12,5),black,Math.sin(a)*.16,-.13,Math.cos(a)*-.13);lock.rotation.z=Math.sin(a)*.1;}
    // Fine pale scars across the mask read only at close range.
    for(let j=0;j<3;j++){const crack=part(head,new THREE.BoxGeometry(.005,.055+j*.02,.005),black,.11-j*.07,-.055+j*.08,.182);crack.rotation.z=.5-j*.35;}
    const arms=[-1,1].map(side=>{const arm=new THREE.Group();arm.position.set(side*.27,1.46,0);body.add(arm);arm.rotation.z=side*.08;
      part(arm,robe(.13,.17,.74),cloth,side*.025,-.33,0);const hand=part(arm,new THREE.SphereGeometry(.085,10,8),skin,side*.04,-.77,.01);hand.scale.set(.65,1.4,.55);
      for(let f=0;f<4;f++){const finger=part(arm,new THREE.CylinderGeometry(.013,.009,.15+(f%2)*.025,5),skin,side*.04+(f-1.5)*.023,-.9,.019);finger.rotation.x=.18+f*.06;}mergeFixed(arm);return arm;});
    if(e.kind==='listener'){for(const side of [-1,1]){const wrap=part(head,new THREE.SphereGeometry(.086,12,8),cloth,side*.19,.02,0);wrap.scale.set(.5,1.3,.8);}}
    if(tall){const veil=part(body,robe(.24,.31,.75),cloth,0,1.66,-.04);veil.scale.z=.72;}
    if(large){part(body,new THREE.SphereGeometry(.30,16,10),cloth,0,1.46,-.15);}
    mergeFixed(head);mergeFixed(body);const echo=echoRig(root),tilt=head.rotation.z,baseY=body.position.y,motion=new EnemyLocomotion();
    return {root,...echo,animate(e:Enemy,time:number){const stunned=e.brain.mode==='stunned',gait=motion.sample(e,time),swing=Math.sin(gait.phase)*gait.weight;
      feet.forEach((foot,j)=>{const step=footCycle(gait.phase,j),travel=step.travel*gait.weight*(.085+.03*gait.run);foot.position.y=step.lift*gait.weight*(.045+.025*gait.run);foot.position.z=.05+travel*gait.forward;});
      arms.forEach((arm,j)=>arm.rotation.x=stunned?.08:Math.sin(gait.phase+j*Math.PI)*gait.weight*(.11+.06*gait.run));
      head.rotation.z=tilt+(stunned?.25:Math.sin(time*.0009+i)*.035)+(e.alert??0)*.32;body.rotation.z=stunned?.08:swing*.008;body.rotation.x=bodyLean-(e.brain.mode==='patrol'&&(e.alert??0)>=SUSPECT_AT?.06:0);
      body.rotation.y=-swing*.028;body.position.y=baseY+(1-Math.cos(gait.phase*2))*gait.weight*.010;
    }};
  };
  const actors=new Map<string,ReturnType<typeof createActor>>();
  for(const e of enemies.actors)actors.set(e.id+':'+e.kind,createActor(e));
  // Build both final pursuers up front: constructing a rig on the frame the
  // finale begins stalls the main thread. They stay hidden until needed.
  const finale=(['hatred','wrath'] as const).map(kind=>{const e={...enemies.actors[0],id:12,kind},a=createActor(e);a.root.visible=false;actors.set(e.id+':'+kind,a);return a;});
  return {setQuality(quality:Preferences['quality']){surfaces.setQuality(quality);},
    /** Compile the pursuers' programs and upload their buffers before they are first seen. */
    warm(renderer:THREE.WebGLRenderer,camera:THREE.Camera){if(typeof renderer.compile!=='function')return;const saved=finale.map(a=>a.root.position.clone());for(const a of finale){a.root.visible=true;a.root.position.copy(camera.position);}try{renderer.compile(scene,camera);}finally{finale.forEach((a,i)=>{a.root.visible=false;a.root.position.copy(saved[i]);});}},
    setEnabled(value:boolean){enabled=value;for(const a of actors.values())a.root.visible=value;},update(time:number,viewer?:{x:number;z:number},range=125,reveal=false){
    for(const a of actors.values())a.root.visible=false;
    for(const e of enemies.actors){const key=e.id+':'+e.kind;let a=actors.get(key);if(!a){a=createActor(e);actors.set(key,a);}
      // Sample culled actors too: re-entering view must not replay their entire hidden travel.
      a.animate(e,time);a.root.visible=enabled&&(!viewer||Math.hypot(e.position.x-viewer.x,e.position.z-viewer.z)<range);a.echoGroup.visible=reveal;if(!a.root.visible)continue;
      a.root.position.set(e.position.x,e.floor,e.position.z);a.root.rotation.y=e.facing;
      // A sleeper only breathes; an omen-bound pursuer resolves out of nothing over its last 1.5 s.
      a.root.rotation.z=e.dormant?Math.sin(time*.0006+e.id)*.004:0;const wake=e.wakeIn??0;a.root.scale.setScalar(wake>1.5?.02:1-(wake/1.5)*.98);a.sync();
    }
  },dispose(){surfaces.dispose();for(const m of [cloth,paleCloth,tailoredCloth,tailoredPale,sculpt,skin,mask,black,cord,aura])m.dispose();}};
}
