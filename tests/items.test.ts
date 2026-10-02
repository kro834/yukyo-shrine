import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ItemBag,ITEM_CAPS,THROW,throwArc,ThrownBells,WARD,Wards,bellHear,placeItemPickups,collectItems,type ItemPickup,type ThrowPath} from '../app/item-bag.ts';
import {createItemMeshes} from '../app/item-mesh.ts';
import {Enemies,EnemyBrain,ENEMY_PROFILES,STUN_SECONDS,type Enemy} from '../app/shrine-gameplay.ts';
import {createLayout,SPAWN} from '../app/shrine-layout.ts';
import {createAreaLookup,AREA_MULTIPLIERS,RED_AREAS} from '../app/area-rules.ts';
import {ButtonEdges} from '../app/input-actions.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {STAND_EYE} from '../app/posture.ts';
import {createWorld} from '../app/shrine-world.ts';
import {DEFAULTS} from '../app/preferences.ts';
import type {Obstacle,Position} from '../app/movement.ts';
const eye={x:0,y:STAND_EYE,z:0},flat=()=>0;
const span=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
const close=(actual:number,expected:number,epsilon=1e-9,message?:string)=>assert.ok(Math.abs(actual-expected)<=epsilon,message??`${actual} ≉ ${expected}`);
type Mode='patrol'|'chase'|'stunned';
const actor=(position:Position,mode:Mode='chase',kind='normal',floor=0)=>({kind,floor,position,brain:{mode}}) as unknown as Enemy;
const recorder=()=>{const calls:{e:Enemy;seconds:number}[]=[];return {calls,stun:(e:Enemy,seconds:number)=>{calls.push({e,seconds});e.brain.mode='stunned';}};};
const arm=(wards:Wards,actors:readonly Enemy[]=[],stun=()=>{})=>{for(let t=0;t<WARD.arm-1e-9;t+=.05)assert.deepEqual(wards.step(.05,.05,actors,stun),[]);};

test('ItemBag: caps 3 bells and 2 wards, starts with one bell, nightmare with none',()=>{
 assert.deepEqual(ITEM_CAPS,{bell:3,ward:2});
 assert.deepEqual(new ItemBag().snapshot(),{bell:1,ward:0,selected:'bell'});
 assert.deepEqual(new ItemBag({bell:0}).snapshot(),{bell:0,ward:0,selected:'bell'},'nightmare');
 assert.equal(new ItemBag({bell:1+1}).bell,2,'静寂 adds a bell');
 assert.deepEqual(new ItemBag({bell:9,ward:-3}).snapshot(),{bell:3,ward:0,selected:'bell'});
 const bag=new ItemBag();
 assert.equal(bag.grant('bell',5),2);assert.equal(bag.bell,3);assert.equal(bag.grant('bell'),0);assert.equal(bag.bell,3);
 assert.equal(bag.grant('ward'),1);assert.equal(bag.grant('ward',4),1);assert.equal(bag.ward,2);assert.equal(bag.grant('ward'),0);
 assert.equal(bag.grant('ward',-2),0);assert.equal(bag.ward,2);
 assert.equal(bag.take('ward'),true);assert.equal(bag.ward,1);
 bag.loseCarried();assert.deepEqual([bag.bell,bag.ward],[0,0]);assert.equal(bag.take('bell'),false);assert.equal(bag.take('ward'),false);assert.equal(bag.bell,0);
});
test('ItemBag: cycle alternates the selection and select picks one directly',()=>{
 const bag=new ItemBag();assert.equal(bag.selected,'bell');
 assert.equal(bag.cycle(),'ward');assert.equal(bag.cycle(),'bell');assert.equal(bag.cycle(),'ward');assert.equal(bag.selected,'ward');
 bag.select('bell');assert.equal(bag.selected,'bell');bag.select('bell');assert.equal(bag.selected,'bell');
 bag.loseCarried();bag.select('ward');assert.equal(bag.snapshot().selected,'ward','an empty slot can still be selected');
});

