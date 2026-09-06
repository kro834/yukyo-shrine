import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createEffects,renderEnemyEcho} from './shrine-effects.ts';
import {createLayout,CELL,SPAWN} from './shrine-layout.ts';
import type {Preferences} from './preferences';
import {Doors,Enemies,openPursuedDoor} from './shrine-gameplay.ts';
import {createDoorMeshes,createEnemyMeshes} from './shrine-actors.ts';
import {enemyDirection} from './enemy-direction.ts';
import {movePlayer} from './movement.ts';
import {UPPER_HEIGHT,STAIRS,upperDoors,upperPartitions,upperBarriers,stairRails,floorHeightAt} from './annex.ts';
import {RunningSteps,createFootstepAudio} from './footsteps.ts';
import {placeMagatama,placeRedMagatama,collectMagatama,beadInventory,spendBeads} from './magatama.ts';
import {createMagatamaMeshes} from './magatama-mesh.ts';
import {ShrineGoal,ALTAR,GOAL_WALLS} from './shrine-goal.ts';
import {seededRandom} from './seeded-random.ts';
import {createAreaLookup} from './area-rules.ts';
import {createGoalMeshes} from './goal-mesh.ts';
import {BurstRecharge} from './burst-recharge.ts';
import {PerformanceBudget} from './performance-budget.ts';
import {TimeStop} from './time-stop.ts';
import {STAIR_LIGHT_VOLUMES} from './stair-light.ts';
export function createWorld(canvas:HTMLCanvasElement,rendererOverride?:THREE.WebGLRenderer,seed=Math.floor(Math.random()*0xffffffff)) {
  const device=typeof navigator!=='undefined'?navigator as Navigator&{deviceMemory?:number}:undefined;
  const budget=new PerformanceBudget({touch:(device?.maxTouchPoints??0)>1||/Android|iPhone|iPad/i.test(device?.userAgent??''),cores:device?.hardwareConcurrency,memory:device?.deviceMemory});
  const renderer=rendererOverride??new THREE.WebGLRenderer({canvas,antialias:!budget.mobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(budget.pixelRatio('medium',innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#050809');scene.fog=new THREE.FogExp2('#080c0d',.027);
  const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,180);camera.position.set(SPAWN.x,1.68,SPAWN.z);camera.rotation.order='YXZ';
  let environment:THREE.WebGLRenderTarget|undefined;
  if(!rendererOverride){const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.065;room.dispose();pmrem.dispose();}
  scene.add(new THREE.HemisphereLight('#91a2af','#30271d',.18));
  const moon=new THREE.DirectionalLight('#8c9aa6',.18);moon.position.set(-10,18,5);scene.add(moon);
  const layout=createLayout(seed),areaAt=createAreaLookup(layout.cells),doors=new Doors([...layout.doors,...upperDoors]),obstacles=[...layout.obstacles,...doors.frames,...stairRails];
  const runningSteps=new RunningSteps(),footsteps=createFootstepAudio();let lastMotion={running:false,moving:false};
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
    concrete:new THREE.MeshStandardMaterial({color:'#454946',roughness:.94}),
    rust:new THREE.MeshStandardMaterial({color:'#713d27',roughness:.85,metalness:.4}),
    steel:new THREE.MeshStandardMaterial({color:'#29393c',roughness:.56,metalness:.8}),
    tile:new THREE.MeshStandardMaterial({color:'#829791',roughness:.27,metalness:.12}),
    water:new THREE.MeshStandardMaterial({color:'#0b3034',roughness:.13,metalness:.75}),
    coolLight:new THREE.MeshBasicMaterial({color:'#a3e7f1'}),
    candyRed:new THREE.MeshStandardMaterial({color:'#b83b38',roughness:.42}),
    candyYellow:new THREE.MeshStandardMaterial({color:'#d8af49',roughness:.48}),
    candyBlue:new THREE.MeshStandardMaterial({color:'#438eac',roughness:.38}),
    candyPink:new THREE.MeshStandardMaterial({color:'#b86a8c',roughness:.45}),
    glass:new THREE.MeshPhysicalMaterial({color:'#80a99e',roughness:.12,metalness:.3,transparent:true,opacity:.65}),
    rock:new THREE.MeshStandardMaterial({color:'#525b59',roughness:.91}),
    earth:new THREE.MeshStandardMaterial({color:'#443d2b',roughness:1}),
    grass:new THREE.MeshStandardMaterial({color:'#46583b',roughness:1,side:THREE.DoubleSide}),
  };
  // World-space grain and corrosion keep large surfaces from reading as flat colour.
  for(const material of [mats.concrete,mats.rust,mats.steel]){
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 weatherPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nweatherPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 weatherPosition;\nfloat weatherNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=dot(i,vec3(127.1,311.7,74.7));return mix(mix(mix(fract(sin(a)*43758.54),fract(sin(a+127.1)*43758.54),f.x),mix(fract(sin(a+311.7)*43758.54),fract(sin(a+438.8)*43758.54),f.x),f.y),mix(mix(fract(sin(a+74.7)*43758.54),fract(sin(a+201.8)*43758.54),f.x),mix(fract(sin(a+386.4)*43758.54),fract(sin(a+513.5)*43758.54),f.x),f.y),f.z);}\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wear=weatherNoise(weatherPosition*2.3)*.65+weatherNoise(weatherPosition*16.0)*.35;diffuseColor.rgb*=.65+.45*wear;');
    };
    material.customProgramCacheKey=()=> 'weathered-surface-v1';
  }
  type MaterialKey=keyof typeof mats;
  const batches=new Map<string,{material:MaterialKey;geometries:THREE.BufferGeometry[]}>();
  const add=(g:THREE.BufferGeometry,m:MaterialKey)=>{
    // World-scale UVs avoid stretched grain on walls, beams and long pipes.
    if(['wood','red','concrete','rust','steel','stone','rock','earth'].includes(m)){
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),scale=m==='wood'||m==='red'?.38:.3;
      for(let i=0;i<p.count;i++){
        const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
        uv.setXY(i,(ax>ay&&ax>az?p.getZ(i):p.getX(i))*scale,(ay>ax&&ay>az?p.getZ(i):p.getY(i))*scale);
      }
    }
    g.computeBoundingBox();const center=g.boundingBox!.getCenter(new THREE.Vector3());
    const key=m+':'+Math.floor(center.x/24)+':'+Math.floor(center.z/24);
    if(!batches.has(key))batches.set(key,{material:m,geometries:[]});batches.get(key)!.geometries.push(g);
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:MaterialKey)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
  const cylinder=(x:number,y:number,z:number,r:number,h:number,m:MaterialKey,r2=r)=>add(new THREE.CylinderGeometry(r,r2,h,12).translate(x,y,z),m);
  const block=(x:number,z:number,w:number,d:number,maxY=3.4)=>obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,maxY});
  const natureRandom=seededRandom(seed^0x72851);
  const rock=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const g=new THREE.BoxGeometry(w,h,d,3,3,3),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),noise=Math.sin((px+x)*3.17+(py+y)*4.11+(pz+z)*2.37)*.11;p.setXYZ(i,px+noise,py+noise,pz+noise);}
    g.computeVertexNormals();g.translate(x,y,z);add(g,'rock');
  };
  const lanterns:THREE.Vector3[]=[];
  const fixtureColors=new Map<THREE.Vector3,string>();
  const fixture=(x:number,y:number,z:number,color:string)=>{const p=new THREE.Vector3(x,y,z);lanterns.push(p);fixtureColors.set(p,color);};
  const lantern=(x:number,y:number,z:number,large=false)=>{
    const r=large?.42:.22,h=large?.95:.6;
    cylinder(x,y,z,r,h,'light',r*.85);cylinder(x,y+h/2,z,r*1.13,.09,'dark');cylinder(x,y-h/2,z,r*1.02,.09,'dark');
    for(let j=0;j<8;j++){const a=j*Math.PI/4;box(x+Math.sin(a)*r,y,z+Math.cos(a)*r,.025,h,.025,'red');}
    for(let j=-2;j<=2;j++)cylinder(x,y+j*h/6,z,r+.007,.016,'dark');
    lanterns.push(new THREE.Vector3(x,y,z));
  };
  for(const c of layout.cells){
    const x=c.x*CELL,z=c.z*CELL;
    if(c.kind==='cave'){
      box(x,-.17,z,4,.34,4,'rock');rock(x,c.h+.45,z,4.18,.9,4.18);
      for(const [dx,dz] of [[1,0],[0,1]]){const n=layout.grid.get((c.x+dx)+','+(c.z+dz));if(n&&n.h!==c.h&&n.kind==='cave'){const h=Math.abs(n.h-c.h);rock(x+dx*2,Math.min(n.h,c.h)+h/2,z+dz*2,dx?.45:4.1,h,dz?.45:4.1);}}
      if((c.x*7+c.z*3)%11===0){const g=new THREE.ConeGeometry(.22,1.1,7);g.rotateX(Math.PI);g.translate(x+.7,c.h-.4,z+.7);add(g,'rock');}
      if((c.x-c.z)%8===0){box(x,.025,z,.7,.04,.7,'water');fixture(x,1.5,z,'#809baa');lantern(x,2.6,z);}
      continue;
    }
    if(c.kind==='field'){
      box(x,-.19,z,4,.38,4,'earth');
      if((c.x+c.z)%9===0){cylinder(x+1.5,.8,z+1.5,.07,1.6,'wood');lantern(x+1.5,1.8,z+1.5);}
      continue;
    }
    if(c.kind==='shop'){
      box(x,-.14,z,4,.28,4,'wood');box(x,c.h+.1,z,4,.2,4,'dark');box(x,.008,z,.025,.016,4,'dark');box(x,c.h-.12,z,4,.18,.15,'wood');
      if((c.x+c.z)%4===0){lantern(x,3.4,z);box(x,4,z,.03,1,.03,'dark');}
      continue;
    }
    if(c.kind==='factory'||c.kind==='bath'||c.kind==='cistern'){
      const factory=c.kind==='factory',bath=c.kind==='bath';
      box(x,-.14,z,4,.28,4,bath?'tile':'concrete');box(x,c.h+.12,z,4,.24,4,'concrete');
      box(x,c.h-.15,z,4,.3,.24,factory?'steel':'concrete');
      if(bath){for(let j=-2;j<2;j++){box(x+j,.008,z,.015,.016,4,'dark');box(x,.008,z+j,4,.016,.015,'dark');}}
      else {box(x,.005,z,4,.012,.035,'black');box(x,.005,z,.035,.012,4,'black');}
      if((c.x+c.z)%4===0){
        box(x,c.h-.36,z,1.7,.13,.32,'steel');box(x,c.h-.44,z,1.45,.04,.17,'coolLight');
        fixture(x,c.h-.5,z,bath?'#97d6c7':factory?'#9dd4e7':'#73bfc6');
      }
      if(factory||!bath){
        const ew=layout.grid.has((c.x+1)+','+c.z)||layout.grid.has((c.x-1)+','+c.z);
        const pipe=new THREE.CylinderGeometry(.09,.09,4,8);pipe.rotateZ(ew?Math.PI/2:0);if(!ew)pipe.rotateX(Math.PI/2);
        pipe.translate(x,c.h-.6,z+.7);add(pipe,factory?'rust':'steel');
      }
      continue;
    }
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
    if(w.kind==='cave'){
      rock(w.x-w.insideX*.75,w.h/2,w.z-w.insideZ*.75,w.alongX?4.2:1.5,w.h,w.alongX?1.5:4.2);continue;
    }
    if(w.kind==='field'){
      if(w.h<1){box(w.x,.2,w.z,w.alongX?4:.36,.4,w.alongX?.36:4,'earth');}
      else {rock(w.x-w.insideX*2.2,w.h/2,w.z-w.insideZ*2.2,w.alongX?4.6:4.5,w.h+1.5,w.alongX?4.5:4.6);}
      continue;
    }
    if(w.kind==='shop'){
      box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,'wood');
      const x=w.x+w.insideX*.19,z=w.z+w.insideZ*.19;
      box(x,1.8,z,w.alongX?3.6:.07,2.4,w.alongX?.07:3.6,'paper');
      for(const y of [.6,1.8,3])box(x,y,z,w.alongX?4:.15,.1,w.alongX?.15:4,'dark');
      for(const side of [-1,1])box(x+(w.alongX?side*1.8:0),2,z+(w.alongX?0:side*1.8),.12,4,.12,'dark');continue;
    }
    if(w.kind==='factory'||w.kind==='bath'||w.kind==='cistern'){
      const bath=w.kind==='bath',factory=w.kind==='factory',x=w.x+w.insideX*.19,z=w.z+w.insideZ*.19;
      box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,bath?'tile':'concrete');
      box(x,.55,z,w.alongX?4:.05,1.1,w.alongX?.05:4,bath?'water':factory?'rust':'steel');
      for(const side of [-1,1])box(x+(w.alongX?side*1.9:0),w.h/2,z+(w.alongX?0:side*1.9),.16,w.h,.16,factory?'steel':'concrete');
      if(bath)for(let j=1;j*.45<w.h;j++)box(x,j*.45,z,w.alongX?4:.035,.013,w.alongX?.035:4,'steel');
      if(factory){
        box(x,2.4,z,w.alongX?2.7:.08,1.2,w.alongX?.08:2.7,'steel');
        for(let j=-3;j<=3;j++)box(x+(w.alongX?j*.35:0),2.4,z+(w.alongX?0:j*.35),w.alongX?.12:.1,1.1,w.alongX?.1:.12,'black');
      }
      continue;
    }
    box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,'dark');
    const x=w.x+w.insideX*.18,z=w.z+w.insideZ*.18;
    box(x,2.05,z,w.alongX?3.65:.05,2.3,w.alongX?.05:3.65,'wood');
    box(x,.45,z,w.alongX?4:.16,.9,w.alongX?.16:4,'red');
    for(let j=-2;j<=2;j++)box(x+(w.alongX?j*.65:0),2.05,z+(w.alongX?0:j*.65),w.alongX?.045:.1,2.3,w.alongX?.1:.045,'dark');
    for(let j=0;j<4;j++)box(x,1.05+j*.66,z,w.alongX?4:.12,.045,w.alongX?.12:4,'dark');
    for(const offset of [-2,2])box(x+(w.alongX?offset:0),w.h/2,z+(w.alongX?0:offset),.22,w.h,.22,'red');
    box(x,w.h-.22,z,w.alongX?4:.32,.3,w.alongX?.32:4,'red');
    box(x,.92,z,w.alongX?4:.22,.08,w.alongX?.22:4,'gold');
    if(w.twoSided){const bx=w.x-w.insideX*.19,bz=w.z-w.insideZ*.19;box(bx,1.7,bz,w.alongX?3.7:.06,2.8,w.alongX?.06:3.7,'wood');box(bx,.48,bz,w.alongX?4:.15,.9,w.alongX?.15:4,'dark');}
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
  box(32,.45,8,2,.14,1.3,'dark');block(32,8,2,1.3,.52);
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
  box(-34,1.0,-88,3.0,2,2.8,'black');block(-34,-88,3.0,2.8);lantern(-36,2.6,-85,true);lantern(-32,2.6,-85,true);
  // Lantern chamber: staggered rows, entirely above walking height.
  for(const x of [42,44,46])for(const z of [-68,-71,-74]){lantern(x,3.4,z,true);box(x,4.8,z,.025,2,.025,'gold');}
  // Furnishings are kept off the two-door circulation axis through each room.
  for(const room of layout.rooms){
    const cx=(room.x1+room.x2)*2,cz=(room.z1+room.z2)*2;
    lantern(cx,room.h-.7,cz,true);box(cx,room.h-.2,cz,.03,.8,.03,'dark');
    if(room.style==='tatami'){
      for(let x=room.x1*4-1;x<=room.x2*4+1;x+=2)for(let z=room.z1*4;z<=room.z2*4;z+=4){box(x,.025,z,1.96,.05,3.96,'tatami');box(x-.96,.055,z,.035,.01,3.95,'dark');}
      const offset=Math.min(5,(room.z2-room.z1+1)*2-3),cushion=Math.min(7,(room.z2-room.z1+1)*2-1.5);
      for(const dz of [-offset,offset]){box(cx,.37,cz+dz,3.2,.13,1.8,'black');block(cx,cz+dz,3.2,1.8,.45);for(const sx of [-1.3,1.3])for(const sz of [-.6,.6])box(cx+sx,.17,cz+dz+sz,.09,.34,.09,'dark');}
      for(const dz of [-cushion,cushion])for(const dx of [-2,0,2])box(cx+dx,.1,cz+dz,.9,.15,.85,'red');
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
  // Colonnaded cloisters, high lantern canopies and stone inlays distinguish each court.
  for(const court of layout.courts){
    const cx=court.x*4,cz=court.z*4;
    for(const side of [-1,1]){
      for(let z=cz-court.rz*4+2;z<=cz+court.rz*4-2;z+=8){
        const x=cx+side*(court.rx*4-1.7);
        cylinder(x,court.h/2,z,.25,court.h,'red');cylinder(x,.15,z,.36,.3,'stone');block(x,z,.75,.75);
        lantern(x-side*.8,3.4,z,true);
      }
      box(cx+side*7,.02,cz,.12,.02,(court.rz*2+1)*4,'gold');
      box(cx,.02,cz+side*7,(court.rx*2+1)*4,.02,.12,'gold');
      gate(cx,cz+side*(court.rz*4-1),5.8,4.8);
    }
    for(const side of [-1,1])for(let j=-1;j<=1;j++)lantern(cx+side*9,court.h-1.3,cz+j*5,true);
  }
  // Industrial machinery flanks the through-routes, leaving the central floor clear.
  for(const x of [120,168])for(const z of [-112,-120,-144,-152]){
    box(x,.18,z,3.2,.36,2.5,'steel');block(x,z,3.2,2.5);
    cylinder(x,1.4,z,1.0,2.5,'rust');cylinder(x,2.72,z,1.06,.13,'steel');
    box(x+.86,1.5,z+.83,.5,.8,.3,'steel');
    const wheel=new THREE.TorusGeometry(.3,.045,8,18);wheel.translate(x+.86,1.6,z+1.02);add(wheel,'rust');
    cylinder(x,3.3,z,.12,1.05,'steel');
  }
  for(const x of [120,132,144,156,168]){
    box(x,5.65,-116,.2,.3,20,'steel');box(x,5.4,-116,.08,.08,20,'rust');
  }
  // Silent pump galleries and low, still water basins.
  for(const x of [-168,-120])for(const z of [-112,-120,-144,-152]){
    box(x,.5,z,3.2,1,2.3,'concrete');box(x,1.015,z,2.9,.025,2,'water');block(x,z,3.2,2.3,1.05);
    cylinder(x+1.4,1.75,z,.16,2.3,'steel');
  }
  // Long washing bays in the abandoned bathhouse, with tarnished mirrors and taps.
  box(0,.7,-236,19.8,.06,19.8,'water');box(0,6.92,-236,20,.24,20,'concrete');
  for(const side of [-1,1])for(const z of [-224,-232,-240,-248]){
    const x=side*77;
    box(x,.45,z,1,.9,2.6,'tile');block(x,z,1,2.6,.95);
    box(x-side*.48,1.65,z,.06,1.2,1.6,'steel');
    cylinder(x-side*.6,.85,z,.04,.3,'rust');
    box(x-side*1.2,.18,z,.6,.36,.7,'wood');block(x-side*1.2,z,.6,.7,.4);
  }
  // A real upper deck, two open stairwells and adjoining upstairs guest rooms.
  // Unlettered nostalgic sweet-shop stalls, glass jars and colourful packet racks.
  const candy:MaterialKey[]=['candyRed','candyYellow','candyBlue','candyPink'];
  for(const x of [-92,-84,-76,-68,-60,-52])for(const z of [8,24]){
    box(x,.6,z,5.4,1.2,1.15,'dark');box(x,1.24,z,5.7,.12,1.35,'wood');block(x,z,5.7,1.35);
    for(let j=0;j<8;j++){
      const px=x-2.35+j*.67;box(px,1.45,z,.43,.3,.55,candy[(j+Math.abs(x))%4]);
      cylinder(px,1.9,z-.38,.16,.55,'glass');cylinder(px,2.19,z-.38,.17,.06,'gold');
      for(const y of [2.5,2.95])box(px,y,z-.55,.32,.32,.07,candy[(j+Math.floor(y))%4]);
    }
    for(const side of [-1,1])box(x+side*2.8,1.65,z-.65,.08,3.3,.08,'dark');
    box(x,3.2,z-.65,5.7,.12,.16,'wood');
    for(let j=0;j<10;j++)box(x-2.55+j*.57,3.05,z,.56,.16,1.5,j%2?'paper':'candyRed');
  }
  for(const z of [5,21]){box(-80.5,.95,z,1.2,1.9,2.1,'candyBlue');box(-79.86,1.2,z,.04,1.15,1.7,'glass');block(-80.5,z,1.2,2.1);}
  // A covered market lane, back-room screens and a shallow display courtyard.
  for(const x of [-92,-76,-60]){box(x,3.8,16,6,.14,3.6,'wood');for(const side of [-1,1])box(x+side*3,2,17.7,.1,3.8,.1,'dark');lantern(x,3.4,16,true);}
  for(const z of [0,32])for(let x=-92;x<=-52;x+=8){box(x,1.6,z,5.8,3.2,.18,'wood');block(x,z,5.8,.18,3.2);}
  // Paddy pools are islands in the walk graph; planted rows are batched with
  // the terrain, so thousands of blades never become thousands of draw calls.
  for(const p of layout.paddies){
    const x=(p.x1+p.x2)*2,z=(p.z1+p.z2)*2,w=(p.x2-p.x1+1)*4,d=(p.z2-p.z1+1)*4;
    box(x,-.07,z,w,.08,d,'water');
    for(let px=p.x1*4-1;px<=p.x2*4+1;px+=1.15)for(let pz=p.z1*4-1;pz<=p.z2*4+1;pz+=1.65){
      const h=.45+natureRandom()*.35;
      for(const angle of [0,Math.PI/2]){const g=new THREE.PlaneGeometry(.10,h);const a=g.getAttribute('position');a.setX(0,a.getX(0)*.15);a.setX(1,a.getX(1)*.15);g.rotateY(angle+natureRandom()*.25);g.translate(px+natureRandom()*.25,h/2-.02,pz+natureRandom()*.2);add(g,'grass');}
    }
  }
  for(let x=12;x<=23;x++)for(let z=0;z<=8;z++){
    if((x===13||x===22)&&z>=2&&z<=6)continue;
    box(x*4,UPPER_HEIGHT-.12,z*4,4,.24,4,'wood');
    if((x+z)%4===0)lantern(x*4,7.8,z*4);
  }
  for(const s of STAIRS){
    for(let i=0;i<24;i++){
      const depth=(s.maxZ-s.minZ)/24,height=(i+1)*UPPER_HEIGHT/24,z=s.minZ+(i+.5)*depth;
      box((s.minX+s.maxX)/2,height/2,z,s.maxX-s.minX,height,depth,'wood');
      box((s.minX+s.maxX)/2,height+.007,z-depth/2+.025,s.maxX-s.minX,.025,.05,'gold');
    }
    for(const x of [s.minX,s.maxX]){
      for(let i=0;i<=10;i++){const z=s.minZ+i*2,y=i*UPPER_HEIGHT/10;box(x,y+.55,z,.1,1.1,.1,'red');}
      const curve=new THREE.LineCurve3(new THREE.Vector3(x,1.1,s.minZ),new THREE.Vector3(x,UPPER_HEIGHT+1.1,s.maxZ));
      add(new THREE.TubeGeometry(curve,1,.065,6,false),'gold');
    }
    box((s.minX+s.maxX)/2,UPPER_HEIGHT+.55,s.minZ,s.maxX-s.minX,1.1,.14,'dark');
  }
  for(const wall of upperPartitions){
    const x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2,w=wall.maxX-wall.minX,d=wall.maxZ-wall.minZ;
    box(x,UPPER_HEIGHT+1.8,z,w,3.6,d,'paper');box(x,UPPER_HEIGHT+.4,z,w+.03,.8,d+.03,'dark');
    box(x,UPPER_HEIGHT+3.45,z,w+.04,.18,d+.04,'red');
  }
  for(const barrier of upperBarriers){const x=(barrier.minX+barrier.maxX)/2,z=(barrier.minZ+barrier.maxZ)/2;box(x,UPPER_HEIGHT+.55,z,barrier.maxX-barrier.minX,1.1,barrier.maxZ-barrier.minZ,'dark');}
  for(const x of [64,76]){for(let dx=-4;dx<=4;dx+=2)for(const z of [4,8,12])box(x+dx,UPPER_HEIGHT+.018,z,1.95,.036,3.95,'tatami');lantern(x,7.5,8,true);}
  // Material thresholds and overhead lintels mark changes of wing without signs
  // or new obstructions in the walkable route.
  for(const c of layout.cells)for(const [dx,dz] of [[1,0],[0,1]]){
    const n=layout.grid.get((c.x+dx)+','+(c.z+dz));
    if(!n||n.kind===c.kind||c.kind==='field'||n.kind==='field'||!['factory','bath','cistern','shop','cave'].includes(n.kind)&&!['factory','bath','cistern','shop','cave'].includes(c.kind))continue;
    const x=c.x*4+dx*2,z=c.z*4+dz*2,metal=['factory','cistern'].includes(n.kind)||['factory','cistern'].includes(c.kind);
    box(x,.012,z,dx?.18:3.65,.018,dz?.18:3.65,metal?'steel':'gold');
    box(x,Math.min(c.h,n.h)-.25,z,dx?.28:4,.32,dz?.28:4,metal?'rust':'red');
    for(const side of [-1,1])box(x+(dz?side*1.88:0),1.6,z+(dx?side*1.88:0),.12,3.2,.12,metal?'steel':'wood');
  }
  const staticChunks:{mesh:THREE.Mesh;center:THREE.Vector3;radius:number}[]=[];
  for(const {material:m,geometries} of batches.values()){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mats[m]);mesh.castShadow=true;mesh.receiveShadow=true;mesh.updateMatrixWorld(true);mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;merged.computeBoundingSphere();staticChunks.push({mesh,center:merged.boundingSphere!.center,radius:merged.boundingSphere!.radius});scene.add(mesh);}geometries.forEach(g=>g.dispose());}
  obstacles.push(...GOAL_WALLS);
  const enemyWalls=[...obstacles,...STAIRS],enemies=new Enemies(layout.cells,enemyWalls),doorMeshes=createDoorMeshes(scene,doors),enemyMeshes=createEnemyMeshes(scene,enemies);
  const upperFixed=[...upperPartitions,...upperBarriers,...stairRails,...doors.framesFor(UPPER_HEIGHT)];
  const beads=[...placeMagatama(layout.rooms,obstacles,upperFixed),...placeRedMagatama(layout.cells,enemies.nodes.values(),obstacles,seededRandom(seed^0x5231))],beadMeshes=createMagatamaMeshes(scene,beads);
  enemies.addPatrolTargets(beads.map(b=>({id:'room:'+b.id,position:b.position,floor:b.floor})));
  const goal=new ShrineGoal(),goalMeshes=createGoalMeshes(scene,goal);
  const burstRecharge=new BurstRecharge(),timeStop=new TimeStop();let environmentTime=0;
  let goalBlockers=goal.blockers();
  let groundDoors=doors.blockers(),upperDoorBlocks=doors.blockers(UPPER_HEIGHT);
  let groundCollision=[...obstacles,...groundDoors,...goalBlockers],groundEnemyCollision=[...enemyWalls,...groundDoors,...goalBlockers],upperCollision=[...upperFixed,...upperDoorBlocks];
  const refreshCollision=()=>{const g=doors.blockers(),u=doors.blockers(UPPER_HEIGHT),seal=goal.blockers();if(g!==groundDoors||seal!==goalBlockers){groundDoors=g;goalBlockers=seal;groundCollision=[...obstacles,...g,...seal];groundEnemyCollision=[...enemyWalls,...g,...seal];}if(u!==upperDoorBlocks){upperDoorBlocks=u;upperCollision=[...upperFixed,...u];}};
  let elevation=0,collision=groundCollision,reflectionEnabled=true;
  const mirror=new Reflector(new THREE.PlaneGeometry(4.7,6.7),{textureWidth:budget.mobile?1:512,textureHeight:budget.mobile?1:512,color:0x293d38});mirror.rotation.x=-Math.PI/2;mirror.position.set(0,.38,-92);scene.add(mirror);water.visible=false;
  const dustGeometry=new THREE.BufferGeometry(),dust=new Float32Array(900*3);
  for(let i=0;i<900;i++){const c=layout.cells[(i*137)%layout.cells.length];dust[i*3]=c.x*4+Math.sin(i*2.13)*1.7;dust[i*3+1]=.4+(i%37)/37*2.7;dust[i*3+2]=c.z*4+Math.cos(i*3.17)*1.7;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));const dustMaterial=new THREE.PointsMaterial({color:'#a6a090',size:.024,transparent:true,opacity:.12,depthWrite:false});scene.add(new THREE.Points(dustGeometry,dustMaterial));
  const lightPool=Array.from({length:6},()=>{const p=new THREE.PointLight('#ff9b49',10,14,2);scene.add(p);return p;});
  const flashlight=new THREE.SpotLight('#e6efff',46,36,.52,.65,1.5);flashlight.position.copy(camera.position);scene.add(flashlight,flashlight.target);
  renderer.shadowMap.type=THREE.PCFShadowMap;flashlight.castShadow=true;flashlight.shadow.mapSize.set(1024,1024);flashlight.shadow.bias=-.00015;flashlight.shadow.normalBias=.03;flashlight.shadow.camera.near=.1;flashlight.shadow.camera.far=36;
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;const ctx=glowCanvas.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,178,78,.36)');grad.addColorStop(.3,'rgba(255,112,31,.10)');grad.addColorStop(1,'rgba(255,100,20,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const glowTex=new THREE.CanvasTexture(glowCanvas),glowMat=new THREE.PointsMaterial({map:glowTex,color:'#ffffff',size:2.5,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const glowGeometry=new THREE.BufferGeometry().setFromPoints(lanterns.filter(p=>!fixtureColors.has(p)));scene.add(new THREE.Points(glowGeometry,glowMat));
  let lastLight=0,disposed=false,configuredQuality:Preferences['quality']|null=null;const direction=new THREE.Vector3(),moodTarget=new THREE.Color('#080c0d');
  let effects:ReturnType<typeof createEffects>|undefined;
  let selectedQuality:Preferences['quality']='medium';
  const resizeTargets=()=>{renderer.setPixelRatio(budget.pixelRatio(selectedQuality,innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);effects?.resize();};
  mats.light.color.multiplyScalar(1.35);mats.coolLight.color.multiplyScalar(1.15);
  const moods={shop:new THREE.Color('#17100b'),factory:new THREE.Color('#090f14'),bath:new THREE.Color('#0c1715'),cistern:new THREE.Color('#071114'),cave:new THREE.Color('#070d10'),field:new THREE.Color('#17212b'),shrine:new THREE.Color('#080c0d')};
  new THREE.TextureLoader().load('/cedar.png',texture=>{if(disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mats.wood.map=texture;mats.wood.color.set('#b7a596');mats.wood.needsUpdate=true;mats.red.map=texture;mats.red.needsUpdate=true;});
  const surfaceTextures:THREE.Texture[]=[];
  for(const [url,targets,bump] of [['/weathered-concrete.png',[mats.concrete,mats.stone,mats.rock,mats.earth],.045],['/rusted-steel.png',[mats.rust,mats.steel],.025]] as [string,THREE.MeshStandardMaterial[],number][]){
    new THREE.TextureLoader().load(url,texture=>{
      if(disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      const relief=texture.clone();relief.colorSpace=THREE.NoColorSpace;relief.needsUpdate=true;surfaceTextures.push(texture,relief);
      for(const m of targets){m.map=texture;m.bumpMap=relief;m.bumpScale=bump;if(m!==mats.earth&&m!==mats.rock)m.color.set('#a2a49e');m.needsUpdate=true;}
    });
  }
  const floorLevel=()=>elevation>UPPER_HEIGHT-.3?UPPER_HEIGHT:0;
  return {renderer,scene,camera,get obstacles(){return collision;},flashlight,
    observeFrame(ms:number,active:boolean){if(budget.observe(ms,active))resizeTargets();},
    get completed(){return goal.completed;},
    get burstCooldown(){return burstRecharge.remaining;},
    get timeStopped(){return timeStop.active;},
    get timeStopRemaining(){return timeStop.remaining;},
    get timeStopCooldown(){return timeStop.cooldown;},
    stopTime(){return !goal.completed&&timeStop.use();},
    goalDirection(){return enemyDirection(camera.position,ALTAR,camera.rotation.y);},
    collection(){return {...beadInventory(beads),blueOffered:goal.blueOffered,redOffered:goal.redOffered,unlocked:goal.unlocked,area:areaAt(camera.position,elevation)};},
    move(x:number,z:number,yaw:number,sprint:boolean,dt:number){
      if(goal.completed)return {x:camera.position.x,z:camera.position.z,y:camera.position.y};
      refreshCollision();collision=floorLevel()?upperCollision:groundCollision;
      const pos=movePlayer(camera.position,x,z,yaw,sprint,dt,collision);lastMotion={running:sprint,moving:Math.hypot(pos.x-camera.position.x,pos.z-camera.position.z)>.0001};elevation=floorHeightAt(pos,elevation);return {...pos,y:elevation+1.68};
    },
    enemyDirections(){return enemies.actors.map(e=>({id:e.id,...enemyDirection(camera.position,e.position,camera.rotation.y),stunned:e.brain.mode==='stunned'}));},
    nearDoor(){return !!doors.nearest(camera.position,camera.rotation.y,floorLevel()?upperFixed:obstacles,floorLevel());},
    nearAltar(){return goal.nearAltar(camera.position,camera.rotation.y,elevation,collision);},
    interact(){if(goal.nearAltar(camera.position,camera.rotation.y,elevation,collision)){const used=goal.offer(beadInventory(beads));spendBeads(beads,used);return used.blue||used.red?'offered':'empty';}return doors.interact(camera.position,camera.rotation.y,floorLevel()?upperFixed:obstacles,floorLevel());},
    burst(){if(goal.completed||!burstRecharge.use())return null;return enemies.burst(camera.position,[...collision,...STAIR_LIGHT_VOLUMES],elevation,camera.rotation.y,camera.rotation.x);},
    step(dt:number){
      if(goal.completed)return false;
      burstRecharge.step(dt);
      const liveDt=timeStop.step(dt);environmentTime+=liveDt*1000;
      if(runningSteps.update(dt,lastMotion.running,lastMotion.moving)){
        if(liveDt>1e-6)enemies.hear(camera.position,elevation);
        const cell=layout.grid.get(Math.round(camera.position.x/4)+','+Math.round(camera.position.z/4));footsteps.play(['stone','factory','bath','cistern','cave'].includes(cell?.kind??''));
      }
      lastMotion={running:false,moving:false};
      if(liveDt>1e-6)for(const e of enemies.actors)openPursuedDoor(doors,e,e.floor>4.5?upperFixed:enemyWalls,liveDt);
      doors.update(dt,camera.position,floorLevel());refreshCollision();collision=floorLevel()?upperCollision:groundCollision;doorMeshes.update();
      collectMagatama(beads,camera.position,elevation,collision);
      goal.update(dt,camera.position,elevation);refreshCollision();collision=floorLevel()?upperCollision:groundCollision;
      if(goal.completed)return false;
      if(liveDt>1e-6&&enemies.update(liveDt,camera.position,groundEnemyCollision,elevation,upperCollision)){elevation=0;camera.position.set(SPAWN.x,1.68,SPAWN.z);enemies.reset();return true;}return false;
    },
    configure(p:Preferences){
      renderer.toneMappingExposure=p.brightness;
      camera.fov=p.fov;camera.updateProjectionMatrix();
      selectedQuality=p.quality;const quality=budget.quality(p.quality);
      if(configuredQuality===quality)return;
      configuredQuality=quality;
      if(quality==='low'){effects?.dispose();effects=undefined;}else if(!effects&&!rendererOverride)effects=createEffects(renderer,scene,camera,budget.mobile);
      resizeTargets();
      renderer.shadowMap.enabled=quality!=='low';
      const size=quality==='high'?2048:1024;
      if(flashlight.shadow.mapSize.x!==size){flashlight.shadow.map?.dispose();flashlight.shadow.map=null;flashlight.shadow.mapSize.set(size,size);}
      if(quality==='low'&&flashlight.shadow.map){flashlight.shadow.map.dispose();flashlight.shadow.map=null;}
      flashlight.castShadow=quality!=='low';camera.fov=p.fov;camera.updateProjectionMatrix();
      lightPool.forEach((light,i)=>{light.visible=i<(quality==='low'?3:6);});
      reflectionEnabled=quality!=='low'&&!budget.mobile;mirror.visible=reflectionEnabled;water.visible=!reflectionEnabled;const reflectionSize=reflectionEnabled?(quality==='high'?768:384):1;mirror.getRenderTarget().setSize(reflectionSize,reflectionSize);
      effects?.configure(quality);
    },
    render(time:number){
      const area=layout.grid.get(Math.round(camera.position.x/4)+','+Math.round(camera.position.z/4))?.kind;
      moodTarget.copy(area==='shop'||area==='factory'||area==='bath'||area==='cistern'||area==='cave'||area==='field'?moods[area]:moods.shrine);
      scene.fog!.color.lerp(moodTarget,.025);(scene.background as THREE.Color).lerp(moodTarget,.025);
      (scene.fog as THREE.FogExp2).density=area==='field'?.021:.027;
      if(time-lastLight>220){
        const nearby:{p:THREE.Vector3;d:number}[]=[];
        for(const p of lanterns){const d=p.distanceToSquared(camera.position);if(nearby.length===6&&d>=nearby[5].d)continue;let i=0;while(i<nearby.length&&nearby[i].d<d)i++;nearby.splice(i,0,{p,d});if(nearby.length>6)nearby.pop();}
        lightPool.forEach((light,i)=>{if(nearby[i]){light.position.copy(nearby[i].p);light.color.set(fixtureColors.get(nearby[i].p)??'#ff9b49');}});
        // At this distance exponential fog is already opaque; keep nearby detail intact.
        for(const c of staticChunks)c.mesh.visible=c.center.distanceToSquared(camera.position)<((configuredQuality==='low'?area==='field'?85:72:110)+c.radius)**2;
        mirror.visible=reflectionEnabled&&mirror.position.distanceToSquared(camera.position)<3600;water.visible=!mirror.visible;
        lastLight=time;
      }
      flashlight.position.copy(camera.position);flashlight.position.y-=.12;camera.getWorldDirection(direction);flashlight.target.position.copy(camera.position).addScaledVector(direction,10);
      lightPool.forEach((l,i)=>l.intensity=10*(1+.02*Math.sin(environmentTime*.0021+i*2.3)));
      enemyMeshes.update(environmentTime,camera.position,configuredQuality==='low'?80:125);
      beadMeshes.update(environmentTime);
      goalMeshes.update();
      if(effects)effects.render();else {renderer.render(scene,camera);renderEnemyEcho(renderer,scene,camera);}
    },
    resize(){resizeTargets();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();},
    dispose(){disposed=true;footsteps.dispose();goalMeshes.dispose();beadMeshes.dispose();effects?.dispose();environment?.dispose();surfaceTextures.forEach(t=>t.dispose());scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});Object.values(mats).forEach(m=>{if('map'in m)m.map?.dispose();m.dispose();});doorMeshes.dispose();enemyMeshes.dispose();mirror.dispose();dustGeometry.dispose();dustMaterial.dispose();water.material.dispose();glowGeometry.dispose();glowMat.dispose();glowTex.dispose();flashlight.shadow.dispose();renderer.dispose();},
  };
}


