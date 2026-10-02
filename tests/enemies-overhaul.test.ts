import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies,HUNT_RADIUS,STUN_SECONDS,TOLL_WAKE_DISTANCE,type Enemy} from '../app/shrine-gameplay.ts';
import {AREA_MULTIPLIERS} from '../app/area-rules.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {noticeRules} from '../app/play-mode.ts';
import {SPRINT_SPEED,WALK_SPEED} from '../app/movement.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {FINALE_BALANCE} from '../app/enemy-traits.ts';
const ringScale=(kind:'hatred'|'wrath',difficulty:number)=>Math.min(.6,.97*SPRINT_SPEED/((kind==='hatred'?FINALE_BALANCE.hatred.maximumSpeed:FINALE_BALANCE.wrath.rushSpeed)*Math.max(.85,Math.min(1.2,difficulty))));
import type {Cell} from '../app/shrine-layout.ts';
const corridor:Cell[]=Array.from({length:40},(_,x)=>({x:x-20,z:0,h:4,kind:'hall'}));
/** One ordinary enemy at the origin facing +z in an empty blue corridor. */
const arena=(mode:'normal'|'hard'|'nightmare'='normal',kind:Enemy['kind']='normal')=>{
 const enemies=new Enemies(corridor,[]),e=enemies.actors[0];enemies.actors=[e];e.kind=kind;
 e.position={x:0,z:0};e.home={x:0,z:0};e.facing=0;enemies.notice=noticeRules(mode);
 // A single patrol post under its feet keeps the sentry in place, so only the gauge moves it.
 enemies.patrolTargets.push({id:'post',point:{x:0,z:0},floor:0,visits:0,lastVisited:0});return {enemies,e};
};
const tick=(enemies:Enemies,player:{x:number;z:number},opts:{lit?:boolean;moving?:boolean;running?:boolean;crouch?:boolean;dt?:number}={})=>{
 enemies.playerMoving=opts.moving??false;enemies.playerRunning=opts.running??false;enemies.playerCrouching=opts.crouch??false;
 return enemies.update(opts.dt??.05,player,[],0,undefined,!!opts.lit||!!opts.running,undefined,!!opts.lit);
};
test('a lit visitor at the edge of sight is chased only after the gauge fills',()=>{
 const {enemies,e}=arena();const far={x:0,z:9.5};// blue-area sight for a normal mask is 10 m
 for(let t=0;t<.5;t+=.05)tick(enemies,far,{lit:true});assert.equal(e.brain.mode,'patrol');assert.ok((e.alert??0)>.3&&(e.alert??0)<1);
 for(let t=.5;t<1.4;t+=.05)tick(enemies,far,{lit:true});assert.equal(e.brain.mode,'chase');
 const {enemies:near,e:n}=arena();tick(near,{x:0,z:1.2},{lit:true});assert.equal(n.brain.mode,'chase','inside nearSight the chase is immediate');
});
test('breaking line of sight while suspected leaves the enemy searching the last spot for eight seconds',()=>{
 const {enemies,e}=arena();const player={x:0,z:8};
 for(let t=0;t<.45;t+=.05)tick(enemies,player,{lit:true});
 assert.ok((e.alert??0)>=.35&&e.brain.mode==='patrol');assert.deepEqual(e.suspect,player);
 for(let t=0;t<2&&e.suspect;t+=.05)tick(enemies,{x:0,z:-30},{});
 assert.equal(e.brain.mode,'patrol');assert.deepEqual(e.investigate,player);assert.ok(Math.abs(e.searchTime-8*AREA_MULTIPLIERS.blue.search)<1e-9,String(e.searchTime));assert.equal(e.suspect,null);
});
/** Walk a straight chord past the enemy at a lateral offset, in the dark. */
const pass=(mode:'normal'|'hard'|'nightmare',offset:number,speed:number,crouch:boolean,kind:Enemy['kind']='normal')=>{
 const {enemies,e}=arena(mode,kind);// faces +z: the visitor crosses in front along x
 let x=-4,noticed=false;while(x<4){x+=speed*.05;if(tick(enemies,{x,z:offset},{moving:true,crouch}))return 'caught';if(e.brain.mode==='chase')return 'chase';noticed||=(e.alert??0)>=.35;}
 return noticed?'noticed':'unseen';
};
test('darkness is a speed-versus-safety gradient: walking close is caught, crouching slips by, stillness is invisible',()=>{
 assert.equal(pass('normal',1.5,WALK_SPEED,false),'chase');
 assert.equal(pass('normal',1.5,WALK_SPEED/2,true),'noticed');
 assert.equal(pass('normal',2.0,WALK_SPEED,false),'noticed');
 assert.equal(pass('normal',3.5,WALK_SPEED,false),'unseen');
 assert.equal(pass('nightmare',1.5,WALK_SPEED,false),'chase');
 assert.equal(pass('normal',1.5,WALK_SPEED,false,'errorWatch'),'unseen','逆面 only sees light');
 const {enemies,e}=arena();for(let t=0;t<10;t+=.05)assert.equal(tick(enemies,{x:0,z:.3},{moving:false}),false);assert.equal(e.brain.mode,'patrol');assert.equal(e.alert??0,0);
});
test('a dark walker behind the enemy is sensed only when nearly touching',()=>{
 const {enemies:a,e:ea}=arena();for(let t=0;t<2;t+=.05)tick(a,{x:0,z:-1.5},{moving:true});assert.equal(ea.brain.mode,'patrol');assert.equal(ea.alert??0,0);
 const {enemies:b,e:eb}=arena();for(let t=0;t<1.2;t+=.05)tick(b,{x:0,z:-.8},{moving:true});assert.equal(eb.brain.mode,'chase');
});
test('a wall between eye and body blocks dark sense; NOTICE_OFF keeps the old instant rule',()=>{
 const {enemies,e}=arena();const wall=[{minX:-2,maxX:2,minZ:.6,maxZ:.9}];
 for(let t=0;t<2;t+=.05){enemies.playerMoving=true;enemies.update(.05,{x:0,z:1.5},wall,0,undefined,false,undefined,false);}
 assert.equal(e.brain.mode,'patrol');assert.equal(e.alert??0,0);
 const off=new Enemies(corridor,[]),o=off.actors[0];off.actors=[o];o.position={x:0,z:0};o.facing=0;
 off.update(.05,{x:0,z:8},[],0,undefined,true,undefined,true);assert.equal(o.brain.mode,'chase');
});
test('the final pursuer ignores the gauge and the omen holds it motionless before the hunt',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);enemies.notice=noticeRules('normal');
 const player={x:0,z:14},random=seededRandom(9);enemies.beginFinale(player,0,random,6,{x:0,z:40});
 const boss=enemies.actors[0],home={...boss.position};assert.equal(boss.wakeIn,6);
 const bearing=(p:{x:number;z:number})=>Math.atan2(p.x-player.x,p.z-player.z),diff=Math.abs(Math.atan2(Math.sin(bearing(home)-bearing({x:0,z:40})),Math.cos(bearing(home)-bearing({x:0,z:40}))));
 assert.ok(diff>Math.PI/2,'spawns on the far side from the altar');
 boss.position={x:player.x+.5,z:player.z};boss.floor=0;
 for(let t=0;t<5.9;t+=.05)assert.equal(enemies.update(.05,player,l.obstacles),false);
 assert.deepEqual(boss.position,{x:player.x+.5,z:player.z});assert.equal(boss.brain.mode,'patrol');
 let caught=false;for(let t=0;t<1;t+=.05)caught=enemies.update(.05,player,l.obstacles)||caught;assert.ok(caught,'after the omen the boss captures an adjacent visitor');
});
test('inside the altar ring the final pursuer is never faster than a sprinting visitor',()=>{
 for(const kind of ['hatred','wrath'] as const)for(const difficulty of [.85,1.2]){
  const enemies=new Enemies(corridor,[]);enemies.difficulty={enemies:true,sense:1,speed:difficulty,search:1};
  const random=()=>kind==='hatred'?0:.9;enemies.beginFinale({x:0,z:0},0,random);const boss=enemies.actors[0];boss.kind=kind;boss.position={x:-6,z:0};boss.floor=0;
  enemies.ring={center:{x:0,z:0},radius:7,scale:ringScale(kind,difficulty)};boss.traitTime=kind==='hatred'?30:.8;
  let worst=0;for(let t=0;t<2;t+=.05){const before={...boss.position};enemies.update(.05,{x:40,z:0},[]);boss.traitTime=kind==='hatred'?30:.8;worst=Math.max(worst,Math.hypot(boss.position.x-before.x,boss.position.z-before.z)/.05);boss.position={x:-6,z:0};}
  assert.ok(worst<SPRINT_SPEED,kind+' '+difficulty+' '+worst);
 }
});
test('a bell is heard by at most the two nearest patrollers within kind-specific radii; footstep hearing is unchanged',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);
 const bell={radius:(e:Enemy,raw:number)=>Math.max(10,Math.min(45,.3*raw)),limit:2,search:(_e:Enemy,d:number)=>Math.max(14,d/3.6+6),branches:1,sameFloor:true};
 const [a,b,c]=enemies.actors;a.position={x:0,z:0};b.position={x:20,z:0};c.position={x:24,z:0};for(const e of enemies.actors.slice(3))e.position={x:900,z:900};
 a.kind='normal';b.kind='normal';c.kind='normal';
 assert.equal(enemies.hear({x:10,z:0},0,bell),2);assert.deepEqual(a.investigate,{x:10,z:0});assert.deepEqual(b.investigate,{x:10,z:0});assert.equal(c.investigate,null);assert.equal(a.searchBranches,1);
 const mire=enemies.actors[3];mire.kind='mire';mire.position={x:0,z:11};mire.investigate=null;const listener=enemies.actors[4];listener.kind='listener';listener.position={x:0,z:43};listener.investigate=null;
 enemies.hear({x:0,z:0},0,{...bell,limit:5});assert.equal(mire.investigate,null,'泥這い hears a bell only within 10 m');assert.deepEqual(listener.investigate,{x:0,z:0},'聞き耳 hears one at 43 m');
 const plain=new Enemies(l.cells,l.obstacles),e=plain.actors[0];e.position={x:0,z:0};plain.hear({x:35,z:0});assert.deepEqual(e.investigate,{x:35,z:0});e.investigate=null;plain.hear({x:36,z:0});assert.equal(e.investigate,null,'blue normal hearing still stops at 35.2 m');
});
test('a hunt sends the nearest eligible enemies to nodes around the warning point, never to the live visitor',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),origin={x:0,z:14};
 enemies.actors.forEach((e,i)=>{e.position={x:(i+1)*6,z:14};e.floor=0;e.homeFloor=0;e.investigate=null;});
 enemies.actors[0].brain.mode='chase';enemies.actors[1].brain.stun();enemies.actors[2].dormant=true;
 const hunters=enemies.hunt(origin,0,2,35,seededRandom(3));
 assert.deepEqual(hunters.map(h=>h.id),[3,4]);
 for(const h of hunters){assert.ok(Math.hypot(h.investigate!.x-origin.x,h.investigate!.z-origin.z)<=HUNT_RADIUS);assert.equal(h.hunting,35);assert.equal(h.searchBranches,4);assert.equal(h.searchTime,35);}
 assert.equal(enemies.actors[2].investigate,null);
 const live={x:60,z:-40};for(const h of hunters)assert.ok(Math.hypot(h.investigate!.x-live.x,h.investigate!.z-live.z)>20);
 enemies.update(.05,live,l.obstacles);assert.ok(hunters[0].hunting!<35);
});
test('blue areas lose safety with the night; red areas and the untouched default keep their multipliers',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),e=enemies.actors[0];e.position={x:0,z:0};
 const probe=(blueBalance:number)=>{enemies.modifiers.blueBalance=blueBalance;e.investigate=null;enemies.hear({x:0,z:88*.73-.1});return e.investigate!==null;};
 assert.equal(probe(0),false,'35.2 m blue hearing');assert.equal(probe(.55),true,'丑三つ時: 0.73×88 m');
});
test('sleepers neither see nor move until bumped, heard, flashed or woken by the toll',()=>{
 const {enemies,e}=arena();enemies.setDormant([e.id]);assert.equal(e.dormant,true);
 const home={...e.position};for(let t=0;t<30;t+=.05)assert.equal(tick(enemies,{x:0,z:2},{lit:true,moving:false}),false);
 assert.deepEqual(e.position,home);assert.equal(e.brain.mode,'patrol');assert.equal(e.investigate,null);
 tick(enemies,{x:0,z:1.5},{moving:true,crouch:true});assert.equal(e.dormant,true,'a crouching visitor slips past at 1.5 m');
 tick(enemies,{x:0,z:1.5},{moving:true});assert.equal(e.dormant,false,'a standing walker wakes it inside the dark radius');assert.ok(e.brain.reacquireDelay>=1.5);
 const {enemies:b,e:eb}=arena();b.setDormant([eb.id]);tick(b,{x:0,z:.9},{moving:true,crouch:true});assert.equal(eb.dormant,false,'contact wakes regardless of posture');
 const {enemies:c,e:ec}=arena();c.setDormant([ec.id]);c.hear({x:0,z:12});assert.equal(ec.dormant,true);assert.equal(ec.investigate,null);c.hear({x:0,z:9});assert.equal(ec.dormant,false);
 const {enemies:d,e:ed}=arena();d.setDormant([ed.id]);assert.equal(d.burst({x:0,z:3,y:1.5},[],0,0,0),1);assert.equal(ed.dormant,false);assert.equal(ed.brain.stunRemaining,STUN_SECONDS);
});
test('toll wake-ups skip sleepers near or in view of the visitor; reset keeps the still-sleeping asleep',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),ids=enemies.actors.filter(a=>a.homeFloor===0).slice(0,3).map(a=>a.id);
 enemies.setDormant(ids);const sleepers=enemies.actors.filter(a=>a.dormant);assert.equal(sleepers.length,3);
 const near=sleepers[0];const player={x:near.position.x+5,z:near.position.z};
 const woke=enemies.wakeBatch(3,player,0,l.obstacles);
 assert.equal(near.dormant,true,'a sleeper 5 m away never wakes at the toll');assert.ok(woke>=1&&woke<=2);
 assert.equal(enemies.wakeBatch(3,player,0,l.obstacles,true),3-woke,'the deferred sleeper wakes once forced');
 enemies.setDormant(ids);enemies.wake(sleepers[1]);enemies.reset();
 assert.deepEqual(enemies.actors.filter(a=>a.dormant).map(a=>a.id).sort(),[sleepers[0].id,sleepers[2].id].sort());
 enemies.setDormant([]);assert.equal(enemies.actors.some(a=>a.dormant),false);
 assert.ok(TOLL_WAKE_DISTANCE>=20);
});
test('sleepers are left out of squad responses and hunts',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles);enemies.actors.forEach((e,i)=>{e.position={x:(i+1)*6,z:14};e.floor=0;e.homeFloor=0;});
 enemies.setDormant([enemies.actors[1].id]);
 assert.ok(enemies.hunt({x:0,z:14},0,1,20,seededRandom(1)).every(h=>h.id!==enemies.actors[1].id));
 const source=enemies.actors[0];source.position={x:0,z:14};source.brain.mode='chase';source.brain.lastSeen={x:0,z:16};
 enemies.update(.05,{x:0,z:16},l.obstacles,0,undefined,true,undefined,true);
 assert.equal(enemies.actors[1].investigate,null);
});