test('throwArc: a level throw from standing eye height lands 9-14 m ahead on open ground',()=>{
 for(const yaw of [0,.7,Math.PI/2,2.5,-1.2,Math.PI]){
  const path=throwArc(eye,yaw,0,[],flat),d=span(eye,path.landing);
  assert.ok(d>=9&&d<=14,`yaw ${yaw}: ${d.toFixed(2)} m`);
  close(path.landing.x/d,-Math.sin(yaw),1e-9);close(path.landing.z/d,-Math.cos(yaw),1e-9);
  assert.deepEqual(path.points[0],eye);const last=path.points.at(-1)!;assert.equal(last.y,0);assert.deepEqual({x:last.x,z:last.z},path.landing);
  assert.ok(path.seconds>0&&path.seconds<THROW.maxSeconds);
  for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i];assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=THROW.substep+1e-9,'substep '+i);}
  assert.ok(path.points.slice(0,-1).every(p=>p.y>.05),'nothing touches the floor before the landing');
 }
 const low=span(eye,throwArc(eye,0,-.35,[],flat).landing),level=span(eye,throwArc(eye,0,0,[],flat).landing),high=span(eye,throwArc(eye,0,.3,[],flat).landing);
 assert.ok(low<level&&level<high,'aiming higher throws farther: '+[low,level,high].map(v=>v.toFixed(1)));
 assert.ok(high<=14.5,'a +0.3 rad throw stays near the 14 m upper reach');
});
test('throwArc: pitch is clamped to [-0.35, 0.75] before the loft; a bad pitch throws level',()=>{
 assert.deepEqual(throwArc(eye,.4,3,[],flat),throwArc(eye,.4,THROW.maxPitch,[],flat));
 assert.deepEqual(throwArc(eye,.4,-3,[],flat),throwArc(eye,.4,THROW.minPitch,[],flat));
 assert.deepEqual(throwArc(eye,.4,Number.NaN,[],flat),throwArc(eye,.4,0,[],flat));
 assert.notDeepEqual(throwArc(eye,.4,.7,[],flat).landing,throwArc(eye,.4,THROW.maxPitch,[],flat).landing);
 // The loft lifts the first step even when aiming level.
 assert.ok(throwArc(eye,0,0,[],flat).points[1].y>eye.y);
 assert.ok(throwArc(eye,0,THROW.minPitch,[],flat).points[1].y<eye.y,'the loft never cancels the steepest downward aim');
});
test('throwArc: an AABB wall stops the bell, which drops straight down and never crosses',()=>{
 for(let n=1;n<=100;n++)for(const [yaw,thick] of [[0,.05],[0,.001],[Math.PI/4,.02],[-.3,.3]] as const){
  // Forward at yaw 0 is -z: the wall's near face lies n·0.1 m ahead.
  const face=-(n*.1+.03),wall:Obstacle={minX:-80,maxX:80,minZ:face-thick,maxZ:face},path=throwArc(eye,yaw,0,[wall],flat);
  assert.ok(path.points.every(p=>p.z>wall.maxZ),`crossed at n=${n} yaw=${yaw}`);
  assert.ok(path.landing.z>wall.maxZ);
  const free=span(eye,throwArc(eye,yaw,0,[],flat).landing);
  if(free*Math.cos(yaw)>-face+.25){
   assert.ok(path.landing.z-wall.maxZ<=THROW.substep+1e-9,`landed ${path.landing.z-wall.maxZ} m short of the face at n=${n}`);
   const hit=path.points.findIndex(p=>p.x===path.landing.x&&p.z===path.landing.z);
   assert.ok(hit>=0&&path.points.slice(hit).every(p=>p.x===path.landing.x&&p.z===path.landing.z),'falls straight down');
   assert.ok(path.points.slice(hit+1).every((p,i)=>p.y<path.points[hit+i].y),'and only falls');
  }
  assert.equal(path.points.at(-1)!.y,0);
 }
});
test('throwArc: furniture below the arc is cleared; a tall box, a full wall or the map edge stops it',()=>{
 const plain=throwArc(eye,0,0,[],flat).landing;
 const stool:Obstacle={minX:-1,maxX:1,minZ:-4.5,maxZ:-4,minY:0,maxY:.5},cabinet={...stool,maxY:2.9},wall:Obstacle={minX:-1,maxX:1,minZ:-4.5,maxZ:-4};
 assert.deepEqual(throwArc(eye,0,0,[stool],flat).landing,plain);
 for(const o of [cabinet,wall])assert.ok(throwArc(eye,0,0,[o],flat).landing.z>-4);
 assert.ok(throwArc(eye,0,.3,[cabinet],flat).landing.z<-5,'a lob clears the cabinet');assert.ok(throwArc(eye,0,.3,[wall],flat).landing.z>-4);
 const lintel={...stool,minY:4,maxY:8};assert.deepEqual(throwArc(eye,0,0,[lintel],flat).landing,plain,'passes under a beam');
 const edge={x:0,y:STAND_EYE,z:-283};assert.ok(throwArc(edge,0,0,[],flat).landing.z>=-284,'the map bounds act as a wall');
});
test('throwArc: the bell lands on a rising floor sooner and a bottomless drop ends after 2 s',()=>{
 const slope=(p:Position)=>Math.max(0,-p.z)*.4,level=throwArc(eye,0,0,[],flat),up=throwArc(eye,0,0,[],slope);
 assert.ok(span(eye,up.landing)<span(eye,level.landing));close(up.points.at(-1)!.y,slope(up.landing));
 const pit=throwArc(eye,0,0,[],()=>-1000);close(pit.seconds,THROW.maxSeconds,1e-9);assert.equal(pit.points.at(-1)!.y,-1000);
 const lift={...eye,y:eye.y+30},on=throwArc(lift,0,0,[],()=>30);close(span(lift,on.landing),span(eye,level.landing),1e-9,'only the height above the floor matters');
 const start=throwArc({x:0,y:.02,z:0},0,THROW.minPitch,[],flat);assert.equal(start.points.length,2,'a throw from the floor lands at once');
});

