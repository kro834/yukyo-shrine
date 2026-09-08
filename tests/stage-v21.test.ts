import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSectorLayout} from '../app/sector-layout.ts';
import {STAGES,stageRules,canTransitionStage,type StageId} from '../app/stage-profile.ts';
import {Doors,Enemies,segmentBlocked} from '../app/shrine-gameplay.ts';
import {createWorld} from '../app/shrine-world.ts';
import {RADIUS,type Obstacle,type Position} from '../app/movement.ts';
import {SPAWN} from '../app/shrine-layout.ts';
import {RED_AREAS} from '../app/area-rules.ts';
import {SurfaceLibrary} from '../app/surface-library.ts';
import {DEFAULTS,startupPreferences} from '../app/preferences.ts';
import {ContactOcclusion} from '../app/contact-occlusion.ts';
import {buildYokochoFront} from '../app/yokocho-front.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';

test('completed runs can select any stage while an active run cannot transition',()=>{
 for(const current of Object.keys(STAGES) as StageId[])for(const next of Object.keys(STAGES) as StageId[])for(const mode of ['gallery','normal','hard'] as const){
  assert.equal(canTransitionStage(mode,false,current,next),false);
  assert.equal(canTransitionStage(mode,true,current,next),true);
 }
});

function navigation(input:Map<string,Position>,walls:Obstacle[]){
 const expanded=walls.map(w=>({...w,minX:w.minX-RADIUS,maxX:w.maxX+RADIUS,minZ:w.minZ-RADIUS,maxZ:w.maxZ+RADIUS}));
 const clear=(a:Position,b:Position)=>!segmentBlocked(a,b,expanded),nodes=new Map([...input].filter(([,p])=>clear(p,p)));
 const queue=[...nodes].filter(([,p])=>Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<6&&clear(SPAWN,p)).map(([k])=>k),seen=new Set(queue);
 assert.ok(queue.length);
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i].split(',').map(Number);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(x+dx)+','+(z+dz);if(!seen.has(k)&&nodes.has(k)&&clear(nodes.get(queue[i])!,nodes.get(k)!)){seen.add(k);queue.push(k);}}}
 return {nodes,seen,reaches:(target:Position)=>[...seen].some(k=>Math.hypot(nodes.get(k)!.x-target.x,nodes.get(k)!.z-target.z)<6&&clear(nodes.get(k)!,target))};
}
test('all stage profiles generate distinct connected 5 by 5 topologies with reachable rooms and all objectives',()=>{
 const signatures=new Set<string>();
 for(const stage of Object.keys(STAGES) as StageId[])for(let seed=1;seed<=20;seed++){
  const l=createSectorLayout(seed,stage);assert.equal(l.sectors.length,25);assert.equal(l.rooms.length,87);assert.equal(l.rooms.filter(r=>r.bead).length,13);assert.equal(l.connections.size,STAGES[stage].links);
  assert.ok(l.connections.has('12:13')&&l.connections.has('13:18'));assert.equal(new Set(l.rooms.flatMap(r=>r.themeId?[r.themeId]:[])).size,stage==='error'?6:stage==='outer'?38:stage==='orchestra'?34:30);
  for(const k of [...RED_AREAS,'yokocho'])assert.ok(l.cells.some(c=>c.kind===k));
  assert.ok(l.rooms.some(r=>!r.bead&&r.x2-r.x1===2&&r.z2-r.z1===2));
  for(const r of l.rooms)assert.ok(l.doors.filter(d=>d.room===r.id||d.rooms?.includes(r.id)).length>=2);
  const nav=navigation(new Map(l.cells.map(c=>[c.x+','+c.z,{x:c.x*4,z:c.z*4}])),[...l.obstacles,...new Doors(l.doors).frames]);
  assert.equal(nav.seen.size,nav.nodes.size,stage+'/'+seed);
  signatures.add(stage+'/'+l.cells.map(c=>c.x+','+c.z).sort().join(';'));
 }
 assert.equal(signatures.size,Object.keys(STAGES).length*20);
 const shrine=createSectorLayout(7),abyss=createSectorLayout(7,'abyss'),outer=createSectorLayout(7,'outer');
 assert.notDeepEqual(shrine.cells.map(c=>[c.x,c.z]),abyss.cells.map(c=>[c.x,c.z]));assert.notDeepEqual(abyss.cells.map(c=>[c.x,c.z]),outer.cells.map(c=>[c.x,c.z]));
 assert.ok(stageRules('abyss','normal').search>stageRules('outer','normal').search);assert.ok(stageRules('outer','normal').sense>stageRules('abyss','normal').sense);
 assert.equal(stageRules('abyss','gallery').enemies,false);assert.ok(stageRules('abyss','hard').sense>stageRules('abyss','normal').sense);
});
test('new furnished stages can collect and offer every route, then physically enter the goal',t=>{
 const updateMock=t.mock.method(Enemies.prototype,'update',()=>false),hearMock=t.mock.method(Enemies.prototype,'hear',()=>0);
 const collectMock=t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 const add=Enemies.prototype.addPatrolTargets;let actual:Enemies|undefined,points:Parameters<Enemies['addPatrolTargets']>[0]=[];
 const patrolMock=t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:typeof points){actual=this;points=p;return add.call(this,p);});
 const doorMock=t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 for(const stage of ['abyss','outer','orchestra','circus','error'] as StageId[])for(const [seed,color] of [[1,'blue'],[17,'red'],[71,'gold']] as const){
  const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed,stage);
  try{
   w.setMode('normal');assert.equal(actual!.actors.length,12);assert.deepEqual(actual!.difficulty,stageRules(stage,'normal'));w.step(.05);
   const nav=navigation(actual!.nodes,w.obstacles),ground=points.filter(p=>p.floor===0&&p.id.startsWith('room:'));
   for(const p of ground)assert.ok(nav.reaches(p.position),stage+'/'+seed+'/'+p.id);
   assert.ok(nav.reaches({x:w.altarPosition.x,z:w.altarPosition.z-2}));
   const selected=ground.filter(p=>color==='gold'?p.id.includes('gold-'):color==='red'?p.id.includes('red-'):p.id.includes('expansion-')).slice(0,color==='blue'?6:color==='red'?2:1);
   assert.equal(selected.length,color==='blue'?6:color==='red'?2:1);
   for(const [i,p] of selected.entries()){w.camera.position.set(p.position.x,1.68,p.position.z);w.step(.05);assert.equal(!!w.finale,i===selected.length-1);}
   assert.equal(w.collection()[color],selected.length);
   assert.equal(actual!.actors.length,1);assert.equal(w.mirrorStatus().count,2);assert.equal(w.phaseRevision,1);
   assert.equal(w.useMirror(),true);for(let i=0;i<10;i++)w.step(.05);assert.equal(w.mirrorStatus().count,1);assert.equal(w.phaseRevision,1);
   w.camera.position.set(w.altarPosition.x,1.68,w.altarPosition.z-2);w.camera.rotation.y=Math.PI;assert.equal(w.interact(),'offered');
   for(let i=0;i<45;i++)w.step(.05);w.camera.position.set(w.goalPosition.x,1.68,w.goalPosition.z-1.5);
   for(let i=0;i<8;i++){const p=w.move(0,1,0,true,.05);w.camera.position.set(p.x,p.y,p.z);w.step(.05);}
   assert.equal(w.completed,true,stage+'/'+color);
  }finally{w.dispose();actual=undefined;points=[];for(const mocked of [updateMock,hearMock,collectMock,patrolMock,doorMock])mocked.mock.resetCalls();}
 }
});
test('Ultra maps are opt-in and late 2K downloads cannot override a newer Low choice',()=>{
 const callbacks=new Map<string,(t:THREE.Texture)=>void>(),loader={load(url:string,cb:(t:THREE.Texture)=>void){callbacks.set(url,cb);return new THREE.Texture();}} as THREE.TextureLoader;
 const g=globalThis as unknown as Record<string,unknown>;g.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})};
 const m=new THREE.MeshStandardMaterial(),lib=new SurfaceLibrary([m],16,loader);
 lib.add('1k',[m],{normal:'n1k',roughness:'r1k',ultra:{full:'2k',normal:'n2k',roughness:'r2k'}});callbacks.get('1k')!(new THREE.Texture({}));
 lib.setQuality('high');assert.equal(callbacks.has('2k'),false);lib.setQuality('ultra');assert.ok(callbacks.has('2k'));lib.setQuality('low');
 const full=new THREE.Texture({width:2048}),normal=new THREE.Texture();callbacks.get('2k')!(full);callbacks.get('n2k')!(normal);assert.notEqual(m.map,full);assert.equal(m.normalMap,null);
 lib.setQuality('ultra');assert.equal(m.map,full);assert.equal(m.normalMap,normal);assert.equal(full.anisotropy,16);lib.setQuality('high');assert.notEqual(m.map,full);lib.dispose();
 assert.equal(startupPreferences({...DEFAULTS,quality:'ultra'},true).quality,'low');assert.equal(startupPreferences({...DEFAULTS,quality:'ultra'},false).quality,'ultra');
 const pass=new ContactOcclusion(new THREE.Scene(),new THREE.PerspectiveCamera(),1280,720,true);pass.setSize(1920,1080);assert.equal(pass.normalRenderTarget.width,1440);assert.equal(pass.normalRenderTarget.height,810);assert.equal(pass.kernel.length,32);pass.dispose();
});
test('yokocho lower storefronts stay inside all four solid wall planes with overhead awning clearance',()=>{
 for(const alongX of [true,false])for(const sign of [-1,1])for(let v=0;v<6;v++)buildYokochoFront((x,y,z,w,h,d)=>{const front=(alongX?z:x)*sign+(alongX?d:w)/2;if(y-h/2<2.4)assert.ok(front<.001,'front must not project into walking clearance');else assert.ok(y-h/2>2.4);},0,0,alongX,alongX?0:sign,alongX?sign:0,v);
});
