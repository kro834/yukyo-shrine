import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LORE,placeNotes,sanitizeArchive,noteById} from '../app/lore.ts';
import {STAGES,type StageId} from '../app/stage-profile.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {DEFAULTS} from '../app/preferences.ts';
import {surfaceFor,CueQueue} from '../app/world-cues.ts';
test('every stage has a three-line prologue and three uniquely identified documents',()=>{
 const ids=new Set<string>();
 for(const stage of Object.keys(STAGES) as StageId[]){
  const lore=LORE[stage];assert.equal(lore.prologue.length,3,stage);assert.equal(lore.notes.length,3,stage);
  for(const n of lore.notes){assert.ok(n.id.startsWith(stage+'-'));assert.ok(!ids.has(n.id));ids.add(n.id);assert.ok(n.title&&n.author&&n.body.length>40&&n.body.length<200,n.id);}
 }
 assert.equal(noteById('shrine-2')?.author,'ひより');assert.equal(noteById('missing'),undefined);
});
test('the archive keeps only known documents once',()=>{
 assert.deepEqual(sanitizeArchive(['shrine-1','shrine-1','abyss-9',7,'error-2']),['shrine-1','error-2']);
 assert.deepEqual(sanitizeArchive({}),[]);assert.deepEqual(sanitizeArchive(null),[]);
});
test('documents spread across floors and stay clear of the spawn, the altar and pickups',()=>{
 const sites=Array.from({length:60},(_,i)=>({point:{x:(i%10)*8,z:Math.floor(i/10)*8},floor:i<40?0:i<50?4.8:9.6}));
 const keepout=[{position:{x:0,z:0},floor:0,radius:17},{position:{x:72,z:40},floor:0,radius:9}];
 for(let seed=1;seed<40;seed++){
  const placed=placeNotes(sites,keepout,seededRandom(seed),3);
  assert.equal(placed.length,3);assert.equal(placed.filter(p=>p.floor===0).length,2);assert.equal(placed.filter(p=>p.floor>0).length,1);
  for(const p of placed)for(const k of keepout)assert.ok(p.floor!==k.floor||Math.hypot(p.point.x-k.position.x,p.point.z-k.position.z)>=k.radius);
  assert.ok(Math.hypot(placed[0].point.x-placed[1].point.x,placed[0].point.z-placed[1].point.z)>=16,'ground documents are spread apart');
 }
 assert.equal(placeNotes(sites.filter(s=>s.floor===0),keepout,seededRandom(2),3).length,3,'a stage without upper sites still receives every document');
 assert.deepEqual(placeNotes([],keepout,seededRandom(2),3),[]);
});
test('footstep surfaces follow the stage and ground under the visitor',()=>{
 assert.equal(surfaceFor('ultrareal','stone',0),'carpet');assert.equal(surfaceFor('shrine','field',0),'grass');assert.equal(surfaceFor('shrine','cave',0),'stone');
 assert.equal(surfaceFor('shrine','hall',0),'wood');assert.equal(surfaceFor('shrine','cave',4.8),'wood');assert.equal(surfaceFor('abyss','hall',0),'stone');
 const q=new CueQueue();for(let i=0;i<200;i++)q.push({kind:'mirror'});assert.equal(q.drain().length,96);assert.equal(q.drain().length,0);
});
test('the running world places three scrolls; walking over one records it and emits a cue once',t=>{
 t.mock.method(Enemies.prototype,'update',()=>false);
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},render(){},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,23,'abyss');
 try{
  world.configure({...DEFAULTS,quality:'low'});world.setMode('normal');world.drainCues();
  const scrolls=world.scene.children.filter(o=>o.name==='note-pickup');assert.equal(scrolls.length,3);assert.deepEqual(world.noteStatus(),{found:[],total:3});
  const ground=scrolls.find(o=>o.position.y<2)!;world.camera.position.set(ground.position.x,1.68,ground.position.z);world.step(.05);
  const found=world.noteStatus().found;assert.equal(found.length,1);assert.ok(found[0].startsWith('abyss-'));
  const cues=world.drainCues();assert.deepEqual(cues.filter(c=>c.kind==='note'),[{kind:'note',id:found[0]}]);
  world.step(.05);assert.equal(world.drainCues().filter(c=>c.kind==='note').length,0);world.render(100);assert.equal(ground.visible,false);
  assert.equal(world.stopTime(),true);assert.ok(world.drainCues().some(c=>c.kind==='time-stop'));
  for(let i=0;i<201;i++)world.step(.05);assert.ok(world.drainCues().some(c=>c.kind==='time-resume'));
 }finally{world.dispose();}
});