const path=throwArc(eye,0,0,[],flat);
test('ThrownBells: a bell thrown during a time stop rings only once time resumes',()=>{
 const bells=new ThrownBells(),rings:{point:Position;floor:number}[]=[],onRing=(point:Position,floor:number)=>rings.push({point,floor});
 bells.throw(path,4.8);assert.equal(bells.items.length,1);
 for(let t=0;t<THROW.maxSeconds+1;t+=.05)bells.step(.05,0,onRing);
 assert.equal(bells.items[0].landed,true,'flight advances on real time');assert.equal(rings.length,0);assert.equal(bells.items[0].heard,false);
 assert.deepEqual(bells.positions()[0],path.points.at(-1));
 bells.step(.05,1e-7,onRing);assert.equal(rings.length,0,'a frozen frame is not live');
 bells.step(.016,.016,onRing);assert.deepEqual(rings,[{point:path.landing,floor:4.8}]);
 bells.step(.05,.05,onRing);bells.step(.05,.05,onRing);assert.equal(rings.length,1,'one ring per bell');
});
test('ThrownBells: in live time the ring comes on the landing frame, not before',()=>{
 const bells=new ThrownBells();let rings=0;bells.throw(path,0);
 let t=0;for(;t+.05<path.seconds;t+=.05){bells.step(.05,.05,()=>rings++);assert.equal(rings,0);assert.equal(bells.items[0].landed,false);}
 bells.step(.05,.05,()=>rings++);assert.equal(rings,1);assert.equal(bells.items[0].landed,true);
});
test('ThrownBells: throws are 0.8 s apart on real time',()=>{
 const bells=new ThrownBells();assert.equal(bells.canThrow(),true);bells.throw(path,0);assert.equal(bells.canThrow(),false);
 for(let i=0;i<15;i++){bells.step(.05,0,()=>{});assert.equal(bells.canThrow(),false,'at '+((i+1)*.05).toFixed(2)+' s');}
 bells.step(.05,0,()=>{});assert.equal(bells.canThrow(),true);
 bells.throw(path,0);assert.equal(bells.items.length,2);assert.equal(bells.canThrow(),false);
 bells.reset();assert.deepEqual([bells.items.length,bells.canThrow()],[0,true]);
});
test('ThrownBells: positions follow the arc and a rung bell lies 30 s of live time, then goes',()=>{
 const bells=new ThrownBells();bells.throw(path,0);
 assert.deepEqual(bells.positions(),[eye]);
 bells.step(path.seconds/2,0,()=>{});const mid=bells.positions()[0];
 assert.ok(mid.z<0&&mid.z>path.landing.z&&mid.y>0,JSON.stringify(mid));
 bells.step(path.seconds,.05,()=>{});assert.deepEqual(bells.positions(),[path.points.at(-1)]);
 for(let i=0;i<200;i++)bells.step(.05,0,()=>{});assert.equal(bells.items.length,1,'rest pauses with time');
 for(let t=0;t<THROW.restSeconds-.1;t+=.05)bells.step(.05,.05,()=>{});assert.equal(bells.items.length,1);
 for(let i=0;i<4;i++)bells.step(.05,.05,()=>{});assert.equal(bells.items.length,0);assert.deepEqual(bells.positions(),[]);
 const manual:ThrowPath={points:[{x:0,y:2,z:0},{x:0,y:0,z:-4}],landing:{x:0,z:-4},seconds:1},other=new ThrownBells();other.throw(manual,0);other.step(.25,0,()=>{});
 assert.deepEqual(other.positions()[0],{x:0,y:1.5,z:-1});
});

