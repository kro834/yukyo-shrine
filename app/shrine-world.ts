import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {createLayout,CELL,SPAWN} from './shrine-layout';
import type {Preferences} from './preferences';
import {Doors,Enemies} from './shrine-gameplay';
import {createDoorMeshes,createEnemyMeshes} from './shrine-actors';
export function createWorld(canvas:HTMLCanvasElement) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#050809');scene.fog=new THREE.FogExp2('#080c0d',.027);
  const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,180);camera.position.set(SPAWN.x,1.68,SPAWN.z);camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight('#91a2af','#30271d',.36));
  const moon=new THREE.DirectionalLight('#8c9aa6',.35);moon.position.set(-10,18,5);scene.add(moon);
  const layout=createLayout(),doors=new Doors(layout.doors),obstacles=[...layout.obstacles,...doors.frames];
  const mats={
    wood:new THREE.MeshStandardMaterial({color:'#685044',roughness:.42,metalness:.07}),
    dark:new THREE.MeshStandardMaterial({color:'#1c1413',roughness:.52}),
    red:new THREE.MeshStandardMaterial({color:'#772c22',roughness:.72}),
    gold:new THREE.MeshStandardMaterial({color:'#b7934c',metalness:.72,roughness:.3}),
    paper:new THREE.MeshStandardMaterial({color:'#999487',emissive:'#908b70',emissiveIntensity:.015,roughness:1}),
    stone:new THREE.MeshStandardMaterial({color:'#404747',roughness:.38,metalness:.15}),
    black:new THREE.MeshStandardMaterial({color:'#0b1011',roughness:.28}),
    light:new THREE.MeshBasicMaterial({color:'#ffc781'}),
    rope:new THREE.MeshStandardMaterial({color:'#b19d78',roughness:1}),
    tatami:new THREE.MeshStandardMaterial({color:'#727253',roughness:.95}),
  };
  type MaterialKey=keyof typeof mats;
  const batches=new Map<MaterialKey,THREE.BufferGeometry[]>();
  const add=(g:THREE.BufferGeometry,m:MaterialKey)=>{if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(g);};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:MaterialKey)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
  const cylinder=(x:number,y:number,z:number,r:number,h:number,m:MaterialKey,r2=r)=>add(new THREE.CylinderGeometry(r,r2,h,12).translate(x,y,z),m);
  const block=(x:number,z:number,w:number,d:number)=>obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  const lanterns:THREE.Vector3[]=[];
  const lantern=(x:number,y:number,z:number,large=false)=>{
    const r=large?.42:.22,h=large?.95:.6;
    cylinder(x,y,z,r,h,'light',r*.85);cylinder(x,y+h/2,z,r*1.13,.09,'dark');cylinder(x,y-h/2,z,r*1.02,.09,'dark');
    for(let j=0;j<8;j++){const a=j*Math.PI/4;box(x+Math.sin(a)*r,y,z+Math.cos(a)*r,.025,h,.025,'red');}
    for(let j=-2;j<=2;j++)cylinder(x,y+j*h/6,z,r+.007,.016,'dark');
    lanterns.push(new THREE.Vector3(x,y,z));
  };
  for(const c of layout.cells){
    const x=c.x*CELL,z=c.z*CELL;
    box(x,-.14,z,4,.28,4,c.kind==='stone'?'stone':'wood');
    box(x,c.h+.12,z,4,.24,4,'dark');
    if(c.kind==='stone'){box(x,.004,z,.022,.008,4,'black');box(x,.004,z,4,.008,.022,'black');}
    else box(x,.006,z,.012,.009,4,'dark');
    box(x,c.h-.12,z,4,.22,.18,'red');
    for(const [dx,dz] of [[1,0],[0,1]]){
      const n=layout.grid.get((c.x+dx)+','+(c.z+dz));
      if(n&&n.h!==c.h){const bottom=Math.min(n.h,c.h),height=Math.abs(c.h-n.h);box(x+dx*2,bottom+height/2,z+dz*2,dx?.28:4,height,dz?.28:4,'dark');}
    }
    if(c.kind==='passage'&&(c.x+c.z)%3===0){lantern(x,c.h-.68,z);box(x,c.h-.12,z,.025,.65,.025,'gold');}
  }
  for(const w of layout.walls){
    box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,'dark');
    const x=w.x+w.insideX*.18,z=w.z+w.insideZ*.18;
    box(x,2.05,z,w.alongX?3.65:.05,2.3,w.alongX?.05:3.65,'paper');
    box(x,.45,z,w.alongX?4:.16,.9,w.alongX?.16:4,'red');
    for(let j=-2;j<=2;j++)box(x+(w.alongX?j*.65:0),2.05,z+(w.alongX?0:j*.65),w.alongX?.045:.1,2.3,w.alongX?.1:.045,'dark');
    for(let j=0;j<4;j++)box(x,1.05+j*.66,z,w.alongX?4:.12,.045,w.alongX?.12:4,'dark');
    for(const offset of [-2,2])box(x+(w.alongX?offset:0),w.h/2,z+(w.alongX?0:offset),.22,w.h,.22,'red');
    box(x,w.h-.22,z,w.alongX?4:.32,.3,w.alongX?.32:4,'red');
    box(x,.92,z,w.alongX?4:.22,.08,w.alongX?.22:4,'gold');
    if(w.twoSided){const bx=w.x-w.insideX*.19,bz=w.z-w.insideZ*.19;box(bx,1.7,bz,w.alongX?3.7:.06,2.8,w.alongX?.06:3.7,'paper');box(bx,.48,bz,w.alongX?4:.15,.9,w.alongX?.15:4,'dark');}
  }
  for(const n of layout.narrows){
    for(const sign of [-1,1]){
      const x=n.x+(n.alongX?0:sign*1.68),z=n.z+(n.alongX?sign*1.68:0);
      box(x,1.75,z,n.alongX?4:.64,3.5,n.alongX?.64:4,'dark');
      box(x-(n.alongX?0:sign*.34),1.65,z-(n.alongX?sign*.34:0),n.alongX?3.8:.04,2.5,n.alongX?.04:3.8,'red');
      for(const offset of [-1.8,0,1.8])box(x+(n.alongX?offset:-sign*.4),1.75,z+(n.alongX?-sign*.4:offset),.09,3.5,.09,'black');
    }
    box(n.x,3.16,n.z,4,.25,4,'dark');
  }
  const gate=(x:number,z:number,width:number,h:number)=>{
    for(const sign of [-1,1]){
      cylinder(x+sign*width/2,h/2,z,.22,h,'red',.26);cylinder(x+sign*width/2,.17,z,.29,.34,'black');
      cylinder(x+sign*width/2,h-.45,z,.245,.1,'gold');block(x+sign*width/2,z,.6,.6);
    }
    box(x,h,z,width+1.4,.28,.45,'red');box(x,h+.18,z,width+1.6,.12,.56,'black');box(x,h-.65,z,width+.6,.17,.28,'red');
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x-width/2,h-.45,z+.17),new THREE.Vector3(x,h-1,z+.17),new THREE.Vector3(x+width/2,h-.45,z+.17)]);
    add(new THREE.TubeGeometry(curve,24,.055,6,false),'rope');
    for(const offset of [-.7,0,.7]){
      const g=new THREE.BoxGeometry(.16,.25,.015);g.rotateZ(.35);g.translate(x+offset,h-1.13,z+.17);add(g,'paper');
      const g2=new THREE.BoxGeometry(.16,.22,.015);g2.rotateZ(-.35);g2.translate(x+offset+.025,h-1.31,z+.17);add(g2,'paper');
    }
  };
  for(const z of [10,-2,-14])gate(0,z,8,5.3);
  for(const z of [-25,-53,-73])gate(0,z,2.8,3.25);
  for(const side of [-1,1])for(const z of [10,-2,-14]){
    cylinder(side*8,3.35,z,.3,6.7,'red');cylinder(side*8,.18,z,.44,.36,'black');block(side*8,z,.9,.9);
    lantern(side*6.8,3.3,z,true);box(side*6.8,5.1,z,.04,2.8,.04,'gold');
  }
  const altar=(x:number,z:number,scale=1)=>{
    box(x,.2,z,4*scale,.4,1.8,'black');box(x,.7,z,3.3*scale,1,1.2,'red');box(x,1.28,z,4*scale,.14,1.5,'gold');
    box(x,1.42,z,3.9*scale,.1,1.45,'black');block(x,z,4*scale,1.8);
    const disk=new THREE.CylinderGeometry(.75*scale,.75*scale,.09,48);disk.rotateX(Math.PI/2);disk.translate(x,2.65,z-.15);add(disk,'gold');
    const ring=new THREE.TorusGeometry(.82*scale,.055,8,48);ring.translate(x,2.65,z-.1);add(ring,'gold');
    for(const side of [-1,1]){cylinder(x+side*1.3*scale,1.8,z,.07,.65,'gold');cylinder(x+side*1.3*scale,2.16,z,.06,.12,'light');lantern(x+side*3*scale,2.5,z,true);cylinder(x+side*3*scale,1,z,.09,2,'dark');}
  };
  altar(0,-44,1.5);gate(0,-39,6.2,5.5);
  altar(-44,-72,.8);altar(44,-72,.8);altar(52,-30,.8);altar(-6,31,.8);
  box(0,.18,-92,5,.36,7,'black');block(0,-92,5,7);
  for(const sign of [-1,1]){box(sign*2.5,.35,-92,.22,.3,7.2,'stone');box(0,.35,-92+sign*3.5,5.2,.3,.22,'stone');}
  const water=new THREE.Mesh(new THREE.PlaneGeometry(4.85,6.85),new THREE.MeshPhysicalMaterial({color:'#17332f',metalness:.75,roughness:.13,clearcoat:1}));water.rotation.x=-Math.PI/2;water.position.set(0,.37,-92);scene.add(water);
  altar(0,-100,1.1);
  for(const [x,z] of [[-52,-40],[-44,-72],[44,-72],[52,-28],[0,-88],[0,-100],[-6,30]]){
    for(const side of [-1,1]){lantern(x+side*3,2.2,z,true);cylinder(x+side*3,.8,z,.14,1.6,'stone');}
  }
  // Tatami chamber with low lacquer table.
  for(let x=28;x<=36;x+=2)for(let z=4;z<=12;z+=4){box(x,.025,z,1.94,.05,3.94,'tatami');box(x-.96,.058,z,.05,.01,3.95,'black');}
  box(32,.45,8,2,.14,1.3,'dark');block(32,8,2,1.3);
  for(const x of [31.2,32.8])for(const z of [7.6,8.4])box(x,.2,z,.08,.4,.08,'dark');
  lantern(32,2.6,8,true);
  // Ritual storehouse: heavy shelves and unmarked ceramic vessels.
  for(const x of [-31,-29]){
    for(const z of [-30,-25]){box(x,1.4,z,.16,2.8,.16,'dark');}
    for(const y of [.2,1.2,2.2])box(x,y,-27.5,1.15,.12,5.2,'wood');
    block(x,-27.5,1.2,5.4);
    for(const y of [.58,1.58,2.58])for(const z of [-29,-27,-26])cylinder(x,y,z,.23,.6,'stone',.3);
  }lantern(-30,2.9,-23,true);
  // Bell room, suspended bronze bell and crossbeam.
  box(-34,4.4,-88,6,.4,.5,'dark');
  cylinder(-34,3.1,-88,1.1,1.8,'gold',1.3);cylinder(-34,4.1,-88,.5,.3,'gold');cylinder(-34,4.25,-88,.1,.3,'dark');
  box(-34,1.0,-88,3.2,2,2.8,'black');block(-34,-88,3.2,2.8);lantern(-36,2.6,-85,true);lantern(-32,2.6,-85,true);
  // Lantern chamber: staggered rows, entirely above walking height.
  for(const x of [42,44,46])for(const z of [-68,-71,-74]){lantern(x,3.4,z,true);box(x,4.8,z,.025,2,.025,'gold');}
  // Furnishings are kept off the two-door circulation axis through each room.
  for(const room of layout.rooms){
    const cx=(room.x1+room.x2)*2,cz=(room.z1+room.z2)*2;
    lantern(cx,room.h-.7,cz,true);box(cx,room.h-.2,cz,.03,.8,.03,'dark');
    if(room.style==='tatami'){
      for(let x=room.x1*4-1;x<=room.x2*4+1;x+=2)for(let z=room.z1*4;z<=room.z2*4;z+=4){box(x,.025,z,1.96,.05,3.96,'tatami');box(x-.96,.055,z,.035,.01,3.95,'dark');}
      for(const dz of [-5,5]){box(cx,.37,cz+dz,3.2,.13,1.8,'black');block(cx,cz+dz,3.2,1.8);for(const sx of [-1.3,1.3])for(const sz of [-.6,.6])box(cx+sx,.17,cz+dz+sz,.09,.34,.09,'dark');}
      for(const dz of [-7,7])for(const dx of [-2,0,2])box(cx+dx,.1,cz+dz,.9,.15,.85,'red');
    }else if(room.style==='store'){
      for(const dz of [-6,6]){
        for(const dx of [-6,-2,2,6]){box(cx+dx,1.35,cz+dz,.14,2.7,.14,'dark');}
        for(const y of [.3,1.25,2.2]){box(cx,y,cz+dz,12,.1,1.2,'wood');for(const dx of [-5,-3,-1,1,3,5])cylinder(cx+dx,y+.3,cz+dz,.21,.48,'stone',.28);}
        block(cx,cz+dz,12,1.3);
      }
    }else if(room.style==='ritual'){
      altar(cx,cz-6,1.05);gate(cx,cz-3,5.4,room.h-.3);
      for(const dx of [-6,6]){lantern(cx+dx,2.3,cz+5,true);cylinder(cx+dx,.9,cz+5,.18,1.8,'stone');block(cx+dx,cz+5,.5,.5);}
    }else{
      for(const dz of [-5,5]){box(cx,.3,cz+dz,5,.6,2.5,'stone');box(cx,.62,cz+dz,4.6,.05,2.1,'black');block(cx,cz+dz,5,2.5);}
      for(const dx of [-6,6])for(const dz of [-6,6]){lantern(cx+dx,2.1,cz+dz,true);cylinder(cx+dx,.7,cz+dz,.18,1.4,'stone');}
    }
  }
  for(const [m,geometries] of batches){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mats[m]);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}geometries.forEach(g=>g.dispose());}
  const enemies=new Enemies(layout.cells,obstacles),doorMeshes=createDoorMeshes(scene,doors),enemyMeshes=createEnemyMeshes(scene,enemies);
  let collision=[...obstacles,...doors.blockers()];
  const mirror=new Reflector(new THREE.PlaneGeometry(4.7,6.7),{textureWidth:512,textureHeight:512,color:0x293d38});mirror.rotation.x=-Math.PI/2;mirror.position.set(0,.38,-92);scene.add(mirror);water.visible=false;
  const dustGeometry=new THREE.BufferGeometry(),dust=new Float32Array(900*3);
  for(let i=0;i<900;i++){const c=layout.cells[(i*137)%layout.cells.length];dust[i*3]=c.x*4+Math.sin(i*2.13)*1.7;dust[i*3+1]=.4+(i%37)/37*2.7;dust[i*3+2]=c.z*4+Math.cos(i*3.17)*1.7;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));const dustMaterial=new THREE.PointsMaterial({color:'#a6a090',size:.024,transparent:true,opacity:.12,depthWrite:false});scene.add(new THREE.Points(dustGeometry,dustMaterial));
  const lightPool=Array.from({length:6},()=>{const p=new THREE.PointLight('#ff9b49',23,14,2);scene.add(p);return p;});
  const flashlight=new THREE.SpotLight('#e6efff',50,32,.48,.6,1.5);flashlight.position.copy(camera.position);scene.add(flashlight,flashlight.target);
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;flashlight.castShadow=true;flashlight.shadow.mapSize.set(1024,1024);flashlight.shadow.bias=-.00015;flashlight.shadow.normalBias=.03;flashlight.shadow.camera.near=.1;flashlight.shadow.camera.far=32;
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;const ctx=glowCanvas.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,178,78,.36)');grad.addColorStop(.3,'rgba(255,112,31,.10)');grad.addColorStop(1,'rgba(255,100,20,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const glowTex=new THREE.CanvasTexture(glowCanvas),glowMat=new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  lanterns.forEach(p=>{const s=new THREE.Sprite(glowMat);s.position.copy(p);s.scale.set(2.5,2.5,1);scene.add(s);});
  let lastLight=0,disposed=false;const direction=new THREE.Vector3();
  new THREE.TextureLoader().load('/cedar.png',texture=>{if(disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mats.wood.map=texture;mats.wood.color.set('#b7a596');mats.wood.needsUpdate=true;mats.red.map=texture;mats.red.needsUpdate=true;});
  return {renderer,scene,camera,get obstacles(){return collision;},flashlight,
    nearDoor(){return !!doors.nearest(camera.position,camera.rotation.y,obstacles);},
    interact(){return doors.interact(camera.position,camera.rotation.y,obstacles);},
    burst(){return enemies.burst(camera.position,collision);},
    step(dt:number){doors.update(dt,camera.position);collision=[...obstacles,...doors.blockers()];doorMeshes.update();if(enemies.update(dt,camera.position,collision)){camera.position.set(SPAWN.x,1.68,SPAWN.z);enemies.reset();return true;}return false;},
    configure(p:Preferences){
      renderer.setPixelRatio(Math.min(devicePixelRatio,p.quality==='low'?1:p.quality==='high'?2:1.5));renderer.setSize(innerWidth,innerHeight);
      renderer.toneMappingExposure=p.brightness;
      renderer.shadowMap.enabled=p.quality!=='low';
      const size=p.quality==='high'?2048:1024;
      if(flashlight.shadow.mapSize.x!==size){flashlight.shadow.map?.dispose();flashlight.shadow.map=null;flashlight.shadow.mapSize.set(size,size);}
      flashlight.castShadow=p.quality!=='low';camera.fov=p.fov;camera.updateProjectionMatrix();
      mirror.visible=p.quality!=='low';water.visible=p.quality==='low';mirror.getRenderTarget().setSize(p.quality==='high'?768:384,p.quality==='high'?768:384);
    },
    render(time:number){
      if(time-lastLight>220){const nearby=lanterns.map(p=>({p,d:p.distanceToSquared(camera.position)})).sort((a,b)=>a.d-b.d);lightPool.forEach((light,i)=>light.position.copy(nearby[i].p));lastLight=time;}
      flashlight.position.copy(camera.position);flashlight.position.y-=.12;camera.getWorldDirection(direction);flashlight.target.position.copy(camera.position).addScaledVector(direction,10);
      lightPool.forEach((l,i)=>l.intensity=23*(1+.025*Math.sin(time*.0021+i*2.3)));
      enemyMeshes.update(time);
      renderer.render(scene,camera);
    },
    resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();},
    dispose(){disposed=true;scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(mats).forEach(m=>{if('map'in m)m.map?.dispose();m.dispose();});doorMeshes.dispose();enemyMeshes.dispose();mirror.dispose();dustGeometry.dispose();dustMaterial.dispose();water.material.dispose();glowMat.dispose();glowTex.dispose();renderer.dispose();},
  };
}
