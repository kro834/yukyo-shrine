import {circusFabric} from './circus-fabric.ts';
import {circusPaint} from './circus-paint.ts';
import {createCircusPlan} from './circus-plan.ts';
import {CircusRuntime} from './circus-runtime.ts';
import {CIRCUS_MATERIALS,buildCircusCell,buildCircusWall,buildCircusScenery} from './circus-scenery.ts';
import {createCircusDynamics} from './circus-dynamics.ts';
import {CIRCUS_AREA_NAMES,circusRoomName,buildCircusRoom} from './circus-rooms.ts';
import {combineObstacles} from './spatial.ts';
import {BEAD_REQUIREMENTS,collectionReady} from './goal-rules.ts';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {buildYokochoFront} from './yokocho-front.ts';
import {buildNarrowInterior,NARROW_LAMP} from './narrow-interior.ts';
import {chamferedBox} from './chamfered-box.ts';
import {wainscot} from './wainscot.ts';
import {waterFinish} from './water-finish.ts';
import {exteriorRoofSites,exteriorRoof} from './exterior-roofs.ts';
import {createWallPostCollector} from './wall-posts.ts';
import {boardFacing} from './board-facing.ts';
import {shrubPlacements} from './shrub-placement.ts';
import {ShrubMeshes} from './shrub-meshes.ts';
import {bankShoreFinish} from './bank-shore-finish.ts';
import {installBankPathFinish} from './bank-path-finish.ts';
import {outdoorTimberBay,outdoorTimberFinish} from './outdoor-timber.ts';
import {prepareNightSky} from './night-sky.ts';
import {plankFloor} from './plank-floor.ts';
import {OutdoorReflection,reflectedWaterFinish,waterReflectionUniforms} from './outdoor-reflection.ts';
import {ceramicJar,ceramicSeal} from './ceramic-jar.ts';
import {finiteFixture,finiteSceneFixtures,pendingFixtureFinish} from './finite-fixture.ts';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createEffects,renderEnemyEcho} from './shrine-effects.ts';
import {CELL,SPAWN} from './shrine-layout.ts';
import {createSectorLayout as createLayout} from './sector-layout.ts';
import type {Preferences} from './preferences';
import {Doors,Enemies,openPursuedDoor} from './shrine-gameplay.ts';
import {createDoorMeshes,createEnemyMeshes} from './shrine-actors.ts';
import {ScannedProps,propFootprint,type ScannedPlacement} from './scanned-props.ts';
import {enemyDirection,enemyFloorHint} from './enemy-direction.ts';
import {movePlayer} from './movement.ts';
import {UPPER_HEIGHT,STAIRS,upperDoors,upperPartitions,upperBarriers,stairRails,floorHeightAt} from './annex.ts';
import {RunningSteps,createFootstepAudio} from './footsteps.ts';
import {placeMagatama,placeRedMagatama,collectMagatama,beadInventory,spendBeads} from './magatama.ts';
import {createMagatamaMeshes} from './magatama-mesh.ts';
import {ShrineGoal,GOAL} from './shrine-goal.ts';
import {seededRandom} from './seeded-random.ts';
import {createAreaLookup} from './area-rules.ts';
import {createGoalMeshes} from './goal-mesh.ts';
import {BurstRecharge} from './burst-recharge.ts';
import {PerformanceBudget} from './performance-budget.ts';
import {SECOND_DECK,THIRD_DECK,HIGH_STAIRS,highRails,highCaps,deckFurnitureWalls,floorBand,deckTheme,deckContains} from './vertical-layout.ts';
import {horrorArea,buildHorrorArea} from './horror-areas.ts';
import {AREA_THEMES} from './expansion-areas.ts';
import {agedFinish} from './surface-finish.ts';
import {SurfaceLibrary} from './surface-library.ts';
import {surfaceUV} from './surface-uv.ts';
import {createTatamiGeometry,tatamiPlacementsForRectangle,TATAMI} from './tatami-geometry.ts';
import {fabricFinish} from './fabric-finish.ts';
import {FixtureLighting} from './fixture-lighting.ts';
import {FixtureShadow} from './fixture-shadow.ts';
import {fieldGround,fieldSurfaceHeight} from './field-ground.ts';
import {terrainFinish} from './terrain-finish.ts';
import {lampFinish,lampHaloFinish} from './lamp-finish.ts';
import {lanternBody} from './lantern-body.ts';
import {gothicArch,buildGothicWall} from './gothic-architecture.ts';
import {ORCHESTRA_AREA_NAMES} from './orchestra-layout.ts';
import {buildFieldFoliage} from './field-landscape.ts';
import {createCaveSurfaces,caveDeckLimit} from './cave-surfaces.ts';
import {belowUpperDeck} from './ground-clearance.ts';
import {LANDSCAPE_NAMES} from './outer-landform-plan.ts';
import {createOuterLandformSurfaces} from './outer-landform-surfaces.ts';
import {createCivicSites} from './civic-placement.ts';
import {buildCivicScene} from './civic-scene.ts';
import {RunProgress} from './run-progress.ts';
import {Stamina} from './stamina.ts';
import {TimeStop} from './time-stop.ts';
import {MirrorInventory} from './mirror-inventory.ts';
import {createMirrorMeshes} from './mirror-mesh.ts';
import type {PlayMode} from './play-mode.ts';
import {STAGES,stageRules,type StageId} from './stage-profile.ts';
import {STAIR_LIGHT_VOLUMES} from './stair-light.ts';
export function createWorld(canvas:HTMLCanvasElement,rendererOverride?:THREE.WebGLRenderer,seed=Math.floor(Math.random()*0xffffffff),stage:StageId='shrine') {
  const stageProfile=STAGES[stage],stageFog=new THREE.Color(stageProfile.fog),gothic=stage==='orchestra',circus=stage==='circus';
  let playMode:PlayMode='normal',phaseRevision=0;let nightSky:THREE.Texture|undefined,nightSkyTarget:THREE.WebGLRenderTarget|undefined,skyRequested=false;
  const device=typeof navigator!=='undefined'?navigator as Navigator&{deviceMemory?:number}:undefined;
  const budget=new PerformanceBudget({touch:(device?.maxTouchPoints??0)>1||/Android|iPhone|iPad/i.test(device?.userAgent??''),cores:device?.hardwareConcurrency,memory:device?.deviceMemory});
  const renderer=rendererOverride??new THREE.WebGLRenderer({canvas,antialias:!budget.mobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(budget.pixelRatio('medium',innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();const backgroundColor=new THREE.Color('#050809');scene.background=backgroundColor;scene.fog=new THREE.FogExp2('#080c0d',.027);
  const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,180);camera.position.set(SPAWN.x,1.68,SPAWN.z);camera.rotation.order='YXZ';
  let environment:THREE.WebGLRenderTarget|undefined;
  if(!rendererOverride){const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=gothic?.025:.065;room.dispose();pmrem.dispose();}
  scene.add(new THREE.HemisphereLight(gothic?'#757d98':'#91a2af',gothic?'#171219':'#30271d',gothic?.048:stage==='abyss'?.045:.12));
  const moon=new THREE.DirectionalLight('#8c9aa6',stageProfile.moon);moon.position.set(-10,18,5);scene.add(moon);
  const layout=createLayout(seed,stage),areaAt=createAreaLookup(layout.cells),doors=new Doors([...layout.doors,...upperDoors]),obstacles=[...layout.obstacles,...doors.frames,...stairRails];
  const circusPlan=circus?createCircusPlan(seed,layout):undefined,circusRuntime=circusPlan?new CircusRuntime(circusPlan):undefined;
  const visualKind=(kind:string,x:number,z:number)=>{if(stage==='outer')return kind;const patch=((Math.floor((x+200)/20)+Math.floor((z+300)/20)*3+(seed%5))%5+5)%5;if(['factory','bath','cistern','shop'].includes(kind))return patch===0?'stone':patch===2?'hall':kind;return kind;};
  const cave=createCaveSurfaces(layout.cells,layout.walls,seed,{detail:budget.mobile?'low':'high',ceilingLimit:caveDeckLimit(SECOND_DECK.cells)});
  const landforms=stage==='outer'?createOuterLandformSurfaces(layout.grid,layout.landforms,{belowUpperDeck,subdivisions:budget.mobile?4:6}):undefined;
  const civicSites=createCivicSites(layout);
  const runRandom=seededRandom(seed^0x918237),altarRooms=layout.expansionAreas.filter(r=>!r.bead&&r.x2-r.x1===2&&r.z2-r.z1===2);
  const altarRoom=altarRooms[Math.floor(runRandom()*altarRooms.length)],goal=new ShrineGoal({x:(altarRoom.x1+altarRoom.x2)*2,z:(altarRoom.z1+altarRoom.z2)*2-15.5},.7);
  const areaName=()=>{if(circus){if(elevation>4.5)return elevation>9.3?'三層 · 吊り道具の回廊':'二層 · 空中桟橋';const p=camera.position,r=layout.rooms.find(r=>p.x>=r.x1*4-2&&p.x<=r.x2*4+2&&p.z>=r.z1*4-2&&p.z<=r.z2*4+2);return r?circusRoomName(r):CIRCUS_AREA_NAMES[layout.grid.get(Math.round(p.x/4)+','+Math.round(p.z/4))?.kind??'hall'];}if(elevation>4.5)return (elevation>9.3?"三層 · ":"二層 · ")+deckTheme(camera.position,elevation>9.3?2:1);const p=camera.position,r=layout.expansionAreas.find(r=>p.x>=r.x1*4-2&&p.x<=r.x2*4+2&&p.z>=r.z1*4-2&&p.z<=r.z2*4+2);if(r){if(gothic){const c=layout.grid.get(Math.round(p.x/4)+','+Math.round(p.z/4));return r.themeId?.startsWith('orchestra-')?(horrorArea(r.themeId)?.name??'音楽堂'):((ORCHESTRA_AREA_NAMES[c?.kind??'hall']??'音楽堂')+' · '+r.id.slice(-2));}const parent=layout.sectors.find(s=>p.x>=s.x1*4-2&&p.x<=s.x2*4+2&&p.z>=s.z1*4-2&&p.z<=s.z2*4+2);return (parent?.kind==='yokocho'?'宵闇横丁 · ':'')+(horrorArea(r.themeId)?.name??AREA_THEMES[(Number(r.id.slice(-2))-1)%9]+' · '+r.id.slice(-2));};const kind=layout.grid.get(Math.round(p.x/4)+','+Math.round(p.z/4))?.kind;if(gothic)return ORCHESTRA_AREA_NAMES[kind??'hall']??'音楽堂';const landform=layout.landforms.find(r=>Math.abs(p.x-r.cx*4)<=34&&Math.abs(p.z-r.cz*4)<=34);if(stage==='abyss'&&kind==='field')return '埋没した排水路';if(stage==='abyss'&&kind==='yokocho')return '地底の封鎖横丁 · 最危険';if(kind==='field'&&landform)return LANDSCAPE_NAMES[landform.identity];const visual=visualKind(kind??'hall',p.x,p.z);if(visual!==kind)return visual==='stone'?'石蔵の回廊':'祭具の間';return ({yokocho:'宵闇横丁 · 最危険',factory:'廃工場',bath:'朽ちた湯殿',cistern:'地下水槽',shop:'駄菓子屋横丁',cave:'地底洞穴',field:'夜のあぜ道'} as Record<string,string>)[kind??'']??'祭殿回廊';};
  const runningSteps=new RunningSteps(),footsteps=createFootstepAudio();let lastMotion={running:false,moving:false};
  const mats={
    circusRed:new THREE.MeshPhysicalMaterial({...CIRCUS_MATERIALS.circusRed,sheen:.35,sheenColor:0xb37277,sheenRoughness:1}),
    circusIvory:new THREE.MeshPhysicalMaterial({...CIRCUS_MATERIALS.circusIvory,sheen:.35,sheenColor:0xd7cbb2,sheenRoughness:1}),
    circusDark:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusDark),
    circusPaint:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusPaint),
    circusIvoryPaint:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusIvoryPaint),
    circusMetal:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusMetal),
    circusBrass:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusBrass),
    circusGlow:new THREE.MeshStandardMaterial(CIRCUS_MATERIALS.circusGlow),
    wood:new THREE.MeshStandardMaterial({color:'#685044',roughness:.9,metalness:0}),
    planks:new THREE.MeshStandardMaterial({color:'#d0bdaa',roughness:1,metalness:0}),
    dark:new THREE.MeshStandardMaterial({color:'#796b5f',roughness:.84}),
    red:new THREE.MeshStandardMaterial({color:'#4e241e',roughness:.74,metalness:0}),
    gold:new THREE.MeshStandardMaterial({color:'#b7934c',metalness:.72,roughness:.3}),
    plaster:new THREE.MeshStandardMaterial({color:'#836244',roughness:.97}),
    washiLit:new THREE.MeshStandardMaterial({color:'#b58e58',emissive:'#c27b35',emissiveIntensity:.32,roughness:.96}),
    lightSpill:new THREE.MeshBasicMaterial({color:'#b77a36',transparent:true,opacity:.14,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,blending:THREE.AdditiveBlending}),
    paper:new THREE.MeshStandardMaterial({color:'#999487',emissive:'#908b70',emissiveIntensity:.015,roughness:1}),
    wetPavement:new THREE.MeshStandardMaterial({color:'#637674',roughness:.24,metalness:0}),
    pavement:new THREE.MeshStandardMaterial({color:'#a0a19a',roughness:1,metalness:0}),
    stone:new THREE.MeshStandardMaterial({color:'#404747',roughness:.38,metalness:.15}),
    black:new THREE.MeshStandardMaterial({color:'#0b1011',roughness:.78}),
    light:new THREE.MeshStandardMaterial({color:'#b2a188',emissive:'#ffdbab',emissiveIntensity:1.35,roughness:.94}),
    rope:new THREE.MeshStandardMaterial({color:'#b19d78',roughness:1}),
    tatami:new THREE.MeshStandardMaterial({color:'#727253',roughness:.95}),
    tatamiTrim:new THREE.MeshStandardMaterial({color:'#243421',roughness:1}),
    concrete:new THREE.MeshStandardMaterial({color:'#454946',roughness:.94}),
    concreteWall:new THREE.MeshStandardMaterial({color:'#b4b6ad',roughness:1}),
    civicPaint:new THREE.MeshStandardMaterial({color:'#414b47',roughness:.76,metalness:.04}),
    civicEnamel:new THREE.MeshStandardMaterial({color:'#a0a99e',roughness:.54,metalness:.04}),
    civicGlass:new THREE.MeshPhysicalMaterial({color:'#b6c5c0',roughness:.29,metalness:0,transparent:true,opacity:.23}),
    rust:new THREE.MeshStandardMaterial({color:'#713d27',roughness:.85,metalness:.4}),
    steel:new THREE.MeshStandardMaterial({color:'#29393c',roughness:.56,metalness:.8}),
    tile:new THREE.MeshStandardMaterial({color:'#829791',roughness:.32,metalness:0}),
    water:new THREE.MeshStandardMaterial({color:'#0b2224',roughness:.16,metalness:0}),
    coolLight:new THREE.MeshStandardMaterial({color:'#a1b3af',emissive:'#d7e6df',emissiveIntensity:1.2,roughness:.64}),
    candyRed:new THREE.MeshStandardMaterial({color:'#b83b38',roughness:.42}),
    candyYellow:new THREE.MeshStandardMaterial({color:'#d8af49',roughness:.48}),
    candyBlue:new THREE.MeshStandardMaterial({color:'#438eac',roughness:.38}),
    candyPink:new THREE.MeshStandardMaterial({color:'#b86a8c',roughness:.45}),
    glass:new THREE.MeshPhysicalMaterial({color:'#80a99e',roughness:.12,metalness:0,transparent:true,opacity:.55}),
    rock:new THREE.MeshStandardMaterial({color:'#525b59',roughness:.91}),
    earth:new THREE.MeshStandardMaterial({color:'#443d2b',roughness:1}),
    bank:new THREE.MeshStandardMaterial({color:'#b0b8a4',roughness:1}),
    roofMetal:new THREE.MeshStandardMaterial({color:'#616e6a',roughness:.88,metalness:.12}),
    outdoorTimber:new THREE.MeshStandardMaterial({color:'#b3b4ad',roughness:.98,vertexColors:true}),
    pottery:new THREE.MeshPhysicalMaterial({color:'#637066',roughness:.42,metalness:0,ior:1.48,clearcoat:.8,clearcoatRoughness:.23}),
    grass:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.94,vertexColors:true,side:THREE.DoubleSide}),
  };
  for(const [name,material] of Object.entries(mats))material.name=name;
  agedFinish(mats.wood,'wood');agedFinish(mats.dark,'wood');agedFinish(mats.paper,'paper');agedFinish(mats.plaster,'plaster');agedFinish(mats.tatami,'tatami');
  fabricFinish(mats.tatamiTrim,false,true);mats.tatamiTrim.color.set('#243421');
  agedFinish(mats.concreteWall,'plaster');agedFinish(mats.civicPaint,'lacquer');agedFinish(mats.civicEnamel,'lacquer');
  agedFinish(mats.red,'lacquer');agedFinish(mats.tile,'tile');agedFinish(mats.planks,'wood');agedFinish(mats.pavement,'stone');
  terrainFinish(mats.earth);terrainFinish(mats.rock);terrainFinish(mats.bank);bankShoreFinish(mats.bank);
  const syncBankPath=installBankPathFinish(mats.bank,mats.earth);
  const waterClock={value:0};waterFinish(mats.water,waterClock);
  const waterReflection=waterReflectionUniforms();
  if(stage==='outer'&&!budget.mobile&&!rendererOverride)reflectedWaterFinish(mats.water,waterReflection);
  if(stage==='outer')mats.water.envMapIntensity=0;
  lampFinish(mats.light,'paper');lampFinish(mats.washiLit,'paper');lampFinish(mats.coolLight,'diffuser');
  lampFinish(mats.circusGlow,'diffuser');
  for(const m of [mats.circusRed,mats.circusIvory])circusFabric(m);
  outdoorTimberFinish(mats.outdoorTimber);
  agedFinish(mats.circusDark,'wood');agedFinish(mats.circusMetal,'lacquer');
  circusPaint(mats.circusPaint);
  agedFinish(mats.circusIvoryPaint,'lacquer');
  type MaterialKey=keyof typeof mats;
  const batches=new Map<string,{material:MaterialKey;geometries:THREE.BufferGeometry[]}>();
  let groundGeometry=true,gothicRoomProps=false;
  const add=(g:THREE.BufferGeometry,m:MaterialKey)=>{
    if(circus){if(m==='tatami')m='planks';else if(m==='paper'||m==='plaster')m='circusIvory';else if(m==='red')m='circusPaint';}
    if((m==='circusRed'||m==='circusIvory')&&g.userData.surfaceUV!=='authored'){surfaceUV(g,1);g.userData.surfaceUV='authored';}
    if(gothic){if(m==='tatami')m='stone';else if(m==='paper'&&!gothicRoomProps)m='red';else if(m==='plaster')m='concrete';}
    if(!gothic&&m==='concrete'){
      g.computeBoundingBox();const b=g.boundingBox!;
      if(b.max.y-b.min.y>.6&&Math.min(b.max.x-b.min.x,b.max.z-b.min.z)<1.25)m='concreteWall';
    }
    if(groundGeometry&&!g.userData.caveSurface){g.computeBoundingBox();const b=g.boundingBox!;
      if(b.max.y>4.5&&belowUpperDeck(b.min.x,b.max.x,b.min.z,b.max.z)){
        if(b.min.y>=4.5){g.dispose();return;}
        else {const position=g.getAttribute('position');for(let i=0;i<position.count;i++)position.setY(i,Math.min(4.5,position.getY(i)));g.computeVertexNormals();}
      }
    }
    // World-scale UVs avoid stretched grain on walls, beams and long pipes.
    if(g.userData.surfaceUV!=='authored'&&['pavement','wetPavement','tile','planks','wood','red','dark','concrete','concreteWall','rust','steel','stone','rock','earth','plaster','paper','tatami'].includes(m)){
      const scale=(m==='pavement'||m==='wetPavement')?1/2.4:m==='rust'?1/2.2:m==='concreteWall'?1/2.16:m==='concrete'?1/3:m==='planks'?1/1.5:m==='rock'?1/2.7:m==='plaster'?1/2:m==='earth'?1:['wood','red','dark'].includes(m)?.38:.3;
      surfaceUV(g,scale,['wood','dark'].includes(m)?'timber-photo':m==='red'?'timber':m==='planks'?'floor':undefined);
    }
    g.computeBoundingBox();const center=g.boundingBox!.getCenter(new THREE.Vector3());
    const key=m+':'+Math.floor(center.x/24)+':'+Math.floor(center.z/24);
    if(!batches.has(key))batches.set(key,{material:m,geometries:[]});batches.get(key)!.geometries.push(g);
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:MaterialKey)=>{
    const finishedY=y+h/2;
    if(m==='planks'&&w>=1.5&&d>=1.5&&h<=.30&&finishedY>=-.001&&Math.abs(finishedY/4.8-Math.round(finishedY/4.8))<.003){
      add(plankFloor(x,z,w,d,finishedY),'planks');
      add(new THREE.BoxGeometry(w,Math.max(.001,h-.004),d).translate(x,y-.002,z),'dark');return;
    }
    if(m==='tatami'&&!gothic&&!circus&&h<=.065&&w>=1.5&&d>=1.5){
      const placements=tatamiPlacementsForRectangle({x,z,width:w,depth:d,floorY:y+h/2-TATAMI.maxRise,inset:.08,variation:seed+x*.7+z});
      if(placements.length){
        const floor=createTatamiGeometry(placements);add(floor.reed,'tatami');add(floor.border,'tatamiTrim');
        // Keep the old finished height and let the lower perimeter frame support each mat.
        add(new THREE.BoxGeometry(w,Math.max(.002,h-TATAMI.maxRise),d).translate(x,y-TATAMI.maxRise/2,z),'wood');return;
      }
    }
    const size=[w,h,d].sort((a,b)=>a-b),beveled=(m==='wood'||m==='dark')&&size[0]>.08&&size[1]<.35&&size[2]>1;
    add((beveled?chamferedBox(w,h,d,Math.min(.008,size[0]*.08)):new THREE.BoxGeometry(w,h,d)).translate(x,y,z),m);
  };
  const cylinder=(x:number,y:number,z:number,r:number,h:number,m:MaterialKey,r2=r)=>add(new THREE.CylinderGeometry(r,r2,h,12).translate(x,y,z),m);
  const jar=(x:number,y:number,z:number)=>{add(ceramicJar().translate(x,y,z),'pottery');const seal=ceramicSeal(x*.7+z);add(seal.paper.translate(x,y,z),'paper');add(seal.cord.translate(x,y,z),'rope');};
  const block=(x:number,z:number,w:number,d:number,maxY=3.4)=>obstacles.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,maxY});
  const natureRandom=seededRandom(seed^0x72851);
  const rock=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const g=new THREE.BoxGeometry(w,h,d,3,3,3),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),noise=Math.sin((px+x)*3.17+(py+y)*4.11+(pz+z)*2.37)*.11;p.setXYZ(i,px+noise,py+noise,pz+noise);}
    g.computeVertexNormals();g.translate(x,y,z);add(g,'rock');
  };
  const lanterns:THREE.Vector3[]=[];
  let fixtureFloor=0;const fixtureFloors=new Map<THREE.Vector3,number>();
  const fixtureColors=new Map<THREE.Vector3,string>();
  const fixtureShadowPositions=new Map<THREE.Vector3,THREE.Vector3>();
  const fixturePowers=new Map<THREE.Vector3,number>();
  const fixture=(x:number,y:number,z:number,color:string,floor=fixtureFloor,shadowDrop=0,power=7)=>{if(groundGeometry&&y>4.5&&belowUpperDeck(x-.5,x+.5,z-.5,z+.5))return;const p=new THREE.Vector3(x,groundGeometry&&belowUpperDeck(x-.5,x+.5,z-.5,z+.5)?Math.min(y,3.6):y,z);lanterns.push(p);fixtureColors.set(p,color);fixtureFloors.set(p,floor);fixturePowers.set(p,power);if(shadowDrop&&p.y-shadowDrop>floor+1.9)fixtureShadowPositions.set(p,p.clone().add(new THREE.Vector3(0,-shadowDrop,0)));};
  // Put the pooled shadow emitter below the fitted cap so the housing cannot
  // eclipse its own light. Reuse the existing single desktop shadow atlas.
  const circusFixture=(x:number,y:number,z:number,color:string)=>fixture(x,y,z,color,fixtureFloor,.31);
  const lanternTemplates=[lanternBody(),lanternBody(true)];
  const lantern=(x:number,y:number,z:number,large=false)=>{
    const r=large?.42:.22,h=large?.95:.6;if(groundGeometry&&y+h/2>4.5&&belowUpperDeck(x-r,x+r,z-r,z+r))return;
    const template=lanternTemplates[large?1:0];
    add(template.shade.clone().translate(x,y,z),'light');add(template.caps.clone().translate(x,y,z),'dark');add(template.ribs.clone().translate(x,y,z),'wood');
    const point=new THREE.Vector3(x,groundGeometry&&belowUpperDeck(x-.5,x+.5,z-.5,z+.5)?Math.min(y,3.6):y,z);lanterns.push(point);fixtureFloors.set(point,fixtureFloor);if(point.y-h/2-.08>fixtureFloor+1.9)fixtureShadowPositions.set(point,point.clone().add(new THREE.Vector3(0,-h/2-.08,0)));
  };
  const wetPatch=(x:number,z:number,rx:number,rz:number,m:MaterialKey)=>{
    const shape=new THREE.Shape();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=.76+.24*natureRandom(),px=Math.cos(a)*rx*r,pz=Math.sin(a)*rz*r;if(i===0)shape.moveTo(px,pz);else shape.lineTo(px,pz);}shape.closePath();
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(x,.007,z);add(g,m);
  };
  if(stage==='outer')box(0,-2.75,0,440,.3,440,'earth');
  if(landforms)for(const surface of landforms.surfaces)add(surface.geometry,surface.material);
  const narrowKeys=new Set(layout.narrows.map(n=>Math.round(n.x/4)+','+Math.round(n.z/4)));
  const fieldCells=new Set(layout.cells.filter(c=>c.kind==='field'&&!belowUpperDeck(c.x*4-2,c.x*4+2,c.z*4-2,c.z*4+2)).map(c=>c.x+','+c.z));
  const isFieldCell=(x:number,z:number)=>fieldCells.has(x+','+z);
  for(const c of layout.cells){
    if(circus){buildCircusCell(c,add,circusFixture);continue;}
    const x=c.x*CELL,z=c.z*CELL,kind=visualKind(c.kind,x,z);
    if(gothic){
      box(x,-.14,z,4,.28,4,kind==='shop'||kind==='yokocho'?'planks':'concrete');
      box(x,c.h+.09,z,4,.18,4,'stone');
      box(x,.006,z,4,.009,.018,'dark');box(x,.006,z,.018,.009,4,'dark');
      const underDeck=belowUpperDeck(x-2,x+2,z-2,z+2),nearStair=STAIRS.some(s=>x+2>s.minX-.6&&x-2<s.maxX+.6&&z+2>s.minZ-1.5&&z-2<s.maxZ+1.5);
      if(!underDeck&&!nearStair&&(c.x+c.z)%4===0)gothicArch(x,z,layout.grid.has(c.x+','+(c.z+1)),4,c.h,add);
      if(!nearStair&&(c.x+c.z)%9===0){
        const y=Math.min(c.h-.6,3.65);cylinder(x,y,z,.11,.25,'light');cylinder(x,y+.16,z,.18,.06,'dark');cylinder(x,y-.17,z,.16,.08,'gold');
        box(x,(y+.19+c.h)/2,z,.018,c.h-y-.19,.018,'dark');fixture(x,y-.18,z,'#c09b81',0,.10);
      }
      continue;
    }
    if(kind==='yokocho'){
      if(stage==='abyss')box(x,c.h+.1,z,4,.2,4,'rock');
      box(x,-.14,z,4,.28,4,'pavement');box(x,.006,z,4,.012,.025,'black');
      if((c.x+c.z)%3===0){wetPatch(x,z,.6,.95,'wetPavement');lantern(x+.85,3.1,z);}
      if(c.z%4===0){box(x,4.2,z,4,.018,.018,'black');box(x,4.05,z+.2,4,.018,.018,'black');}
      continue;
    }
    if(kind==='cave'){
      box(x,-.17,z,4,.34,4,'rock');add(cave.roof(c),'rock');
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=layout.grid.get((c.x+dx)+','+(c.z+dz));if(n&&n.kind!=='cave'){const portal=cave.portal(c,n,dx,dz);if(portal)add(portal,'rock');}}
      if((c.x-c.z)%8===0){
        wetPatch(x,z,.5,.65,'water');lantern(x,2.6,z);
        const bottom=2.94,top=cave.heightAt(x,z)+.02;
        if(top>bottom){const chain=new THREE.CylinderGeometry(.008,.008,top-bottom,5);chain.translate(x,(top+bottom)/2,z);add(chain,'steel');}
      }
      continue;
    }
    if(kind==='field'){
      if(stage==='abyss')box(x,c.h+.1,z,4,.2,4,'rock');
      const landscape=landforms?.regionAt(x,z)?.identity,urban=landscape==='underpass'||landscape==='greenway'||landscape==='floodgate';
      add(fieldGround(x,z,seed,isFieldCell),urban?'concrete':landscape==='riverside'?'pavement':'earth');
      if((c.x+c.z)%9===0&&!civicSites.some(s=>Math.abs(s.x-x)<=6&&Math.abs(s.z-z)<=6)){
        cylinder(x+1.5,.8,z+1.5,.07,1.6,urban?'steel':'wood');
        if(urban){box(x+1.5,1.65,z+1.5,.18,.24,.18,'dark');box(x+1.5,1.66,z+1.5,.19,.14,.19,'glass');fixture(x+1.5,1.72,z+1.5,'#b4c7c2');}
        else lantern(x+1.5,1.8,z+1.5);
      }
      continue;
    }
    if(kind==='shop'){
      box(x,-.14,z,4,.28,4,'planks');box(x,c.h+.1,z,4,.2,4,'dark');box(x,c.h-.12,z,4,.18,.15,'wood');
      if((c.x+c.z)%4===0){lantern(x,3.4,z);box(x,4,z,.03,1,.03,'dark');}
      continue;
    }
    if(kind==='factory'||kind==='bath'||kind==='cistern'){
      const factory=kind==='factory',bath=kind==='bath';
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
    box(x,-.14,z,4,.28,4,kind==='stone'?'stone':'planks');
    box(x,c.h+.12,z,4,.24,4,'dark');
    if(kind==='stone'){box(x,.004,z,.022,.008,4,'black');box(x,.004,z,4,.008,.022,'black');}
    else {if((c.x+c.z)%2===0){box(x,Math.max(2.9,c.h-.32),z,.12,.14,4,'dark');box(x,c.h-.22,z+1.15,4,.11,.1,'wood');box(x,c.h-.22,z-1.15,4,.11,.1,'wood');}}
    box(x,c.h-.12,z,4,.22,.18,'red');
    for(const [dx,dz] of [[1,0],[0,1]]){
      const n=layout.grid.get((c.x+dx)+','+(c.z+dz));
      if(n&&n.kind!=='field'&&n.kind!=='yokocho'&&n.h!==c.h){const bottom=Math.min(n.h,c.h),height=Math.abs(c.h-n.h);box(x+dx*2,bottom+height/2,z+dz*2,dx?.28:4,height,dz?.28:4,'dark');}
    }
    if(kind==='passage'&&!narrowKeys.has(c.x+','+c.z)&&(c.x+c.z)%3===0){lantern(x,c.h-.68,z);box(x,c.h-.12,z,.025,.65,.025,'gold');}
  }
  const wallPosts=createWallPostCollector();
  for(const w of layout.walls){
    if(circus){buildCircusWall(w,add,budget.mobile);continue;}
    const kind=visualKind(w.kind??"hall",w.x+w.insideX*.2,w.z+w.insideZ*.2);
    if(gothic){
      box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,'concrete');
      const top=belowUpperDeck(w.x-2,w.x+2,w.z-2,w.z+2)?Math.min(w.h,4.5):w.h;
      buildGothicWall({...w,h:top},add,box);
      if(w.twoSided)buildGothicWall({...w,h:top,insideX:-w.insideX,insideZ:-w.insideZ},add,box);
      continue;
    }
    if(kind==='yokocho'){
      const adjacent=layout.narrows.some(n=>Math.abs(n.x-(w.x+w.insideX*2))<.1&&Math.abs(n.z-(w.z+w.insideZ*2))<.1);
      const v=(Math.imul(Math.round(w.x),73856093)^Math.imul(Math.round(w.z),19349663)^seed)>>>0;
      box(w.x,adjacent?2.85:4.6,w.z,w.alongX?4:.3,adjacent?5.7:2.2,w.alongX?.3:4,v%3===0?'plaster':'wood');
      if(!adjacent)buildYokochoFront(box,w.x+w.insideX*.18,w.z+w.insideZ*.18,w.alongX,w.insideX,w.insideZ,v);
      const x=w.x+w.insideX*.18,z=w.z+w.insideZ*.18;
      box(x,4.15,z,w.alongX?1.65:.06,1.15,w.alongX?.06:1.65,'paper');
      for(const t of [-.82,0,.82])box(x+(w.alongX?t:0),4.15,z+(w.alongX?0:t),.07,1.25,.07,'dark');
      box(x,4.76,z,w.alongX?1.86:.16,.1,w.alongX?.16:1.86,'dark');
      if(v%7===0){box(x,3.72,z,w.alongX?.66:.18,.32,w.alongX?.18:.66,'steel');}
      continue;
    }
    if(kind==='cave'){
      add(cave.wall(w),'rock');continue;
    }
    if(kind==='field'){
      if(w.h<2){
        const identity=landforms?.regionAt(w.x,w.z)?.identity,metal=identity==='underpass'||identity==='floodgate'||identity==='riverside';
        if(metal||!landforms)box(w.x,.16,w.z,w.alongX?4:.36,.32,w.alongX?.36:4,metal?'concrete':'earth');
        if(w.h>1){
          if(!metal){
            const bay=outdoorTimberBay(seed+w.x*.73+w.z*1.13),yaw=w.alongX?0:Math.PI/2;
            add(bay.wood.rotateY(yaw).translate(w.x,0,w.z),'outdoorTimber');
            add(bay.metal.rotateY(yaw).translate(w.x,0,w.z),'steel');
          }else{
            for(const t of [-1.85,1.85])box(w.x+(w.alongX?t:0),.64,w.z+(w.alongX?0:t),.065,1.25,.065,'steel');
            for(const y of [.55,1.05])box(w.x,y,w.z,w.alongX?4:.08,.085,w.alongX?.08:4,'steel');
          }
        }
      }
      else {rock(w.x-w.insideX*2.2,w.h/2,w.z-w.insideZ*2.2,w.alongX?4.6:4.5,w.h+1.5,w.alongX?4.5:4.6);}
      continue;
    }
    if(kind==='shop'){
      box(w.x,w.h/2,w.z,w.alongX?4:.3,w.h,w.alongX?.3:4,'wood');
      const x=w.x+w.insideX*.19,z=w.z+w.insideZ*.19;
      box(x,1.8,z,w.alongX?3.6:.07,2.4,w.alongX?.07:3.6,'paper');
      for(const y of [.6,1.8,3])box(x,y,z,w.alongX?4:.15,.1,w.alongX?.15:4,'dark');
      for(const side of [-1,1])box(x+(w.alongX?side*1.8:0),2,z+(w.alongX?0:side*1.8),.12,4,.12,'dark');continue;
    }
    if(kind==='factory'||kind==='bath'||kind==='cistern'){
      const bath=kind==='bath',factory=kind==='factory',x=w.x+w.insideX*.19,z=w.z+w.insideZ*.19;
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
    const variation=Math.abs(Math.round(w.x)*13+Math.round(w.z)*7+seed)%7,screen=variation===2||variation===3||variation===4;
    const luminous=screen&&!w.twoSided&&Math.abs(Math.round(w.x+w.z)+seed)%9===0;
    if(!screen&&variation>=2)add(boardFacing(3.7,2.15,.055,variation).rotateY(Math.atan2(w.insideX,w.insideZ)).translate(x,1.85,z),'wood');
    else box(x,1.85,z,w.alongX?3.7:.055,2.15,w.alongX?.055:3.7,luminous?'washiLit':screen?'paper':'plaster');
    add(wainscot(4,.78,.16,variation).rotateY(Math.atan2(w.insideX,w.insideZ)).translate(x,.39,z),'wood');
    if(screen){
      for(let j=-4;j<=4;j++)box(x+(w.alongX?j*.41:0),1.85,z+(w.alongX?0:j*.41),w.alongX?.036:.12,2.2,w.alongX?.12:.036,'dark');
      for(let j=0;j<6;j++)box(x,.8+j*.42,z,w.alongX?4:.12,.035,w.alongX?.12:4,'dark');
    }else for(const offset of [-1.8,1.8])box(x+(w.alongX?offset:0),1.9,z+(w.alongX?0:offset),.075,2.3,.075,'dark');
    wallPosts.add(w);
    box(x,w.h-.22,z,w.alongX?4:.32,.3,w.alongX?.32:4,'dark');
    box(x,.8,z,w.alongX?4:.18,.07,w.alongX?.18:4,'dark');
    if(w.twoSided){const bx=w.x-w.insideX*.19,bz=w.z-w.insideZ*.19;box(bx,1.7,bz,w.alongX?3.7:.06,2.8,w.alongX?.06:3.7,screen?'paper':'plaster');add(wainscot(4,.8,.15,variation+7).rotateY(Math.atan2(-w.insideX,-w.insideZ)).translate(bx,.4,bz),'wood');}
    // Light through the lattice: static floor patches need no additional shadow pass.
    if(luminous){
      for(let row=0;row<5;row++)for(let col=-3;col<=3;col++){
        const d=.48+row*.40,t=col*(.38+row*.025),px=x+w.insideX*d+(w.alongX?t:0),pz=z+w.insideZ*d+(w.alongX?0:t);
        const cell=layout.grid.get(Math.round(px/4)+','+Math.round(pz/4));
        if(!cell||STAIRS.some(s=>px>s.minX-.5&&px<s.maxX+.5&&pz>s.minZ-.5&&pz<s.maxZ+.5))continue;
        box(px,.075,pz,w.alongX?.29+row*.02:.31,.004,w.alongX?.31:.29+row*.02,'lightSpill');
      }
    }
    // Small andon fixtures tuck into the existing wall face, away from doorways.
    if(!w.twoSided&&variation===1&&Math.abs(Math.round((w.x+w.z)/2))%5===0){
      // The former frame sat behind the .26 m facing, leaving a floating bright
      // rectangle. Mount the housing outside it, still inside player clearance.
      const px=w.x+w.insideX*.36,pz=w.z+w.insideZ*.36;
      const fx=px+w.insideX*.073,fz=pz+w.insideZ*.073;
      box(px,.16,pz,w.alongX?.46:.13,.15,w.alongX?.13:.46,'dark');
      box(px,.65,pz,w.alongX?.36:.12,.72,w.alongX?.12:.36,'light');
      for(const side of [-1,1])box(fx+(w.alongX?side*.19:0),.65,fz+(w.alongX?0:side*.19),.026,.82,.026,'dark');
      for(const y of [.45,.82])box(fx,y,fz,w.alongX?.36:.018,.018,w.alongX?.018:.36,'wood');
      for(const y of [.25,1.05])box(px,y,pz,w.alongX?.44:.16,.055,w.alongX?.16:.44,'dark');
      fixture(px+w.insideX*.18,.8,pz+w.insideZ*.18,'#ffd2a0',fixtureFloor,0,2.2);
    }
  }
  for(const p of wallPosts.values())box(p.x,p.h/2,p.z,.30,p.h,.30,'wood');
  // Sliding frames end at 3.41 m. Seal the remaining transom to the room
  // ceiling; a taller room must not expose the sky above its closed doorway.
  if(!circus)for(const d of layout.doors){
    const top=Math.max(...layout.rooms.filter(r=>(d.rooms??[d.room]).includes(r.id)).map(r=>r.h));
    if(top>3.41)box(d.x,(top+3.40)/2,d.z,d.alongX?4:.30,top-3.40,d.alongX?.30:4,gothic?'concrete':'dark');
  }
  for(const n of layout.narrows){
    if(circus){for(const sign of [-1,1]){const x=n.x+(n.alongX?0:sign*1.68),z=n.z+(n.alongX?sign*1.68:0);box(x,1.8,z,n.alongX?4:.64,3.6,n.alongX?.64:4,'circusDark');buildCircusWall({x:n.x+(n.alongX?0:sign*1.40),z:n.z+(n.alongX?sign*1.40:0),h:3.6,alongX:n.alongX,insideX:n.alongX?0:-sign,insideZ:n.alongX?-sign:0},add);}continue;}
    if(gothic){
      const top=4.1;
      for(const sign of [-1,1]){
        const x=n.x+(n.alongX?0:sign*1.68),z=n.z+(n.alongX?sign*1.68:0);
        box(x,top/2,z,n.alongX?4:.64,top,n.alongX?.64:4,'concrete');
        buildGothicWall({x:n.x+(n.alongX?0:sign*1.50),z:n.z+(n.alongX?sign*1.50:0),h:top,alongX:n.alongX,insideX:n.alongX?0:-sign,insideZ:n.alongX?-sign:0},add,box);
      }
      box(n.x,top+.05,n.z,4,.1,4,'stone');gothicArch(n.x,n.z,!n.alongX,2.70,top,add);continue;
    }
    const alley=layout.grid.get(Math.round(n.x/4)+','+Math.round(n.z/4))?.kind==='yokocho';
    for(const sign of [-1,1]){
      if(alley){
        const nx=n.alongX?0:-sign,nz=n.alongX?-sign:0;
        const v=(Math.imul(Math.round(n.x),73856093)^Math.imul(Math.round(n.z),19349663)^Math.imul(sign,83492791)^seed)>>>0;
        buildYokochoFront(box,n.x-nx*1.36,n.z-nz*1.36,n.alongX,nx,nz,v);
        const gx=n.x-nx*1.2,gz=n.z-nz*1.2;
        box(gx,.006,gz,n.alongX?4:.16,.012,n.alongX?.16:4,'steel');
        for(const offset of [-1.5,-.5,.5,1.5])box(gx+(n.alongX?offset:0),.014,gz+(n.alongX?0:offset),n.alongX?.06:.14,.008,n.alongX?.14:.06,'black');
        if(v%9===0)lantern(n.x-nx*.97+(n.alongX?1.7:0),2.5,n.z-nz*.97+(n.alongX?0:1.7));
        continue;
      }
    }
    if(!alley){
      const v=(Math.imul(Math.round(n.x/4),73856093)^Math.imul(Math.round(n.z/4),19349663)^seed)>>>8;
      buildNarrowInterior(box,n.x,n.z,n.alongX,v);
      if((Math.round(n.x/4)+Math.round(n.z/4))%3===0){
        const {y,r,h}=NARROW_LAMP;
        box(n.x,y,n.z,r*2,h,r*2,'washiLit');
        for(const dx of [-r,r])for(const dz of [-r,r])box(n.x+dx,y,n.z+dz,.015,h+.026,.015,'wood');
        for(const dy of [-h/2,h/2])box(n.x,y+dy,n.z,r*2+.035,.024,r*2+.035,'dark');
        for(const dx of [-r,r])box(n.x+dx,y,n.z,.014,.014,r*2,'wood');
        for(const dz of [-r,r])box(n.x,y,n.z+dz,r*2,.014,.014,'wood');
        box(n.x,2.94,n.z,.012,.12,.012,'black');fixture(n.x,y,n.z,'#f4bb78',0,.22);
      }
    }
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
  const altar=(x:number,z:number,scale=1)=>{
    box(x,.2,z,4*scale,.4,1.8,'black');box(x,.7,z,3.3*scale,1,1.2,'red');box(x,1.28,z,4*scale,.14,1.5,'gold');
    box(x,1.42,z,3.9*scale,.1,1.45,'black');block(x,z,4*scale,1.8);
    const disk=new THREE.CylinderGeometry(.75*scale,.75*scale,.09,48);disk.rotateX(Math.PI/2);disk.translate(x,2.65,z-.15);add(disk,'gold');
    const ring=new THREE.TorusGeometry(.82*scale,.055,8,48);ring.translate(x,2.65,z-.1);add(ring,'gold');
    for(const side of [-1,1]){cylinder(x+side*1.3*scale,1.8,z,.07,.65,'gold');cylinder(x+side*1.3*scale,2.16,z,.06,.12,'light');lantern(x+side*3*scale,2.5,z,true);cylinder(x+side*3*scale,1,z,.09,2,'dark');}
  };
  const cisternSector=layout.sectors.find(s=>s.kind==='cistern')!,poolPosition={x:(cisternSector.x1+cisternSector.x2)*2,z:(cisternSector.z1+cisternSector.z2)*2};
  const water=new THREE.Mesh(new THREE.PlaneGeometry(4.85,6.85),new THREE.MeshPhysicalMaterial({color:'#17332f',metalness:0,roughness:.13,ior:1.333,clearcoat:0}));water.rotation.x=-Math.PI/2;water.position.set(poolPosition.x,.024,poolPosition.z);scene.add(water);
  waterFinish(water.material,waterClock);
  const scannedPlacements:ScannedPlacement[]=[];
  if(stage==='outer')for(const r of exteriorRoofSites(layout.rooms,layout.cells)){
    const x=(r.x1+r.x2)*2,z=(r.z1+r.z2)*2,y=r.h+.24;
    const roof=exteriorRoof((r.x2-r.x1+1)*4+.5,(r.z2-r.z1+1)*4+.5);
    add(roof.metal.translate(x,y,z),'roofMetal');add(roof.gables.translate(x,y,z),'wood');add(roof.trim.translate(x,y,z),'dark');
  }
  // Furnishings are kept off the two-door circulation axis through each room.
  for(const room of layout.rooms){
    if(circus){buildCircusRoom(room,add,block,circusFixture,room.id===altarRoom.id);continue;}
    if(room.themeId){gothicRoomProps=room.themeId.startsWith('orchestra-');buildHorrorArea(room,{box,cylinder,fixture,block,jar},room.id===altarRoom.id);gothicRoomProps=false;continue;}
    if(room.id===altarRoom.id)continue;
    const cx=(room.x1+room.x2)*2,cz=(room.z1+room.z2)*2;
    lantern(cx,room.h-.7,cz,room.h>=3.7);box(cx,room.h-.2,cz,.03,.8,.03,'dark');
    if(room.id.startsWith('expansion-')){
      const theme=(Number(room.id.slice(-2))-1)%9;
      const accents:MaterialKey[]=['steel','gold','red','stone','wood','water','paper','dark','gold'];
      const m=accents[theme];
      box(cx,.012,cz,(room.x2-room.x1+1)*4-1,.024,(room.z2-room.z1+1)*4-1,theme===4?'tatami':theme===3?'stone':'planks');
      for(const side of [-1,1]){
        const x=cx+side*3,z=cz+side*3;
        if([1,4,6,8].includes(theme)){
          const kind=theme===4?'stool':theme===6?'vase':'chair',y=kind==='vase'?.82:.024;
          if(kind==='vase'){box(x,.42,z,.46,.8,.46,'wood');block(x,z,.46,.46,.82);}
          const placement:ScannedPlacement={kind,x,y,z,yaw:side<0?Math.PI/4:-Math.PI*3/4};
          scannedPlacements.push(placement);obstacles.push(propFootprint(placement));continue;
        }
        if(theme===0){box(x,1.55,z,1.7,2.8,.12,'steel');box(x,3,z,1.9,.13,.22,'gold');}
        else if(theme===2){cylinder(x,room.h/2,z,.28,room.h,'red');}
        else if(theme===5){box(x,.35,z,2,.7,1.5,'stone');box(x,.72,z,1.8,.03,1.3,'water');}
        else if(theme===7){for(const y of [.5,1.2,1.9]){box(x,y,z,1.7,.1,1,'wood');for(let j=0;j<6;j++)box(x-.65+j*.24,y+.18,z,.15,.28,.65,'paper');}}
        else {cylinder(x,.7,z,.55,1.4,m,.7);cylinder(x,1.5,z,.7,.18,'gold');}
        block(x,z,1.9,1.7,theme===2?room.h:theme===0?3:theme===5?.8:2.3);
      }
      continue;
    }
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
  for(const court of circus?[]:layout.courts){
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
  for(const p of circus?[]:layout.paddies){const x=(p.x1+p.x2)*2,z=(p.z1+p.z2)*2,w=(p.x2-p.x1+1)*4,d=(p.z2-p.z1+1)*4;box(x,-.04,z,w,.035,d,'water');}
  // Fixtures follow generated walls instead of old absolute stage coordinates.
  for(const w of circus?[]:layout.walls){if(w.twoSided||Math.abs(Math.round((w.x+w.z)/2))%7!==0)continue;const x=w.x+w.insideX*.35,z=w.z+w.insideZ*.35,kind=w.kind;
    if(kind==='shop'){
      box(x,.52,z,w.alongX?2.8:.55,1.04,w.alongX?.55:2.8,'wood');block(x,z,w.alongX?2.8:.55,w.alongX?.55:2.8,1.04);
      for(let j=-2;j<=2;j++){const px=x+(w.alongX?j*.47:0),pz=z+(w.alongX?0:j*.47);cylinder(px,1.28,pz,.14,.42,'glass');cylinder(px,1.5,pz,.15,.035,'gold');box(px,1.1,pz,.2,.07,.2,(['candyRed','candyYellow','candyBlue','candyPink'] as const)[(j+2)%4]);}
    }else if(kind==='factory'||kind==='cistern'){
      cylinder(x,1.1,z,.28,2.2,'rust');cylinder(x,2.25,z,.31,.1,'steel');box(x,1.1,z,w.alongX?.8:.45,.12,w.alongX?.45:.8,'steel');block(x,z,.65,.65,2.3);
    }else if(kind==='bath'){
      box(x,.45,z,w.alongX?1.6:.5,.9,w.alongX?.5:1.6,'tile');box(x,.91,z,w.alongX?1.4:.42,.015,w.alongX?.42:1.4,'water');block(x,z,w.alongX?1.6:.5,w.alongX?.5:1.6,.93);
    }
  }
  if(landforms){
    obstacles.push(...buildCivicScene(civicSites,(g,m)=>add(g,m==='planks'?'wood':m==='dark'?'civicPaint':m==='enamel'?'civicEnamel':m==='glass'?'civicGlass':m),landforms.height));
    for(const s of civicSites)if(s.id==='railway-underpass-bay'){
      const a=s.quarterTurns*Math.PI/2;fixture(s.x+1.58*Math.cos(a),2.78,s.z+1.58*Math.sin(a),'#a0b6b8');
    }
  }
  if(circusPlan)buildCircusScenery(circusPlan,layout,add,circusFixture);
  if(!circus)buildFieldFoliage(layout,seed,(x,z)=>fieldSurfaceHeight(x,z,seed,isFieldCell),obstacles,g=>add(g,'grass'),landforms?.height,!budget.mobile);
  groundGeometry=false;fixtureFloor=4.8;
  for(let x=12;x<=23;x++)for(let z=0;z<=8;z++){
    if((x===13||x===22)&&z>=2&&z<=6)continue;
    box(x*4,UPPER_HEIGHT-.12,z*4,4,.24,4,'planks');
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
  groundGeometry=true;fixtureFloor=0;
  for(const c of layout.cells)for(const [dx,dz] of [[1,0],[0,1]]){
    const n=layout.grid.get((c.x+dx)+','+(c.z+dz));
    if(!n||n.kind===c.kind||c.kind==='field'||n.kind==='field'||!['factory','bath','cistern','shop','cave'].includes(n.kind)&&!['factory','bath','cistern','shop','cave'].includes(c.kind))continue;
    const x=c.x*4+dx*2,z=c.z*4+dz*2,metal=['factory','cistern'].includes(n.kind)||['factory','cistern'].includes(c.kind);
    box(x,.012,z,dx?.18:3.65,.018,dz?.18:3.65,metal?'steel':'gold');
    box(x,Math.min(c.h,n.h)-.25,z,dx?.28:4,.32,dz?.28:4,metal?'rust':'red');
    for(const side of [-1,1])box(x+(dz?side*1.88:0),1.6,z+(dx?side*1.88:0),.12,3.2,.12,metal?'steel':'wood');
  }
  groundGeometry=false;
  const staticChunks:{mesh:THREE.Mesh;center:THREE.Vector3;radius:number}[]=[];
  for(const [deck,y,level] of [[SECOND_DECK,4.8,1],[THIRD_DECK,9.6,2]] as const){
    fixtureFloor=y;for(const c of deck.cells){
      const x=c.x*4,z=c.z*4,hole=level===2&&HIGH_STAIRS.some(s=>x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ);
      const theme=deckTheme({x,z},level),floor:MaterialKey=theme==='濡れ縁'?'stone':theme==='石蔵'?'concrete':'planks';
      if(!hole)box(x,y-.12,z,4,.24,4,floor);
      const stairOpening=HIGH_STAIRS.some(s=>x>=s.minX&&x<=s.maxX&&z>=s.minZ&&z<=s.maxZ);
      if(!stairOpening||level===2)box(x,y+4.3,z,4,.2,4,'dark');
      if(!hole)box(x,y+.005,z,.02,.012,4,'dark');
      if(!stairOpening){if((c.x+c.z)%2===0){box(x,y+4.02,z,4,.18,.13,'wood');box(x,y+4.05,z,.12,.12,4,'wood');}if((c.x+c.z)%5===0)lantern(x,y+3.2,z);}
    }
    for(const w of deck.walls){const x=(w.minX+w.maxX)/2,z=(w.minZ+w.maxZ)/2,theme=deckTheme({x,z},level),m:MaterialKey=theme==='石蔵'?'concrete':theme==='鏡廊'?'steel':theme==='朱塗りの間'?'red':'plaster';box(x,y+2.1,z,w.maxX-w.minX,4.2,w.maxZ-w.minZ,m);box(x,y+.25,z,w.maxX-w.minX+.02,.5,w.maxZ-w.minZ+.02,'dark');}
  }
  for(const [deck,y,level] of [[SECOND_DECK,4.8,1],[THIRD_DECK,9.6,2]] as const){
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const x=(-19+col*12)*4,z=(19+row*12)*4,theme=deckTheme({x,z},level);
      for(const side of [-1,1]){const px=x+side*7,pz=z+7;
        if(theme==='鏡廊'){box(px,y+1.6,pz,1.5,2.7,.2,'steel');box(px,y+.2,pz,1.8,.4,.6,'dark');}
        else if(theme==='濡れ縁'||theme==='石蔵'){box(px,y+.35,pz,2,.7,1.8,'stone');box(px,y+.71,pz,1.7,.02,1.5,'water');}
        else {box(px,y+1,pz,1.8,2,.7,'wood');for(const h of [.4,1,1.6]){box(px,y+h,pz-.4,1.8,.08,.9,'dark');for(let i=-1;i<=1;i++)cylinder(px+i*.5,y+h+.25,pz-.35,.14,.4,theme==='祭具庫'?'gold':'rope');}}

      }
    }
  }
  for(const s of HIGH_STAIRS){
    for(let i=0;i<24;i++){const d=(s.maxZ-s.minZ)/24,h=(i+1)*4.8/24;box((s.minX+s.maxX)/2,4.8+h/2,s.minZ+(i+.5)*d,4,h,d,'wood');}
    for(const x of [s.minX,s.maxX]){const curve=new THREE.LineCurve3(new THREE.Vector3(x,5.9,s.minZ),new THREE.Vector3(x,10.7,s.maxZ));add(new THREE.TubeGeometry(curve,1,.06,6,false),'gold');}
  }
  for(const w of highCaps)box((w.minX+w.maxX)/2,10.15,(w.minZ+w.maxZ)/2,4,1.1,.2,'dark');
  for(const stair of [...STAIRS.map(s=>({...s,low:0,high:4.8})),...HIGH_STAIRS.map(s=>({...s,low:4.8,high:9.6}))]){
    const mid=(stair.minX+stair.maxX)/2;
    for(let i=0;i<24;i++){const z=stair.minZ+(i+.02)*(stair.maxZ-stair.minZ)/24,y=stair.low+(i+1)*(stair.high-stair.low)/24;box(mid,y+.012,z,stair.maxX-stair.minX-.12,.028,.07,'gold');}
    for(const [z,y,color] of [[stair.minZ-1,stair.low,'#8daebe'],[stair.maxZ+1,stair.high,'#e7af68']] as const){
      for(const x of [stair.minX+.08,stair.maxX-.08]){box(x,y+1.15,z,.06,2.3,.07,'gold');box(x,y+1.45,z,.085,.64,.09,'washiLit');fixture(x,y+1.7,z,color,y);}
      box(mid,y+2.8,z,stair.maxX-stair.minX,.14,.18,'wood');
    }
  }
  for(const {material:m,geometries} of batches.values()){const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,mats[m]);mesh.castShadow=!['lightSpill','light','coolLight','grass'].includes(m);mesh.receiveShadow=mesh.castShadow||m==='grass';mesh.updateMatrixWorld(true);mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;merged.computeBoundingSphere();staticChunks.push({mesh,center:merged.boundingSphere!.center,radius:merged.boundingSphere!.radius});scene.add(mesh);}geometries.forEach(g=>g.dispose());}
  for(const body of lanternTemplates){body.shade.dispose();body.caps.dispose();body.ribs.dispose();}
  const circusMeshes=circusPlan?createCircusDynamics(circusPlan,mats):undefined;if(circusMeshes)scene.add(circusMeshes.group);
  const scannedProps=new ScannedProps(scene,scannedPlacements,!rendererOverride);
  const shrubs=new ShrubMeshes(scene,landforms?shrubPlacements(layout,seed,landforms.height,obstacles):[],budget.mobile,!rendererOverride);
  obstacles.push(...goal.walls);
  const enemyWalls=[...obstacles,...STAIRS],enemies=new Enemies(layout.cells,enemyWalls),doorMeshes=createDoorMeshes(scene,doors,gothic),enemyMeshes=createEnemyMeshes(scene,enemies);
  const upperFixed=[...SECOND_DECK.walls,...deckFurnitureWalls(4.8),...highRails,...upperPartitions,...upperBarriers,...stairRails,...doors.framesFor(UPPER_HEIGHT)];
  const beads=[...placeMagatama(layout.rooms,obstacles,upperFixed),...placeRedMagatama(layout.cells,enemies.nodes.values(),obstacles,seededRandom(seed^0x5231))];
  const goldPoints=[...enemies.nodes.values()].filter(p=>layout.grid.get(Math.round(p.x/4)+','+Math.round(p.z/4))?.kind==='yokocho'&&!obstacles.some(o=>p.x>o.minX-1&&p.x<o.maxX+1&&p.z>o.minZ-1&&p.z<o.maxZ+1));
  const pursuer=enemies.actors.find(e=>e.kind==='danger')!;if(goldPoints.length){const home=goldPoints.reduce((a,b)=>Math.hypot(a.x-SPAWN.x,a.z-SPAWN.z)>Math.hypot(b.x-SPAWN.x,b.z-SPAWN.z)?a:b);pursuer.home={...home};pursuer.position={...home};}
  if(!goldPoints.length)throw new Error('No accessible gold location');
  beads.push({id:'gold-yokocho',position:{...goldPoints[Math.floor(runRandom()*goldPoints.length)]},floor:0,color:'gold',collected:false,offered:false});
  const beadMeshes=createMagatamaMeshes(scene,beads);
  enemies.addPatrolTargets([...beads.map(b=>({id:'room:'+b.id,position:b.position,floor:b.floor})),...layout.expansionAreas.map(r=>({id:r.id,position:{x:(r.x1+r.x2)*2,z:(r.z1+r.z2)*2},floor:0}))]);
  const goalMeshes=createGoalMeshes(scene,goal);
  const burstRecharge=new BurstRecharge(),timeStop=new TimeStop(),stamina=new Stamina(),run=new RunProgress();let environmentTime=0;
  let goalBlockers=goal.blockers();
  const thirdFixed=[...THIRD_DECK.walls,...deckFurnitureWalls(9.6),...highRails,...highCaps];
  let groundDoors=doors.blockers(),upperDoorBlocks=doors.blockers(UPPER_HEIGHT);
  const emptyMechanisms:import('./movement.ts').Obstacle[]=[];
  let mechanisms=circusRuntime?.blockers()??emptyMechanisms,playerMechanisms=circusRuntime?.blockers(!circusRuntime.riding)??emptyMechanisms;
  let groundBase=[...obstacles,...groundDoors,...goalBlockers],enemyBase=[...enemyWalls,...groundDoors,...goalBlockers];
  let groundCollision=combineObstacles(groundBase,playerMechanisms),groundEnemyCollision=combineObstacles(enemyBase,mechanisms),upperCollision=[...upperFixed,...upperDoorBlocks];
  enemies.setMechanismBlockers(mechanisms);
  const refreshCollision=()=>{const g=doors.blockers(),u=doors.blockers(UPPER_HEIGHT),seal=goal.blockers(),m=circusRuntime?.blockers()??emptyMechanisms,p=circusRuntime?.blockers(!circusRuntime.riding)??emptyMechanisms;const baseChanged=g!==groundDoors||seal!==goalBlockers;
    if(baseChanged){groundDoors=g;goalBlockers=seal;groundBase=[...obstacles,...g,...seal];enemyBase=[...enemyWalls,...g,...seal];}
    if(baseChanged||p!==playerMechanisms){playerMechanisms=p;groundCollision=combineObstacles(groundBase,p);}
    if(baseChanged||m!==mechanisms){mechanisms=m;groundEnemyCollision=combineObstacles(enemyBase,m);enemies.setMechanismBlockers(m);}
    if(u!==upperDoorBlocks){upperDoorBlocks=u;upperCollision=[...upperFixed,...u];}};
  let elevation=0,collision=groundCollision,reflectionEnabled=true;
  const mirror=new Reflector(new THREE.PlaneGeometry(4.7,6.7),{textureWidth:budget.mobile?1:512,textureHeight:budget.mobile?1:512,color:0x293d38});mirror.rotation.x=-Math.PI/2;mirror.position.set(poolPosition.x,.03,poolPosition.z);scene.add(mirror);water.visible=false;
  const outdoorReflection=landforms&&!budget.mobile&&!rendererOverride?new OutdoorReflection(waterReflection,landforms.tilemetadata):undefined;
  const reflectionExcluded=[...staticChunks.filter(c=>c.mesh.material===mats.water).map(c=>c.mesh),mirror,water];
  const dustGeometry=new THREE.BufferGeometry(),dust=new Float32Array(900*3);
  for(let i=0;i<900;i++){const c=layout.cells[(i*137)%layout.cells.length];dust[i*3]=c.x*4+Math.sin(i*2.13)*1.7;dust[i*3+1]=.4+(i%37)/37*2.7;dust[i*3+2]=c.z*4+Math.cos(i*3.17)*1.7;}
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dust,3));const dustMaterial=new THREE.PointsMaterial({color:'#a6a090',size:.024,transparent:true,opacity:.12,depthWrite:false});scene.add(new THREE.Points(dustGeometry,dustMaterial));
  const fixtureLighting=new FixtureLighting(),fixtureShadow=new FixtureShadow(scene),lightFixtures=lanterns.map((position,id)=>({id,position,floor:fixtureFloors.get(position)??0,color:fixtureColors.get(position)??'#ffc184',shadowPosition:fixtureShadowPositions.get(position),power:fixturePowers.get(position)??7}));
  const lightPool=Array.from({length:6},()=>{const p=new THREE.PointLight('#ffc184',0,11,2);scene.add(p);return p;});
  const flashlight=new THREE.SpotLight('#edf1ee',42,36,.72,.4,2),flashlightRight=new THREE.Vector3();flashlight.position.copy(camera.position);scene.add(flashlight,flashlight.target);
  renderer.shadowMap.type=THREE.PCFShadowMap;flashlight.castShadow=true;flashlight.shadow.mapSize.set(1024,1024);flashlight.shadow.bias=-.00015;flashlight.shadow.normalBias=.03;flashlight.shadow.camera.near=.1;flashlight.shadow.camera.far=36;
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;const ctx=glowCanvas.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,178,78,.36)');grad.addColorStop(.3,'rgba(255,112,31,.10)');grad.addColorStop(1,'rgba(255,100,20,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const glowTex=new THREE.CanvasTexture(glowCanvas),glowMat=new THREE.PointsMaterial({map:glowTex,color:'#ffffff',size:1.1,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  lampHaloFinish(glowMat);
  const glowGeometry=new THREE.BufferGeometry().setFromPoints(lanterns.filter(p=>!fixtureColors.has(p)));scene.add(new THREE.Points(glowGeometry,glowMat));
  let lastLight=-Infinity,lastLightFrame=0,disposed=false,configuredQuality:Preferences['quality']|null=null;const direction=new THREE.Vector3(),moodTarget=new THREE.Color('#080c0d');
  let effects:ReturnType<typeof createEffects>|undefined;
  const mirrorPoints=enemies.patrolTargets.filter(t=>t.floor>0||Math.hypot(t.point.x-goal.altar.x,t.point.z-goal.altar.z)>8).map(t=>({...t,random:runRandom()})).sort((a,b)=>a.random-b.random);
  const mirrorPickups:import('./mirror-inventory.ts').MirrorPickup[]=[];
  for(const floor of [0,4.8,9.6])for(const t of mirrorPoints.filter(t=>Math.abs(t.floor-floor)<.3)){if(mirrorPickups.filter(p=>p.floor===floor).length>=4)break;if(mirrorPickups.some(p=>p.floor===floor&&Math.hypot(p.position.x-t.point.x,p.position.z-t.point.z)<15))continue;mirrorPickups.push({id:'mirror-'+mirrorPickups.length,position:{...t.point},floor,collected:false});}
  const mirrorInventory=new MirrorInventory(mirrorPickups),mirrorMeshes=createMirrorMeshes(scene,mirrorPickups);
  let selectedQuality:Preferences['quality']='medium';
  const resizeTargets=()=>{renderer.setPixelRatio(budget.pixelRatio(selectedQuality,innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);effects?.resize();};
  const moods={shop:new THREE.Color('#17100b'),factory:new THREE.Color('#090f14'),bath:new THREE.Color('#0c1715'),cistern:new THREE.Color('#071114'),cave:new THREE.Color('#070d10'),field:new THREE.Color('#17212b'),shrine:new THREE.Color('#100c09')};
  const surfaces=new SurfaceLibrary(Object.values(mats),renderer.capabilities.getMaxAnisotropy());
  surfaces.setLightingFinish(finiteFixture);
  surfaces.preserveBaseFinish(mats.water,mats.light,mats.washiLit,mats.coolLight,mats.circusGlow,mats.circusRed,mats.circusIvory,mats.tatamiTrim,mats.outdoorTimber);
  const linenTargets=circus?[mats.circusRed,mats.circusIvory]:gothic?[]:[mats.tatamiTrim];
  if(linenTargets.length)surfaces.add('/materials/textile/rough_linen_diff_1k.jpg',linenTargets,{normal:'/materials/textile/rough_linen_nor_gl_1k.jpg',roughness:'/materials/textile/rough_linen_rough_1k.jpg',repeat:[1/.2707081393,1/.2712999880],normalStrength:.4,preserveFinish:true,lowSize:256,ultra:{full:'/materials/textile/rough_linen_diff_2k.jpg',normal:'/materials/textile/rough_linen_nor_gl_2k.jpg',roughness:'/materials/textile/rough_linen_rough_2k.jpg'}});
  surfaces.add('/cedar.png',[mats.red],{bump:.003,tint:gothic?'#462129':undefined});
  surfaces.add('/weathered-concrete.png',[mats.stone],{bump:.014,tint:'#aaa9a2'});
  surfaces.add('/rusted-steel.png',[mats.steel],{bump:.008,tint:'#8a9292'});
  const photographic=(id:string,targets:THREE.MeshStandardMaterial[],tint:string|undefined,preserveFinish=false,normalStrength=1)=>surfaces.add('/materials/'+id+'_diff.jpg',targets,{tint,normal:'/materials/'+id+'_nor_gl.jpg',roughness:'/materials/'+id+'_rough.jpg',preserveFinish,normalStrength,ultra:['wood_planks','clay_plaster','rust_coarse_01','cobblestone_floor_001'].includes(id)?{full:'/materials/ultra/'+id+'_diff_2k.jpg',normal:'/materials/ultra/'+id+'_nor_gl_2k.jpg',roughness:'/materials/ultra/'+id+'_rough_2k.jpg'}:undefined});
  mats.planks.color.set('#d8c5ad');mats.wood.color.set('#d9d0c2');mats.dark.color.set('#afa596');
  photographic('wood_planks',[mats.planks,mats.wood,mats.dark,mats.outdoorTimber],gothic?'#847d74':undefined,true,.65);
  photographic('rock_face_03',[mats.rock],'#b6b2a7',true,.8);
  mats.plaster.color.set('#c8b49b');photographic('clay_plaster',[mats.plaster,mats.pottery],undefined,true,.6);
  const interior=(id:string,targets:THREE.MeshStandardMaterial[],normalStrength:number,tint:string)=>surfaces.add('/materials/interior/'+id+'/'+id+'_diff_1k.jpg',targets,{tint,normal:'/materials/interior/'+id+'/'+id+'_nor_gl_1k.jpg',roughness:'/materials/interior/'+id+'/'+id+'_rough_1k.jpg',normalStrength,lowSize:256});
  interior('decrepit_wallpaper',[mats.paper],.35,'#d7cdb9');
  interior('tatami_mat',[mats.tatami],.45,'#d2c8a7');
  mats.rust.color.set('#d0b8a3');photographic('rust_coarse_01',[mats.rust,mats.roofMetal],undefined,false,.7);
  mats.pavement.color.set('#9caaa4');
  photographic('cobblestone_floor_001',[mats.pavement,mats.wetPavement],undefined,true,.9);
  photographic('concrete_floor_worn_001',[mats.concrete],gothic?'#898893':'#c1c1b7',false,.7);
  const wallRoot='/materials/urban/concrete_wall_007';
  if(!gothic)surfaces.add(wallRoot+'_diff_1k.jpg',[mats.concreteWall],{tint:'#b4b6ad',normal:wallRoot+'_nor_gl_1k.jpg',roughness:wallRoot+'_rough_1k.jpg',normalStrength:.65,preserveFinish:true,ultra:{full:wallRoot+'_diff_2k.jpg',normal:wallRoot+'_nor_gl_2k.jpg',roughness:wallRoot+'_rough_2k.jpg'}});
  surfaces.add('/materials/outer/grass_path_2_diff_1k.jpg',[mats.earth],{tint:'#a4a38c',normal:'/materials/outer/grass_path_2_nor_gl_1k.jpg',roughness:'/materials/outer/grass_path_2_rough_1k.jpg',normalStrength:.7,preserveFinish:true});
  if(landforms)surfaces.add('/materials/bank/aerial_grass_rock_diff_1k.jpg',[mats.bank],{normal:'/materials/bank/aerial_grass_rock_nor_gl_1k.jpg',roughness:'/materials/bank/aerial_grass_rock_rough_1k.jpg',normalStrength:.8,preserveFinish:true,lowSize:256,repeat:[.2,.2],ultra:{full:'/materials/bank/aerial_grass_rock_diff_2k.jpg',normal:'/materials/bank/aerial_grass_rock_nor_gl_2k.jpg',roughness:'/materials/bank/aerial_grass_rock_rough_2k.jpg'}});
  mats.concrete.roughness=1;mats.stone.roughness=.78;mats.stone.metalness=0;
  mats.rock.roughness=1;mats.plaster.roughness=1;mats.rust.roughness=1;mats.rust.metalness=0;mats.steel.roughness=.7;
  const floorLevel=()=>floorBand(elevation);
  const fixedFor=(level:number)=>level>9?thirdFixed:level>4?upperFixed:obstacles;
  const collisionFor=()=>elevation>9.3?thirdFixed:elevation>4.5?upperCollision:groundCollision;
  finiteSceneFixtures(scene);
  const scanLighting=pendingFixtureFinish(scannedProps.ready,scene);
  return {renderer,scene,camera,layout,stage,scannedReady:Promise.all([scanLighting.ready,shrubs.ready]),
    setMode(mode:PlayMode){circusRuntime?.reset();refreshCollision();playMode=mode;if(mode==='gallery'){goal.offer({blue:0,red:0,gold:1});}enemies.difficulty=stageRules(stage,mode);enemies.reset();enemyMeshes.setEnabled(mode!=='gallery');},
    get playMode(){return playMode;},
    get riding(){return circusRuntime?.riding??false;},
    circusStatus(){return circusRuntime?.snapshot()??null;},
    circusHint(){if(!circusRuntime||!circusPlan||elevation>2.2)return '';const status=circusRuntime.snapshot();if(status.riding)return (status.speed<.05?'トロッコ待機中':'トロッコ乗車中')+' · 次は'+circusPlan.stations[status.destination].name+' · 自動降車';const station=circusPlan.stations.map(s=>({...s,d:Math.hypot(s.exit.x-camera.position.x,s.exit.z-camera.position.z)})).sort((a,b)=>a.d-b.d)[0];return station.d<36?station.name+' '+Math.round(station.d)+'m · 〇で呼ぶ・乗る':'';},
    mechanismNear(){return circusRuntime?.near(camera.position,camera.rotation.y)?.label??'';},
    mirrorStatus(){return mirrorInventory.snapshot();},
    useMirror(){return playMode!=='gallery'&&mirrorInventory.use();},
    stairHint(){const options=[...STAIRS.map(s=>({...s,low:0,high:4.8})),...HIGH_STAIRS.map(s=>({...s,low:4.8,high:9.6}))].flatMap(s=>[{x:(s.minX+s.maxX)/2,z:s.minZ-2,floor:s.low,to:s.high,up:true},{x:(s.minX+s.maxX)/2,z:s.maxZ+2,floor:s.high,to:s.low,up:false}]).filter(s=>Math.abs(s.floor-elevation)<.6).map(s=>({...s,d:Math.hypot(s.x-camera.position.x,s.z-camera.position.z)})).sort((a,b)=>a.d-b.d);const s=options[0];return s&&s.d<22?(s.up?'↑ ':'↓ ')+(['一層','二層','三層'][Math.round(s.to/4.8)])+'への階段 · '+Math.round(s.d)+'m':'';},
    get obstacles(){return collision;},flashlight,
    observeFrame(ms:number,active:boolean){if(budget.observe(ms,active))resizeTargets();},
    get altarPosition(){return {...goal.altar};},
    get goalPosition(){return {x:GOAL.x+goal.offset.x,z:GOAL.z+goal.offset.z};},
    get completed(){return goal.completed;},
    get phaseRevision(){return phaseRevision;},
    get finale(){return enemies.finalKind;},
    get burstCooldown(){return burstRecharge.remaining;},
    get timeStopped(){return timeStop.active;},
    get timeStopRemaining(){return timeStop.remaining;},
    get timeStopCooldown(){return timeStop.cooldown;},
    stopTime(){const used=playMode!=='gallery'&&!goal.completed&&timeStop.use();if(used)run.freezes++;return used;},
    runStatus(){return run.snapshot();},
    staminaStatus(){return stamina.snapshot();},
    goalDirection(){return enemyDirection(camera.position,goal.altar,camera.rotation.y);},
    collection(){return {...beadInventory(beads),areaName:areaName(),blueOffered:goal.blueOffered,redOffered:goal.redOffered,finale:enemies.finalKind,unlocked:goal.unlocked,area:areaAt(camera.position,elevation)};},
    move(x:number,z:number,yaw:number,sprint:boolean,dt:number){
      if(goal.completed)return {x:camera.position.x,z:camera.position.z,y:camera.position.y,running:false};
      if(circusRuntime?.riding){stamina.step(dt,false,false,false);lastMotion={running:false,moving:false};const p=circusRuntime.snapshot().cart;return {...p,running:false};}
      refreshCollision();collision=collisionFor();
      const allowed=sprint&&stamina.canSprint,pos=movePlayer(camera.position,x,z,yaw,allowed,dt,collision),moving=Math.hypot(pos.x-camera.position.x,pos.z-camera.position.z)>.0001;stamina.step(dt,sprint,moving,allowed&&moving);lastMotion={running:allowed&&moving,moving};elevation=floorHeightAt(pos,elevation);return {...pos,y:elevation+1.68,running:allowed&&moving};
    },
    enemyDirections(){return !mirrorInventory.active||playMode==='gallery'?[]:enemies.actors.map(e=>({id:e.id,...enemyDirection(camera.position,e.position,camera.rotation.y),stunned:e.brain.mode==='stunned',level:enemyFloorHint(elevation,e.floor),chasing:e.brain.mode==='chase'}));},
    nearDoor(){return !!doors.nearest(camera.position,camera.rotation.y,fixedFor(floorLevel()),floorLevel());},
    nearAltar(){return playMode!=='gallery'&&goal.nearAltar(camera.position,camera.rotation.y,elevation,collision);},
    interact(){if(circusRuntime){const action=circusRuntime.interact(camera.position,camera.rotation.y);if(action.handled){if(action.position){elevation=0;camera.position.copy(action.position as THREE.Vector3);}refreshCollision();collision=collisionFor();return {kind:'mechanism' as const,message:action.message};}}if(playMode!=='gallery'&&goal.nearAltar(camera.position,camera.rotation.y,elevation,collision)){const used=goal.offer(beadInventory(beads));spendBeads(beads,used);return used.blue||used.red||used.gold?'offered':'empty';}return doors.interact(camera.position,camera.rotation.y,fixedFor(floorLevel()),floorLevel());},
    burst(){if(playMode==='gallery'||goal.completed||!burstRecharge.use())return null;const hits=enemies.burst(camera.position,[...collision,...STAIR_LIGHT_VOLUMES],elevation,camera.rotation.y,camera.rotation.x);run.stuns+=hits;return hits;},
    step(dt:number){
      if(goal.completed)return false;
      burstRecharge.step(dt);mirrorInventory.step(dt);
      const liveDt=timeStop.step(dt);environmentTime+=liveDt*1000;
      if(circusRuntime){const occupants=[...(circusRuntime.riding?[]:[{x:camera.position.x,z:camera.position.z,y:elevation+1.68}]),...(playMode==='gallery'?[]:enemies.actors.map(e=>({...e.position,y:e.floor+1.68})))];const ride=circusRuntime.step(liveDt,occupants);if(ride.position){camera.position.set(ride.position.x,ride.position.y,ride.position.z);elevation=0;lastMotion={running:false,moving:false};}if(ride.lure&&playMode!=='gallery'&&liveDt>0)enemies.hear(ride.lure,0);}
      const detectable=flashlight.visible||(lastMotion.running&&lastMotion.moving);
      if(runningSteps.update(dt,lastMotion.running,lastMotion.moving)){
        if(playMode!=='gallery'&&liveDt>1e-6)enemies.hear(camera.position,elevation);
        const cell=layout.grid.get(Math.round(camera.position.x/4)+','+Math.round(camera.position.z/4));footsteps.play(['stone','factory','bath','cistern','cave'].includes(cell?.kind??''));
      }
      lastMotion={running:false,moving:false};
      if(playMode!=='gallery'&&liveDt>1e-6)for(const e of enemies.actors)openPursuedDoor(doors,e,e.floor>9.3?thirdFixed:e.floor>4.5?upperFixed:enemyWalls,liveDt);
      doors.update(dt,camera.position,floorLevel());refreshCollision();collision=collisionFor();
      mirrorInventory.collect(camera.position,elevation,collision);
      const uncollected=beads.filter(b=>!b.collected);collectMagatama(beads,camera.position,elevation,collision);for(const b of uncollected)if(b.collected)run.pickup(b.color);
      const inventory=beadInventory(beads),totals={blue:inventory.blue+goal.blueOffered,red:inventory.red+goal.redOffered,gold:inventory.gold+goal.goldOffered};
      if(playMode!=='gallery'&&!enemies.finalKind&&collectionReady(totals)){enemies.beginFinale(camera.position,elevation,runRandom);mirrorInventory.grant(2);run.beginFinale();phaseRevision++;}
      const burden=Math.max(totals.blue/BEAD_REQUIREMENTS.blue,totals.red/BEAD_REQUIREMENTS.red,totals.gold);enemies.pressure=Math.min(1,burden);
      goal.update(dt,playMode==='gallery'?{x:10000,z:10000}:camera.position,elevation);refreshCollision();collision=collisionFor();
      const caught=playMode!=='gallery'&&!goal.completed&&liveDt>1e-6&&enemies.update(liveDt,camera.position,groundEnemyCollision,elevation,upperCollision,detectable,thirdFixed,flashlight.visible);
      const activeChase=!goal.completed&&enemies.actors.some(e=>e.brain.mode==='chase');
      const activeSearch=!goal.completed&&enemies.actors.some(e=>e.brain.mode!=='stunned'&&e.investigate&&e.searchTime>0&&Math.abs(e.floor-elevation)<1&&Math.hypot(e.position.x-camera.position.x,e.position.z-camera.position.z)<28);
      const stunned=!activeChase&&!activeSearch&&enemies.actors.some(e=>e.brain.mode==='stunned'&&(!!enemies.finalKind||Math.abs(e.floor-elevation)<1&&Math.hypot(e.position.x-camera.position.x,e.position.z-camera.position.z)<28));
      const threatDistance=Math.min(...enemies.actors.filter(e=>activeChase?e.brain.mode==='chase':e.brain.mode!=='stunned'&&e.investigate&&e.searchTime>0&&Math.abs(e.floor-elevation)<1).map(e=>Math.hypot(e.position.x-camera.position.x,e.position.z-camera.position.z,e.floor-elevation)));
      run.step(dt,{chasing:activeChase,searching:activeSearch,hidden:!detectable&&!enemies.finalKind,frozen:timeStop.active,stunned,burden,finale:!!enemies.finalKind,distance:threatDistance});
      if(caught){circusRuntime?.reset();phaseRevision++;elevation=0;run.defeated();stamina.reset();mirrorInventory.reset();enemies.pressure=0;enemies.reset();goal.reset();for(const b of beads){b.collected=false;b.offered=false;}refreshCollision();collision=groundCollision;
        const safe=[...enemies.nodes.values()].filter(p=>Math.hypot(p.x-camera.position.x,p.z-camera.position.z)>24&&enemies.actors.every(e=>Math.hypot(p.x-e.home.x,p.z-e.home.z)>24)&&!groundCollision.some(o=>p.x>o.minX-.6&&p.x<o.maxX+.6&&p.z>o.minZ-.6&&p.z<o.maxZ+.6));
        const spawn=safe[Math.floor(runRandom()*safe.length)]??SPAWN;camera.position.set(spawn.x,1.68,spawn.z);lastMotion={moving:false,running:false};return true;}return false;
    },
    configure(p:Preferences){
      stamina.setEnabled(p.stamina);
      renderer.toneMappingExposure=p.brightness*.88;
      camera.fov=p.fov;camera.updateProjectionMatrix();
      selectedQuality=p.quality;const quality=budget.quality(p.quality);
      if(stage==='outer'){
        if(quality!=='low'&&!nightSky&&!skyRequested&&!rendererOverride){skyRequested=true;new HDRLoader().load('/materials/outer/qwantani_moonrise_puresky_1k.hdr',texture=>{if(disposed){texture.dispose();return;}try{nightSkyTarget=prepareNightSky(renderer,texture);nightSky=nightSkyTarget.texture;}finally{texture.dispose();}if(configuredQuality!=='low'){scene.background=nightSky;mats.water.envMap=nightSky;mats.water.envMapIntensity=.018;mats.water.needsUpdate=true;}});}
        scene.background=quality!=='low'&&nightSky?nightSky:backgroundColor;scene.backgroundIntensity=.018;const waterSky=quality!=='low'?nightSky??null:null;if(mats.water.envMap!==waterSky){mats.water.envMap=waterSky;mats.water.needsUpdate=true;}mats.water.envMapIntensity=waterSky?.018:0;
      }
      if(configuredQuality===quality)return;
      const wasUltra=configuredQuality==='ultra',ultra=quality==='ultra',high=quality==='high'||ultra;
      mats.circusRed.sheen=mats.circusIvory.sheen=high?.35:0;
      configuredQuality=quality;lastLight=-Infinity;surfaces.setQuality(quality);doorMeshes.setQuality(quality);enemyMeshes.setQuality(quality);scannedProps.setQuality(quality);shrubs.setQuality(quality);
      if(quality==='low'||wasUltra!==ultra){effects?.dispose();effects=undefined;}
      if(quality!=='low'&&!effects&&!rendererOverride)effects=createEffects(renderer,scene,camera,budget.mobile,ultra);
      resizeTargets();
      renderer.shadowMap.enabled=quality!=='low';
      const size=Math.min(renderer.capabilities.maxTextureSize??4096,ultra?4096:high?2048:1024);
      if(flashlight.shadow.mapSize.x!==size){flashlight.shadow.map?.dispose();flashlight.shadow.map=null;flashlight.shadow.mapSize.set(size,size);}
      if(quality==='low'&&flashlight.shadow.map){flashlight.shadow.map.dispose();flashlight.shadow.map=null;}
      flashlight.castShadow=quality!=='low';camera.fov=p.fov;camera.updateProjectionMatrix();
      flashlight.shadow.normalBias=ultra?.006:high?.010:.018;
      // Keep the angular filter footprint stable as the shadow atlas grows.
      flashlight.shadow.radius=size/1024*1.5;
      lightPool.forEach((light,i)=>{light.visible=i<(quality==='low'?3:6);});fixtureShadow.configure(quality,budget.mobile);
      reflectionEnabled=!circus&&quality!=='low'&&!budget.mobile;mirror.visible=reflectionEnabled;water.visible=!circus&&!reflectionEnabled;const reflectionSize=reflectionEnabled?(ultra?1024:high?768:384):1;mirror.getRenderTarget().setSize(reflectionSize,reflectionSize);
      effects?.configure(quality);glowMat.opacity=quality==='low'?.26:.12;
    },
    render(time:number){waterClock.value=environmentTime/1000;
      syncBankPath();
      if(circusRuntime)circusMeshes?.update(circusRuntime.snapshot(),environmentTime/1000,camera.position);
      const area=layout.grid.get(Math.round(camera.position.x/4)+','+Math.round(camera.position.z/4))?.kind;
      moodTarget.copy(area==='shop'||area==='factory'||area==='bath'||area==='cistern'||area==='cave'||area==='field'?moods[area]:moods.shrine);
      if(stage!=='shrine')moodTarget.lerp(stageFog,.72);
      scene.fog!.color.lerp(moodTarget,.025);backgroundColor.lerp(moodTarget,.025);
      (scene.fog as THREE.FogExp2).density=stage==='shrine'?(area==='field'?.019:configuredQuality==='low'?.027:.0205):Math.max(stageProfile.density,configuredQuality==='low'?.027:0);
      if(time-lastLight>220){
        fixtureLighting.select(camera.position,floorBand(elevation),lightFixtures,collisionFor(),configuredQuality==='low'?3:6);
        // At this distance exponential fog is already opaque; keep nearby detail intact.
        for(const c of staticChunks){const foliage=(c.mesh.material as THREE.Material).name==='grass',range=foliage?(configuredQuality==='low'?36:configuredQuality==='ultra'?72:60):configuredQuality==='low'?area==='field'?85:72:110;c.mesh.visible=c.center.distanceToSquared(camera.position)<(range+c.radius)**2;}
        mirror.visible=reflectionEnabled&&mirror.position.distanceToSquared(camera.position)<3600;water.visible=!circus&&!mirror.visible;
        lastLight=time;
      }
      camera.getWorldDirection(direction);flashlightRight.set(1,0,0).applyQuaternion(camera.quaternion);
      flashlight.position.copy(camera.position).addScaledVector(flashlightRight,.16);flashlight.position.y-=.20;
      flashlight.target.position.copy(camera.position).addScaledVector(direction,8);
      const lightDt=lastLightFrame?Math.min(.1,(time-lastLightFrame)/1000):.016;fixtureLighting.step(lightDt);lastLightFrame=time;
      const shadowOrigin=fixtureShadow.light.position;
      const movingShadow=!!circusRuntime&&(circusRuntime.snapshot().moving||circusRuntime.snapshot().devices.some(d=>d.progress!==d.target))||(playMode!=='gallery'&&enemies.actors.some(e=>Math.abs(e.floor-shadowOrigin.y)<5&&Math.hypot(e.position.x-shadowOrigin.x,e.position.z-shadowOrigin.z)<11))||doors.states.some(d=>d.progress>0&&d.progress<1&&Math.hypot(d.spec.x-shadowOrigin.x,d.spec.z-shadowOrigin.z)<11)||beads.some(b=>!b.collected&&Math.abs(b.floor-shadowOrigin.y)<5&&Math.hypot(b.position.x-shadowOrigin.x,b.position.z-shadowOrigin.z)<11)||(goal.progress>0&&goal.progress<1&&Math.hypot(goal.offset.x-shadowOrigin.x,GOAL.z+goal.offset.z-shadowOrigin.z)<11);
      fixtureShadow.update(fixtureLighting.slots,camera.position,lightDt,time,movingShadow);
      if(gothic)fixtureShadow.light.intensity*=.55;
      lightPool.forEach((l,i)=>{const slot=fixtureLighting.slots[i];if(slot.current){l.position.copy(slot.current.position as THREE.Vector3);l.color.set(slot.current.color);}l.intensity=(gothic?3.8:7)*((slot.current?.power??7)/7)*slot.gain*fixtureShadow.pointGain(slot.current?.id??-1)*(1+.012*Math.sin(environmentTime*.0021+(slot.current?.id??0)*2.3));});
      doorMeshes.update(camera.position,configuredQuality==='low'?72:110);
      scannedProps.update(camera.position);shrubs.update(camera.position);
      enemyMeshes.update(environmentTime,camera.position,configuredQuality==='low'?80:125,mirrorInventory.active&&playMode!=='gallery');mirrorMeshes.update(environmentTime);
      beadMeshes.update(environmentTime);
      goalMeshes.update();
      if(outdoorReflection){
        const active=outdoorReflection.update(renderer,scene,camera,time,configuredQuality==='ultra'&&area==='field'&&elevation<3,reflectionExcluded);
        if(active){mirror.visible=false;water.visible=!circus;}
      }
      if(effects)effects.render(mirrorInventory.active&&playMode!=='gallery');else {renderer.render(scene,camera);if(mirrorInventory.active&&playMode!=='gallery')renderEnemyEcho(renderer,scene,camera);}
    },
    resize(){resizeTargets();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();},
    dispose(){disposed=true;scanLighting.cancel();circusMeshes?.group.removeFromParent();circusMeshes?.dispose();scannedProps.dispose();shrubs.dispose();fixtureShadow.dispose();outdoorReflection?.dispose();nightSkyTarget?.dispose();mirrorMeshes.dispose();footsteps.dispose();goalMeshes.dispose();beadMeshes.dispose();effects?.dispose();environment?.dispose();surfaces.dispose();const geometrySet=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if(o instanceof THREE.Mesh)geometrySet.add(o.geometry);});geometrySet.forEach(g=>g.dispose());Object.values(mats).forEach(m=>{if('map'in m)m.map?.dispose();m.dispose();});doorMeshes.dispose(false);enemyMeshes.dispose();mirror.dispose();dustGeometry.dispose();dustMaterial.dispose();water.material.dispose();glowGeometry.dispose();glowMat.dispose();glowTex.dispose();flashlight.shadow.dispose();renderer.dispose();},
  };
}