const fixture=()=>{const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);for(const e of enemies.actors){e.position={x:1000+e.id*10,z:1000};e.floor=0;}return {l,enemies};};
const reset=(e:Enemy,position:Position,floor=0)=>{e.position=position;e.floor=floor;e.brain=new EnemyBrain();e.investigate=null;e.searchTime=0;e.searchBranches=0;e.dormant=false;};
test('bellHear: only the two nearest eligible same-floor actors respond, with one branch and a short search',()=>{
 const {enemies}=fixture(),[normal,listener,watcher,stalker,,listener2,watcher2]=enemies.actors,bell={x:0,z:0};
 reset(normal,{x:3,z:0});normal.brain.mode='chase';
 reset(watcher,{x:0,z:4});watcher.brain.stun(5);
 reset(stalker,{x:-5,z:0},4.8);
 reset(listener2,{x:8,z:0});reset(watcher2,{x:0,z:-12});reset(listener,{x:20,z:0});
 assert.equal(enemies.hear(bell,0,bellHear()),2);
 for(const e of [normal,watcher,stalker,listener])assert.equal(e.investigate,null,e.kind+' '+e.id);
 for(const e of [listener2,watcher2]){assert.deepEqual(e.investigate,bell);assert.equal(e.searchBranches,1);assert.equal(e.destinationFloor,0);close(e.searchTime,14);}
 assert.equal(normal.brain.mode,'chase');assert.equal(watcher.brain.mode,'stunned');
 reset(listener2,{x:30,z:0});reset(watcher2,{x:1000,z:0});reset(listener,{x:1000,z:0});
 enemies.difficulty={...enemies.difficulty,search:1.25};assert.equal(enemies.hear(bell,0,bellHear(1.25,true)),1);close(listener2.searchTime,(30/3.6+6)*1.25*1.3);
 reset(stalker,{x:-5,z:0},4.8);assert.equal(enemies.hear(bell,4.8,bellHear()),1,'an upstairs bell reaches only the upper floor');assert.deepEqual(stalker.investigate,bell);
});
test('bellHear: radii are clamp(0.3·hearing, 10, 45) per kind and scale with sense and omen hearing',()=>{
 const {enemies}=fixture(),probe=enemies.actors[0],bell={x:0,z:0};
 const hears=(kind:string,d:number)=>{probe.kind=kind as Enemy['kind'];reset(probe,{x:d,z:0});return enemies.hear(bell,0,bellHear())===1;};
 const radius=(kind:string)=>Math.max(10,Math.min(45,.3*ENEMY_PROFILES[kind as Enemy['kind']].hearing));
 const expected:Record<string,number>={normal:26,listener:44,warden:45,danger:45,crusher:45,parallax:45,errorWeep:45,watcher:22,stalker:20,fox:25,pilgrim:31,mire:10,errorWatch:10,hotelGuest:10,hotelStaff:14};
 for(const [kind,r] of Object.entries(expected)){
  close(radius(kind),r,.55,kind+' '+radius(kind));
  assert.equal(hears(kind,radius(kind)-.05),true,kind+' inside');assert.equal(hears(kind,radius(kind)+.05),false,kind+' outside');
 }
 assert.equal(hears('listener',43.4),true);assert.equal(hears('listener',43.6),false);assert.equal(hears('mire',10.4),true);assert.equal(hears('mire',10.6),false);
 enemies.modifiers.hearing=1.3;assert.equal(hears('listener',56),true,'静寂 widens the bell too');enemies.modifiers.hearing=1;
 enemies.difficulty={...enemies.difficulty,sense:1.2};assert.equal(hears('normal',31),true);assert.equal(hears('normal',32),false);
 const l=createLayout(),areaAt=createAreaLookup(l.cells),red=l.cells.find(c=>(RED_AREAS as readonly string[]).includes(c.kind))!,blue=l.cells.find(c=>areaAt({x:c.x*4,z:c.z*4})==='blue')!;
 enemies.difficulty={...enemies.difficulty,sense:1};probe.kind='normal';
 for(const c of [red,blue]){const p={x:c.x*4,z:c.z*4};reset(probe,{x:p.x+26,z:p.z});assert.equal(enemies.hear(p,0,bellHear()),1,'area does not change a bell radius');reset(probe,{x:p.x+27,z:p.z});assert.equal(enemies.hear(p,0,bellHear()),0);}
});
test('bellHear: a bell within 10 m wakes a sleeper on its floor; farther sleepers sleep on',()=>{
 const {enemies}=fixture(),[a,b]=enemies.actors;enemies.setDormant([a.id,b.id]);
 a.position={x:9,z:0};a.floor=0;b.position={x:0,z:11};b.floor=0;
 assert.equal(enemies.hear({x:0,z:0},0,bellHear()),1);assert.equal(a.dormant,false);assert.deepEqual(a.investigate,{x:0,z:0});assert.equal(b.dormant,true);assert.equal(b.investigate,null);
});
test('hear() without options keeps the running-footstep rule exactly (hearing.test scenario)',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),e=enemies.actors[0],boss=enemies.actors[4];
 e.position={x:0,z:0};boss.position={x:40,z:0};const noise={x:25,z:0};
 enemies.hear(noise);assert.deepEqual(e.investigate,noise);assert.deepEqual(boss.investigate,noise);
 e.position={x:0,z:0};enemies.hear({x:37,z:0});assert.deepEqual(e.investigate,noise,'blue normal hearing stops beyond 35.2 m');
 // Snapshot of the historical formula over the whole roster at several points and floors.
 const areaAt=createAreaLookup(l.cells),nodes=[...enemies.nodes.values()];
 for(const [i,floor] of [[0,0],[40,0],[120,4.8],[300,0],[200,9.6]] as const){
  const fresh=new Enemies(l.cells,l.obstacles),point=nodes[i%nodes.length],balance=AREA_MULTIPLIERS[areaAt(point,floor)],nextFloor=floor>7.2?9.6:floor>2.4?4.8:0;
  fresh.actors[2].brain.mode='chase';fresh.actors[6].brain.stun();
  const expected=fresh.actors.map(a=>{const d=span(a.position,point),eligible=a.brain.mode==='patrol'&&d<=ENEMY_PROFILES[a.kind].hearing*balance.sense;return {id:a.id,investigate:eligible?point:null,destinationFloor:eligible?nextFloor:a.destinationFloor,searchBranches:eligible?(a.kind==='warden'?5:a.kind==='listener'?3:2):0,searchTime:eligible?Math.max((a.kind==='warden'?65:45)*balance.search,d/(3.3*balance.speed)+8*balance.search):0};});
  assert.equal(fresh.hear(point,floor),expected.filter(x=>x.investigate).length);
  assert.deepEqual(fresh.actors.map(a=>({id:a.id,investigate:a.investigate,destinationFloor:a.destinationFloor,searchBranches:a.searchBranches,searchTime:a.searchTime})),expected);
 }
});
test('stuns: burst and the default stun stay 9 s; a ward passes its own seconds to stunActor',()=>{
 assert.equal(STUN_SECONDS,9);const brain=new EnemyBrain();brain.stun();assert.equal(brain.stunRemaining,9);
 const {enemies}=fixture(),e=enemies.actors[0];
 enemies.stunActor(e);assert.equal(e.brain.stunRemaining,9);
 reset(e,{x:0,z:0});e.brain.mode='chase';const wards=new Wards();wards.place({x:.4,z:0},0,false);arm(wards);
 const hits=wards.step(.05,.05,enemies.actors,(x,s)=>enemies.stunActor(x,s));
 assert.equal(hits.length,1);assert.equal(hits[0].enemy,e);assert.equal(e.brain.mode,'stunned');assert.equal(e.brain.stunRemaining,WARD.stun);assert.equal(e.investigate,null);assert.equal(e.alert,0);
 reset(e,{x:0,z:-3});enemies.actors=[e];assert.equal(enemies.burst({x:0,z:0,y:1.5},[],0,0,0),1);assert.equal(e.brain.stunRemaining,9);
});

test('Wards.place: refuses a ramp, a spot within 1.6 m of a ward on the same floor, and a third ward',()=>{
 const wards=new Wards();
 assert.equal(wards.place({x:0,z:0},0,true),'ramp');assert.equal(wards.placed.length,0);
 assert.equal(wards.place({x:0,z:0},0,false),'placed');
 assert.equal(wards.place({x:1.2,z:1},0,false),'near');
 assert.equal(wards.place({x:0,z:1},4.8,false),'placed','another floor is not near');
 assert.equal(wards.place({x:20,z:0},0,false),'full');assert.equal(wards.place({x:20,z:0},0,true),'ramp');
 assert.deepEqual(wards.snapshot(),{placed:2});
 const spaced=new Wards();spaced.place({x:0,z:0},0,false);assert.equal(spaced.place({x:1.61,z:0},0,false),'placed');
 const p={x:3,z:4},w=new Wards();w.place(p,0,false);p.x=99;assert.deepEqual(w.placed[0].position,{x:3,z:4},'the ward keeps its own copy');
 assert.equal(w.placed[0].armed,false);assert.equal(w.placed[0].arming,WARD.arm);
});
test('Wards: nothing triggers before 0.6 s; a chasing actor within 1.3 m is then stunned 6 s and the ward burns',()=>{
 const wards=new Wards(),{calls,stun}=recorder(),e=actor({x:.5,z:0});wards.place({x:0,z:0},0,false);
 for(let i=0;i<11;i++){assert.deepEqual(wards.step(.05,.05,[e],stun),[]);assert.equal(wards.placed[0].armed,false);}
 const hits=wards.step(.05,.05,[e],stun);
 assert.equal(hits.length,1);assert.equal(hits[0].enemy,e);assert.deepEqual(hits[0].ward.position,{x:0,z:0});
 assert.deepEqual(calls.map(c=>c.seconds),[WARD.stun]);assert.equal(WARD.stun,6);assert.equal(wards.placed.length,0);
 const edge=new Wards(),probe=recorder();edge.place({x:0,z:0},0,false);arm(edge);
 assert.deepEqual(edge.step(.05,.05,[actor({x:1.31,z:0})],probe.stun),[]);
 assert.equal(edge.step(.05,.05,[actor({x:.9,z:-.9})],probe.stun).length,1,'1.27 m on the diagonal');
});
test('Wards: patrolling, investigating, hunting, stunned and other-floor actors walk over a ward harmlessly',()=>{
 const wards=new Wards(),{calls,stun}=recorder();wards.place({x:0,z:0},0,false);arm(wards);
 const walkers=[actor({x:.5,z:0},'patrol'),Object.assign(actor({x:0,z:.5},'patrol'),{investigate:{x:0,z:0}}),Object.assign(actor({x:-.5,z:0},'patrol'),{hunting:20}),actor({x:0,z:-.5},'stunned'),actor({x:.2,z:0},'chase','normal',4.8)];
 for(let i=0;i<200;i++)assert.deepEqual(wards.step(.05,.05,walkers,stun),[]);
 assert.equal(calls.length,0);assert.equal(wards.placed.length,1,'a pre-placed ward keeps its value');
 assert.equal(wards.step(.05,.05,[...walkers,actor({x:1,z:0})],stun).length,1);
 const upper=new Wards();upper.place({x:0,z:0},4.8,false);arm(upper);assert.equal(upper.step(.05,.05,[actor({x:.3,z:0},'chase','normal',5.2)],stun).length,1,'same floor band');
});
test('Wards: no trigger while time is stopped; arming continues and the first live frame fires',()=>{
 const wards=new Wards(),{calls,stun}=recorder(),e=actor({x:.4,z:.4});wards.place({x:0,z:0},0,false);
 for(let i=0;i<40;i++)assert.deepEqual(wards.step(.05,0,[e],stun),[]);
 assert.equal(wards.placed[0].armed,true,'arming runs on real time');assert.equal(calls.length,0);
 assert.deepEqual(wards.step(.05,1e-7,[e],stun),[]);
 assert.equal(wards.step(.016,.016,[e],stun).length,1);assert.equal(calls.length,1);
});
test('Wards: one ward binds one pursuer per frame; the nearest chaser is taken',()=>{
 const wards=new Wards(),{calls,stun}=recorder(),far=actor({x:1.1,z:0}),near=actor({x:-.3,z:0});
 wards.place({x:0,z:0},0,false);wards.place({x:1.7,z:0},0,false);arm(wards);
 const hits=wards.step(.05,.05,[far,near],stun);
 assert.equal(hits.length,2);assert.equal(hits[0].enemy,near);assert.equal(hits[1].enemy,far);assert.equal(calls.length,2);
 const twice=new Wards(),probe=recorder(),lone=actor({x:.8,z:0});twice.place({x:0,z:0},0,false);twice.place({x:1.6,z:0},0,false);arm(twice);
 assert.equal(twice.step(.05,.05,[lone],probe.stun).length,1,'a chaser between two wards burns only one');assert.equal(twice.placed.length,1);
});
test('Wards: a finale boss is stunned 2.5 s, then ignores wards for 8 s while ordinary pursuers do not',()=>{
 const wards=new Wards(),{calls,stun}=recorder(),boss=actor({x:0,z:0},'chase','hatred');
 wards.place({x:0,z:0},0,false);arm(wards);
 assert.equal(wards.step(.05,.05,[boss],stun).length,1);assert.deepEqual(calls.map(c=>c.seconds),[WARD.bossStun]);assert.equal(WARD.bossStun,2.5);assert.equal(wards.bossImmune,WARD.bossImmune);
 assert.equal(wards.place({x:0,z:0},0,false),'placed');
 for(let t=0;t<WARD.bossStun;t+=.05)wards.step(.05,.05,[boss],stun);
 assert.equal(wards.bossImmune,WARD.bossImmune,'immunity starts once the stun ends');
 boss.brain.mode='chase';
 for(let t=.05;t<WARD.bossImmune-.05;t+=.05)assert.deepEqual(wards.step(.05,.05,[boss],stun),[],'immune at '+t.toFixed(2));
 assert.equal(wards.placed.length,1);assert.equal(calls.length,1);
 const mid=new Wards(),probe=recorder();mid.bossImmune=5;mid.place({x:0,z:0},0,false);arm(mid,[boss]);
 assert.equal(mid.step(.05,.05,[boss,actor({x:.5,z:0},'chase','normal')],probe.stun)[0].enemy.kind,'normal');
 for(let i=0;i<4;i++)wards.step(.05,.05,[boss],stun);
 assert.equal(calls.length,2);assert.equal(calls[1].seconds,WARD.bossStun);assert.equal(wards.placed.length,0);
 const wrath=new Wards(),w=recorder();wrath.place({x:0,z:0},0,false);arm(wrath);assert.deepEqual(wrath.step(.05,.05,[actor({x:.2,z:0},'chase','wrath')],w.stun).map(h=>h.enemy.kind),['wrath']);assert.equal(w.calls[0].seconds,2.5);
 wards.reset();assert.deepEqual([wards.placed.length,wards.bossImmune],[0,0]);
});
test('Wards: a real finale boss is stunned 2.5 s through stunActor',()=>{
 const {enemies}=fixture();enemies.beginFinale({x:0,z:14},0,()=>0);const boss=enemies.actors[0];
 boss.position={x:2,z:2};boss.floor=0;boss.brain.mode='chase';
 const wards=new Wards();wards.place({x:2.5,z:2},0,false);arm(wards);
 assert.equal(wards.step(.05,.05,enemies.actors,(e,s)=>enemies.stunActor(e,s)).length,1);
 assert.equal(boss.brain.mode,'stunned');assert.equal(boss.brain.stunRemaining,2.5);assert.equal(wards.bossImmune,8);
});

test('ButtonEdges: standard touchpad/D-pad up use an item, L3 and D-pad left/right cycle, once per press',()=>{
 const pad=(mapping:string,pressed:number[])=>({id:'Sony Interactive Entertainment DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)',mapping,axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:pressed.includes(i)}))});
 for(const [field,buttons] of [['item',[17,12]],['itemCycle',[10,14,15]]] as const)for(const b of buttons){
  const edges=new ButtonEdges();
  assert.equal(edges.update(pad('standard',[b]))[field],true,field+' '+b);assert.equal(edges.update(pad('standard',[b]))[field],false,'held');
  assert.equal(edges.update(pad('standard',[]))[field],false);assert.equal(edges.update(pad('standard',[b]))[field],true,'pressed again');
 }
 const standard=new ButtonEdges().update(pad('standard',[13,11,3]));assert.equal(standard.item,false);assert.equal(standard.itemCycle,false);
 const raw=(b:number)=>new ButtonEdges().update(pad('',[b]));
 assert.equal(raw(13).item,true,'raw Sony touchpad');assert.equal(raw(12).item,false,'raw 12 is the PS button');assert.equal(raw(17).item,false);
 assert.equal(raw(10).itemCycle,true);assert.equal(raw(14).itemCycle,false);assert.equal(raw(15).itemCycle,false);
 const edges=new ButtonEdges();assert.equal(edges.update(pad('',[13])).item,true);assert.equal(edges.update(pad('',[13])).item,false);
});

test('placeItemPickups: four supplies, two of each, three on the ground, 40 m apart and clear of keepouts',()=>{
 for(const seed of [1,5,23,71,99]){
  const l=createLayout(seed),enemies=new Enemies(l.cells,l.obstacles);enemies.addPatrolTargets([]);
  const keepout=[{position:SPAWN,floor:0,radius:16},{position:{x:0,z:-60},floor:0,radius:10},{position:{x:40,z:40},floor:0,radius:5},{position:{x:-60,z:20},floor:0,radius:6},{position:{x:80,z:20},floor:4.8,radius:5}];
  const items=placeItemPickups(enemies.patrolTargets,keepout,seededRandom(seed^0x1e3a));
  assert.equal(items.length,4);assert.deepEqual(items.map(p=>p.kind).sort(),['bell','bell','ward','ward']);
  assert.deepEqual(items.map(p=>p.id),['item-0','item-1','item-2','item-3']);assert.ok(items.every(p=>!p.collected));
  assert.equal(items.filter(p=>p.floor===0).length,3,'seed '+seed);
  assert.deepEqual(new Set(items.filter(p=>p.floor===0).map(p=>p.kind)),new Set(['bell','ward']));
  for(const p of items)for(const k of keepout)assert.ok(Math.abs(k.floor-p.floor)>.3||span(p.position,k.position)>=k.radius);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(span(items[i].position,items[j].position)+Math.abs(items[i].floor-items[j].floor)*6>=40,`seed ${seed}: ${i}-${j}`);
  assert.deepEqual(placeItemPickups(enemies.patrolTargets,keepout,seededRandom(seed^0x1e3a)),items,'deterministic per seed');
  const site=enemies.patrolTargets.find(t=>t.point.x===items[0].position.x&&t.point.z===items[0].position.z)!;items[0].position.x+=1;assert.notEqual(site.point.x,items[0].position.x,'pickups copy their site');
 }
 const ground=Array.from({length:30},(_,i)=>({point:{x:(i%6)*30,z:Math.floor(i/6)*30},floor:0}));
 const flat=placeItemPickups(ground,[],seededRandom(4));assert.equal(flat.length,4,'a single-storey stage still gets every supply');assert.ok(flat.every(p=>p.floor===0));
 assert.equal(placeItemPickups(ground,[],seededRandom(4),2).length,2);assert.deepEqual(placeItemPickups([],[],seededRandom(4)),[]);
});
test('collectItems: walking onto a supply on the same floor collects it unless a wall or a full slot is in the way',()=>{
 const pickups:ItemPickup[]=[{id:'a',kind:'bell',position:{x:0,z:0},floor:0,collected:false},{id:'b',kind:'ward',position:{x:0,z:1},floor:0,collected:false},{id:'c',kind:'ward',position:{x:0,z:.5},floor:4.8,collected:false},{id:'d',kind:'bell',position:{x:6,z:0},floor:0,collected:false}];
 const bag=new ItemBag({bell:3});
 assert.deepEqual(collectItems(pickups,bag,{x:0,z:.5},0,[]),['ward']);assert.equal(bag.ward,1);assert.equal(pickups[0].collected,false,'a full bell slot leaves the bell');assert.equal(pickups[2].collected,false);
 assert.deepEqual(collectItems(pickups,bag,{x:0,z:.5},0,[]),[]);
 bag.take('bell');assert.deepEqual(collectItems(pickups,bag,{x:0,z:.5},.3,[]),['bell']);assert.equal(bag.bell,3);
 const wall:Obstacle={minX:6.4,maxX:6.6,minZ:-2,maxZ:2};assert.deepEqual(collectItems(pickups,new ItemBag({bell:0}),{x:7.3,z:0},0,[wall]),[],'not through a wall');
 assert.deepEqual(collectItems(pickups,new ItemBag({bell:0}),{x:4.5,z:0},0,[wall]),[],'1.5 m is too far');
 const bag2=new ItemBag({bell:0});assert.deepEqual(collectItems(pickups,bag2,{x:5,z:.5},0,[wall]),['bell']);assert.deepEqual(collectItems(pickups,bag2,{x:0,z:.5},4.8,[]),['ward']);
});

test('item meshes: floating pickups, a flying then resting bell, and a red 1.3 m ring only on an armed ward',()=>{
 const scene=new THREE.Scene(),tex=new THREE.Texture(),pickups:ItemPickup[]=[{id:'item-0',kind:'bell',position:{x:3,z:4},floor:0,collected:false},{id:'item-1',kind:'ward',position:{x:-3,z:4},floor:4.8,collected:false}];
 const meshes=createItemMeshes(scene,pickups,tex),named=(n:string)=>scene.children.filter(o=>o.name===n);
 const bells=new ThrownBells(),wards=new Wards();
 meshes.update(0,bells,wards);assert.equal(named('item-pickup').length,2);assert.ok(named('item-pickup').every(o=>o.visible));
 assert.ok(named('item-pickup')[1].position.y>4.8+.5);
 let lights=0;scene.traverse(o=>{if(o instanceof THREE.Light)lights++;});assert.equal(lights,0,'no scene lights');
 pickups[0].collected=true;meshes.update(16,bells,wards);assert.equal(named('item-pickup')[0].visible,false);
 bells.throw(path,0);bells.step(path.seconds/2,0,()=>{});meshes.update(32,bells,wards);
 const bell=named('item-bell')[0],mid=bells.positions()[0];assert.ok(bell.visible);close(bell.position.x,mid.x);close(bell.position.z,mid.z);assert.ok(bell.position.y>mid.y);
 bells.step(path.seconds,.05,()=>{});meshes.update(48,bells,wards);close(bell.position.y,.065,1e-9,'rests on the floor');
 wards.place({x:1,z:2},0,false);meshes.update(64,bells,wards);
 const ward=named('item-ward')[0],ring=ward.children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.RingGeometry) as THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
 assert.ok(ward.visible);assert.equal(ring.visible,false,'no ring while arming');
 const {innerRadius,outerRadius}=ring.geometry.parameters;close((innerRadius+outerRadius)/2,WARD.radius);assert.ok(outerRadius-innerRadius<=.06);
 assert.ok(ring.material.transparent&&ring.material.color.r>ring.material.color.g*3,'faint red');
 arm(wards);meshes.update(80,bells,wards);assert.equal(ring.visible,true);
 wards.step(.05,.05,[actor({x:1,z:2})],()=>{});meshes.update(96,bells,wards);assert.equal(ward.visible,false,'a burnt ward disappears');
 for(let t=0;t<THROW.restSeconds-1;t+=.05)bells.step(.05,.05,()=>{});meshes.update(112,bells,wards);assert.ok(bell.visible&&bell.scale.x<1&&bell.scale.x>0,'fading');
 for(let i=0;i<30;i++)bells.step(.05,.05,()=>{});meshes.update(128,bells,wards);assert.equal(bell.visible,false);
 meshes.dispose();assert.equal(scene.children.filter(o=>o.name.startsWith('item-')).length,0);
});
test('item meshes: on a terraced stage a bell keeps its world height after the render lift',()=>{
 const scene=new THREE.Scene(),terrain=(z:number)=>Math.max(0,-z)*.5,meshes=createItemMeshes(scene,[],new THREE.Texture(),terrain),bells=new ThrownBells(),wards=new Wards();
 const arc=throwArc({x:0,y:STAND_EYE,z:0},0,0,[],p=>terrain(p.z));bells.throw(arc,0);bells.step(5,.05,()=>{});wards.place({x:0,z:-4},0,false);meshes.update(0,bells,wards);
 const bell=scene.children.find(o=>o.name==='item-bell')!,landing=arc.points.at(-1)!;close(bell.position.y+terrain(bell.position.z),landing.y+.065,1e-9);
 const ward=scene.children.find(o=>o.name==='item-ward')!;assert.equal(ward.position.y,0);assert.ok(ward.rotation.x>0,'the ring tilts with the slope');
 meshes.dispose();
});

type ItemWorld={useItem():string;selectItem(kind:'bell'|'ward'):void;cycleItem():unknown;itemStatus():{bell:number;ward:number;selected:string;placed:number}};
const worldFor=(seed:number)=>{
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},render(){},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const world=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);world.configure({...DEFAULTS,quality:'low'});
 return {world,items:world as unknown as ItemWorld};
};
test('world: items in the gallery are a no-op and never call hear()',t=>{
 const hear=t.mock.method(Enemies.prototype,'hear',()=>0);t.mock.method(Enemies.prototype,'update',()=>false);
 const {world,items}=worldFor(71);
 try{
  world.setMode('gallery');const heard=hear.mock.callCount(),before=items.itemStatus();
  for(const kind of ['bell','ward'] as const){items.selectItem(kind);assert.equal(items.useItem(),'blocked');}
  for(let i=0;i<80;i++)world.step(.05);
  assert.equal(hear.mock.callCount(),heard);assert.equal(items.itemStatus().bell,before.bell);assert.equal(items.itemStatus().placed,0);
  assert.ok(world.scene.children.filter(o=>o.name==='item-pickup').length===4);
 }finally{world.dispose();}
});
test('world: a placed ward survives a capture while carried items are lost',t=>{
 const update=t.mock.method(Enemies.prototype,'update',()=>false);
 const {world,items}=worldFor(23);
 try{
  world.setMode('normal');world.drainCues();assert.equal(items.itemStatus().bell,1);
  for(const p of world.scene.children.filter(o=>o.name==='item-pickup'&&o.position.y<2)){if(items.itemStatus().ward>0)break;world.camera.position.set(p.position.x,1.68,p.position.z);world.step(.05);}
  assert.ok(items.itemStatus().ward>0,'a ground ward supply was collected');
  items.selectItem('ward');assert.equal(items.useItem(),'placed');assert.equal(items.itemStatus().placed,1);
  update.mock.mockImplementation(()=>true);world.step(.05);update.mock.mockImplementation(()=>false);
  const after=items.itemStatus();assert.equal(after.bell,0);assert.equal(after.ward,0);assert.equal(after.placed,1);
 }finally{world.dispose();}
});
test('world: a thrown bell spends a bell and rings through hear() with the bell options only after a time stop ends',t=>{
 const hear=t.mock.method(Enemies.prototype,'hear',()=>0);t.mock.method(Enemies.prototype,'update',()=>false);
 const {world,items}=worldFor(71);
 try{
  world.setMode('normal');world.camera.rotation.set(0,0,0);items.selectItem('bell');
  const rings=()=>hear.mock.calls.filter(c=>(c.arguments[2] as {limit?:number}|undefined)?.limit===2);
  assert.equal(world.stopTime(),true);assert.equal(items.useItem(),'thrown');assert.equal(items.itemStatus().bell,0);
  for(let i=0;i<60;i++)world.step(.05);
  assert.equal(rings().length,0,'no ring while time is stopped');world.render(100);assert.ok(world.scene.children.some(o=>o.name==='item-bell'&&o.visible),'the landed bell lies in view of the scene');
  for(let i=0;i<200&&!rings().length;i++)world.step(.05);
  assert.equal(rings().length,1);const [point,floor,opts]=rings()[0].arguments as [Position,number,{branches:number;sameFloor:boolean}];
  assert.equal(floor,0);assert.equal(opts.branches,1);assert.equal(opts.sameFloor,true);assert.ok(span(point,world.camera.position)<=14.5);
  for(let i=0;i<40;i++)world.step(.05);assert.equal(rings().length,1);assert.equal(items.useItem(),'empty');
 }finally{world.dispose();}
});
