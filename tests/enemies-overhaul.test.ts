import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies,ENEMY_PROFILES,HUNT_RADIUS,LOSE_SIGHT_SECONDS,STUN_SECONDS,TOLL_WAKE_DISTANCE,WAKE_TURN_SECONDS,type Enemy,type HearOptions} from '../app/shrine-gameplay.ts';
import {AREA_MULTIPLIERS,createAreaLookup} from '../app/area-rules.ts';
import {createLayout} from '../app/shrine-layout.ts';
import {noticeRules} from '../app/play-mode.ts';
import {SPRINT_SPEED,WALK_SPEED} from '../app/movement.ts';
import {seededRandom} from '../app/seeded-random.ts';
import {FINALE_BALANCE} from '../app/enemy-traits.ts';
import {FORGET_AT,NOTICE_DECAY,SUSPECT_AT,TURN_RATE,litFillRate} from '../app/notice.ts';
import {omenParams} from '../app/run-omens.ts';
const ringScale=(kind:'hatred'|'wrath',difficulty:number)=>Math.min(.6,.97*SPRINT_SPEED/((kind==='hatred'?FINALE_BALANCE.hatred.maximumSpeed:FINALE_BALANCE.wrath.rushSpeed)*Math.max(.85,Math.min(1.2,difficulty))));
import type {Cell} from '../app/shrine-layout.ts';
const corridor:Cell[]=Array.from({length:40},(_,x)=>({x:x-20,z:0,h:4,kind:'hall'}));
/** Blue-area sight for a normal mask: 25 m × .4 = 10 m; near sight 4 m × .4 = 1.6 m. */
const BLUE_SIGHT=ENEMY_PROFILES.normal.sight*AREA_MULTIPLIERS.blue.sense,BLUE_NEAR=ENEMY_PROFILES.normal.nearSight*AREA_MULTIPLIERS.blue.sense;
const litRate=(distance:number)=>litFillRate(noticeRules('normal'),distance,BLUE_SIGHT,BLUE_NEAR,false,false,false);
const bearing=(from:{x:number;z:number},to:{x:number;z:number})=>Math.atan2(to.x-from.x,to.z-from.z);
/** Unsigned shortest-arc difference between two yaws. */
const angle=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
/** Read through a call so an earlier assert.equal does not narrow the type. */
const mode=(e:Enemy)=>e.brain.mode;
const close=(actual:number|undefined,expected:number,message?:string)=>assert.ok(Math.abs((actual??NaN)-expected)<1e-9,(message?message+': ':'')+actual+' ≠ '+expected);
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
 const {enemies,e}=arena();const far={x:0,z:9.5},rate=litRate(9.5);
 for(let i=0;i<10;i++)tick(enemies,far,{lit:true});
 assert.equal(e.brain.mode,'patrol');close(e.alert,10*.05*rate,'half a second at 9.5 m');assert.equal(e.alertSource,'lit');
 let ticks=10;while(mode(e)!=='chase'&&ticks<60){tick(enemies,far,{lit:true});ticks++;}
 assert.equal(ticks,Math.ceil(1/(.05*rate)),'the chase starts on the very tick the gauge reaches 1');assert.equal(e.alert,1);
 const {enemies:near,e:n}=arena();tick(near,{x:0,z:1.2},{lit:true});assert.equal(n.brain.mode,'chase','inside nearSight the chase is immediate');
});
test('breaking line of sight while suspected leaves the enemy searching the last spot for eight seconds',()=>{
 const {enemies,e}=arena();const player={x:0,z:8},filled=9*.05*litRate(8);
 for(let i=0;i<9;i++)tick(enemies,player,{lit:true});
 assert.equal(e.brain.mode,'patrol');close(e.alert,filled);assert.ok(filled>=SUSPECT_AT&&filled<1);assert.deepEqual(e.suspect,player);
 let forget=0;for(;forget<40&&e.suspect;forget++)tick(enemies,{x:0,z:-30},{});
 assert.equal(forget,Math.ceil((filled-FORGET_AT)/(NOTICE_DECAY*.05)),'the suspect is forgotten on the tick the gauge drops below FORGET_AT');
 assert.equal(e.brain.mode,'patrol');assert.deepEqual(e.investigate,player);close(e.searchTime,8*AREA_MULTIPLIERS.blue.search);assert.equal(e.suspect,null);
});
/** Walk a straight chord past the enemy at a lateral offset, in the dark. */
const pass=(mode:'normal'|'hard'|'nightmare',offset:number,speed:number,crouch:boolean,kind:Enemy['kind']='normal')=>{
 const {enemies,e}=arena(mode,kind);// faces +z: the visitor crosses in front along x
 let x=-4,noticed=false;while(x<4){x+=speed*.05;if(tick(enemies,{x,z:offset},{moving:true,crouch}))return 'caught';if(e.brain.mode==='chase')return 'chase';noticed||=(e.alert??0)>=SUSPECT_AT;}
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
 /** Top speed over two seconds of single steps from the same spot, with or without the ring. */
 const fastest=(kind:'hatred'|'wrath',difficulty:number,ring:boolean)=>{
  const enemies=new Enemies(corridor,[]);enemies.difficulty={enemies:true,sense:1,speed:difficulty,search:1};
  const random=()=>kind==='hatred'?0:.9;enemies.beginFinale({x:0,z:0},0,random);const boss=enemies.actors[0];boss.kind=kind;boss.position={x:-6,z:0};boss.floor=0;
  if(ring)enemies.ring={center:{x:0,z:0},radius:7,scale:ringScale(kind,difficulty)};boss.traitTime=kind==='hatred'?30:.8;
  let worst=0;for(let t=0;t<2;t+=.05){const before={...boss.position};enemies.update(.05,{x:40,z:0},[]);boss.traitTime=kind==='hatred'?30:.8;worst=Math.max(worst,Math.hypot(boss.position.x-before.x,boss.position.z-before.z)/.05);boss.position={x:-6,z:0};}
  return worst;
 };
 for(const kind of ['hatred','wrath'] as const)for(const difficulty of [.85,1.2]){
  const free=fastest(kind,difficulty,false),ringed=fastest(kind,difficulty,true);
  assert.ok(free>SPRINT_SPEED,'without the ring '+kind+' '+difficulty+' outruns a sprint: '+free);
  assert.ok(ringed<SPRINT_SPEED,kind+' '+difficulty+' '+ringed);close(ringed,free*ringScale(kind,difficulty),'the ring scales the step exactly');
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
 const hunters=enemies.hunt(origin,0,2,35,seededRandom(3)),around=enemies.nodesNear(origin,0,HUNT_RADIUS);
 assert.deepEqual(hunters.map(h=>h.id),[3,4]);
 for(const h of hunters){
  assert.ok(around.some(p=>p.x===h.investigate!.x&&p.z===h.investigate!.z),'a corridor node within HUNT_RADIUS of the warning point: '+JSON.stringify(h.investigate));
  assert.equal(h.hunting,35);assert.equal(h.searchBranches,4);assert.equal(h.searchTime,35);
 }
 assert.equal(enemies.actors[2].investigate,null);
 const targets=hunters.map(h=>({...h.investigate!})),live={x:60,z:-40},roster=enemies.actors;
 enemies.actors=hunters;// only the hunters step; the rest of this staged roster stands off-graph
 enemies.update(.05,live,l.obstacles);enemies.actors=roster;
 assert.deepEqual(hunters.map(h=>h.investigate),targets,'a step with the visitor elsewhere does not redirect the hunters');
 for(const h of hunters)close(h.hunting,35-.05,'the hunt timer counts down');
});
test('blue areas lose safety with the night; red areas and the untouched default keep their multipliers',()=>{
 const l=createLayout(),area=createAreaLookup(l.cells),enemies=new Enemies(l.cells,l.obstacles),e=enemies.actors[0],raw=ENEMY_PROFILES.normal.hearing;
 assert.deepEqual(enemies.modifiers,{blueBalance:0,sense:1,hearing:1});
 /** Does a normal enemy `distance` metres from a noise hear it? */
 const hears=(noise:{x:number;z:number},distance:number,axis:'x'|'z')=>{e.position=axis==='z'?{x:noise.x,z:noise.z-distance}:{x:noise.x+distance,z:noise.z};e.investigate=null;enemies.hear(noise);return e.investigate!==null;};
 const blue=(radius:number)=>{const near={x:0,z:radius-.1},far={x:0,z:radius+.1};assert.equal(area(near),'blue');assert.equal(area(far),'blue');e.position={x:0,z:0};e.investigate=null;enemies.hear(near);const a=e.investigate!==null;e.investigate=null;enemies.hear(far);return [a,e.investigate!==null];};
 assert.deepEqual(blue(raw*AREA_MULTIPLIERS.blue.sense),[true,false],'untouched default: 35.2 m blue hearing');
 enemies.modifiers.blueBalance=.55;assert.deepEqual(blue(raw*(.4+.6*.55)),[true,false],'丑三つ時: 0.73×88 m');
 assert.equal(hears({x:0,z:35.3},35.3,'z'),true,'beyond the old blue radius once the night deepens');
 enemies.modifiers.blueBalance=3;assert.deepEqual(blue(raw),[true,false],'a deep night never exceeds the raw radius');
 const red={x:-96,z:0},redRadius=raw*AREA_MULTIPLIERS.red.sense;assert.equal(area(red),'red');
 for(const balance of [0,.55,3]){enemies.modifiers.blueBalance=balance;assert.deepEqual([hears(red,redRadius-.1,'x'),hears(red,redRadius+.1,'x')],[true,false],'red stays 145.2 m at balance '+balance);}
});
test('sleepers neither see nor move until bumped, heard, flashed or woken by the toll',()=>{
 const {enemies,e}=arena();enemies.setDormant([e.id]);assert.equal(e.dormant,true);
 const home={...e.position};for(let t=0;t<30;t+=.05)assert.equal(tick(enemies,{x:0,z:2},{lit:true,moving:false}),false);
 assert.deepEqual(e.position,home);assert.equal(e.brain.mode,'patrol');assert.equal(e.investigate,null);assert.equal(e.alert,0);
 tick(enemies,{x:0,z:1.5},{moving:true,crouch:true});assert.equal(e.dormant,true,'a crouching visitor slips past at 1.5 m');
 tick(enemies,{x:0,z:1.5},{moving:true});assert.equal(e.dormant,false,'a standing walker wakes it inside the dark radius');
 assert.equal(e.brain.reacquireDelay,1.5);assert.equal(e.wakeTurn,WAKE_TURN_SECONDS);
 const {enemies:b,e:eb}=arena();b.setDormant([eb.id]);tick(b,{x:0,z:.9},{moving:true,crouch:true});assert.equal(eb.dormant,false,'contact wakes regardless of posture');
 const {enemies:c,e:ec}=arena();c.setDormant([ec.id]);c.hear({x:0,z:12});assert.equal(ec.dormant,true);assert.equal(ec.investigate,null);c.hear({x:0,z:9});assert.equal(ec.dormant,false);
 const {enemies:d,e:ed}=arena();d.setDormant([ed.id]);assert.equal(d.burst({x:0,z:3,y:1.5},[],0,0,0),1);assert.equal(ed.dormant,false);assert.equal(ed.brain.stunRemaining,STUN_SECONDS);
});
test('toll wake-ups skip sleepers near or in view of the visitor; reset keeps the still-sleeping asleep',()=>{
 const l=createLayout(),enemies=new Enemies(l.cells,l.obstacles),ids=enemies.actors.filter(a=>a.homeFloor===0).slice(0,3).map(a=>a.id);
 enemies.setDormant(ids);const sleepers=enemies.actors.filter(a=>a.dormant);assert.equal(sleepers.length,3);
 const near=sleepers[0];const player={x:near.position.x+5,z:near.position.z};
 // The other two sleepers stand over 40 m away behind the shrine's walls, so both qualify.
 const woke=enemies.wakeBatch(3,player,0,l.obstacles);
 assert.equal(near.dormant,true,'a sleeper 5 m away never wakes at the toll');assert.equal(woke,2);assert.deepEqual(sleepers.map(s=>s.dormant),[true,false,false]);
 assert.equal(enemies.wakeBatch(3,player,0,l.obstacles,true),1,'the deferred sleeper wakes once forced');assert.equal(near.dormant,false);
 enemies.setDormant(ids);enemies.wake(sleepers[1]);enemies.reset();
 assert.deepEqual(enemies.actors.filter(a=>a.dormant).map(a=>a.id).sort(),[sleepers[0].id,sleepers[2].id].sort());
 enemies.setDormant([]);assert.equal(enemies.actors.some(a=>a.dormant),false);
 // TOLL_WAKE_DISTANCE is the boundary for a hidden sleeper; one in plain view never wakes.
 const {enemies:c,e:s}=arena(),wall=[{minX:4,maxX:5,minZ:-3,maxZ:3}];
 const at=(x:number,blockers=wall)=>{c.setDormant([s.id]);return c.wakeBatch(1,{x,z:0},0,blockers);};
 assert.equal(at(TOLL_WAKE_DISTANCE-.5),0);assert.equal(s.dormant,true);
 assert.equal(at(TOLL_WAKE_DISTANCE+.5),1);assert.equal(s.dormant,false);
 assert.equal(at(TOLL_WAKE_DISTANCE+.5,[]),0,'a sleeper the visitor can see stays asleep');
});
test('sleepers are left out of squad responses and hunts',()=>{
 /** Four normal masks on the corridor; the sleeper stands nearest to every call. */
 const squad=()=>{
  const enemies=new Enemies(corridor,[]),[a0,a1,a2,a3]=enemies.actors;enemies.actors=[a0,a1,a2,a3];
  for(const e of enemies.actors){e.kind='normal';e.floor=0;e.homeFloor=0;e.destinationFloor=0;e.investigate=null;}
  enemies.setDormant([a1.id]);
  a0.position={x:0,z:0};a1.position={x:2,z:0};a2.position={x:6,z:0};a3.position={x:10,z:0};
  for(const e of [a1,a2,a3])e.facing=Math.PI;// backs to the visitor: only the source sees them
  return {enemies,a0,a1,a2,a3};
 };
 {
  const {enemies,a0,a1,a2}=squad();// a1 and a2 tie at 2 m; the id tie-break would pick the sleeper
  const hunters=enemies.hunt({x:4,z:0},0,2,20,seededRandom(1));
  assert.deepEqual(hunters.map(h=>h.id),[a2.id,a0.id]);assert.equal(a1.investigate,null);assert.equal(a1.hunting,0);
 }
 {
  const {enemies,a0,a1,a2,a3}=squad();a0.facing=0;a0.brain.mode='chase';a0.brain.lastSeen={x:0,z:2};
  enemies.update(.05,{x:0,z:2},[],0,undefined,true,undefined,true);
  assert.equal(a0.brain.mode,'chase');assert.equal(a1.investigate,null,'the sleeper nearest the report is skipped');
  assert.deepEqual(a2.investigate,{x:0,z:2},'the next nearest answers the report');assert.equal(a3.investigate,null,'a normal source calls one responder');
 }
});
test('a lost chase leaves no gauge or suspect behind, and the hidden visitor is never tracked',()=>{
 const {enemies,e}=arena();const seen={x:0,z:9.5},hidden={x:-3,z:-4};
 let ticks=0;while(e.brain.mode!=='chase'&&ticks<60){tick(enemies,seen,{lit:true});ticks++;}
 assert.equal(e.brain.mode,'chase');assert.deepEqual(e.brain.lastSeen,seen);assert.equal(e.alertSource,'lit');
 assert.equal(e.suspect,null,'the suspicion that preceded the chase is dropped once it starts');
 // Hidden: dark and still, somewhere else. Sight is lost for LOSE_SIGHT_SECONDS before the brain gives up.
 let lost=0;while(e.brain.mode==='chase'&&lost<60){tick(enemies,hidden);lost++;}
 assert.equal(lost,Math.round(LOSE_SIGHT_SECONDS/.05));
 assert.equal(e.brain.mode,'patrol');assert.deepEqual(e.investigate,seen);assert.equal(e.alert,0);assert.equal(e.suspect,null);
 close(e.searchTime,14*AREA_MULTIPLIERS.blue.search-.05,'a fourteen-second search, one tick spent');
 for(let i=0;i<15;i++){
  const before={...e.position},target:{x:number;z:number}=e.investigate!;tick(enemies,hidden);
  assert.equal(e.suspect,null);assert.equal(e.alert,0);assert.deepEqual(e.investigate,target);
  assert.ok(Math.hypot(target.x-e.position.x,target.z-e.position.z)<Math.hypot(target.x-before.x,target.z-before.z),'keeps closing on the last seen spot');
  close(e.facing,bearing(before,target),'faces its search target');assert.ok(angle(e.facing,bearing(before,hidden))>Math.PI/2,'never toward the hidden visitor');
 }
 /** A searcher bound for z=12 with a hidden visitor behind it. */
 const searching=()=>{const a=arena();a.enemies.attend(a.e,{x:0,z:12},0,20,1);return a;};
 {
  // A gauge above SUSPECT_AT with nothing sensed must not invent a suspect from the hidden visitor's position.
  const {enemies,e}=searching();e.alert=.9;
  for(let i=0;i<5;i++){const z=e.position.z;tick(enemies,hidden);assert.ok((e.alert??0)>=SUSPECT_AT);assert.equal(e.suspect??null,null);assert.ok(e.position.z>z,'does not halt');assert.equal(e.facing,0);}
 }
 {
  // The hunting timer path: when the hunt expires, the suspicion branch runs with nothing sensed.
  const {enemies,e}=searching();e.alert=.9;e.hunting=.2;
  let left=.2,expiry=0;while((left=Math.max(0,left-.05))>0)expiry++;// the tick on which the same countdown reaches 0
  let expired=-1;
  for(let i=0;i<10;i++){
   const z=e.position.z;tick(enemies,hidden);
   if(expired<0&&e.hunting===0){expired=i;assert.ok((e.alert??0)>=SUSPECT_AT,'the gauge is still high when the hunt ends');}
   assert.equal(e.suspect??null,null);assert.ok(e.position.z>z,'keeps walking its search');assert.equal(e.facing,0);
  }
  assert.equal(expired,expiry,'the hunt expires on the expected tick, leaving later ticks for the now unguarded suspicion branch');assert.ok(expiry<9);
 }
});
test('a dark walker in reach halts a walking enemy, which turns toward it and then searches the last sensed spot',()=>{
 const {enemies,e}=arena();enemies.patrolTargets[0].point={x:0,z:20};// a post ahead keeps it walking unless something halts it
 const walker=(k:number)=>({x:1.4,z:1.9+.05*k}),hidden={x:-1.5,z:-1};
 let k=0,before={...e.position};
 while((e.alert??0)<SUSPECT_AT&&k<20){
  before={...e.position};tick(enemies,walker(k),{moving:true});k++;
  if((e.alert??0)<SUSPECT_AT){assert.ok(e.position.z>before.z,'walks its patrol until suspicious');assert.equal(e.suspect??null,null);}
 }
 assert.equal(k,7,'dark fill of 1/s crosses SUSPECT_AT on the seventh 50 ms tick');assert.equal(e.alertSource,'dark');assert.equal(e.brain.mode,'patrol');
 const halted={...e.position};assert.deepEqual(halted,before,'halts on the tick it becomes suspicious');assert.deepEqual(e.suspect,walker(k-1));
 for(let i=0;i<3;i++,k++){
  const f=e.facing;tick(enemies,walker(k),{moving:true});const target=bearing(halted,walker(k));
  assert.deepEqual(e.suspect,walker(k),'tracks the visitor while sensing');assert.deepEqual(e.position,halted);
  assert.ok(angle(e.facing,f)<=TURN_RATE*.05+1e-12&&angle(e.facing,target)<angle(f,target),'turns toward it at TURN_RATE');
 }
 assert.ok((e.alert??0)<1);
 const last=walker(k-1),toLast=bearing(halted,last);let halts=0,haltFacing=NaN;
 for(let i=0;i<40&&(e.alert??0)>=FORGET_AT;i++){
  const f=e.facing,p={...e.position};tick(enemies,hidden);
  if((e.alert??0)>=FORGET_AT)assert.deepEqual(e.suspect,last,'the suspect point never follows the stopped, hidden visitor');
  if((e.alert??0)>=SUSPECT_AT){halts++;haltFacing=e.facing;assert.deepEqual(e.position,p);assert.ok(angle(e.facing,toLast)<=angle(f,toLast));}
 }
 assert.ok(halts>=3);close(haltFacing,toLast,'facing settles on the last sensed point');assert.ok(angle(haltFacing,bearing(halted,hidden))>2);
 assert.equal(e.suspect,null);assert.deepEqual(e.investigate,last);close(e.searchTime,8*AREA_MULTIPLIERS.blue.search);assert.equal(e.brain.mode,'patrol');
});
test('alertSource records whether the latest fill came from dark sense or from sight',()=>{
 const {enemies,e}=arena();assert.equal(e.alertSource,undefined);
 tick(enemies,{x:0,z:9});assert.equal(e.alertSource,undefined,'nothing sensed, nothing recorded');assert.equal(e.alert,0);
 tick(enemies,{x:0,z:1.8},{moving:true});assert.equal(e.alertSource,'dark');close(e.alert,.05);
 tick(enemies,{x:0,z:1.8});assert.equal(e.alertSource,'dark','a still visitor is not sensed: the dark source stays while the gauge decays');close(e.alert,.05-NOTICE_DECAY*.05);
 tick(enemies,{x:0,z:1.8},{moving:true});assert.equal(e.alertSource,'dark');close(e.alert,.05-NOTICE_DECAY*.05+.05);
 const dark=e.alert!;tick(enemies,{x:0,z:9},{lit:true});assert.equal(e.alertSource,'lit');close(e.alert,dark+.05*litRate(9));
 tick(enemies,{x:0,z:9});assert.equal(e.alertSource,'lit','an unsensed tick keeps the last source while the gauge decays');close(e.alert,dark+.05*litRate(9)-NOTICE_DECAY*.05);
 tick(enemies,{x:0,z:1.8},{moving:true});assert.equal(e.alertSource,'dark');
});
test('a woken sleeper spends WAKE_TURN_SECONDS turning in place, blind, toward the corridor before it patrols; a stun overrides the turn',()=>{
 const {enemies,e}=arena();e.home={x:1,z:0};enemies.setDormant([e.id]);
 const node={x:0,z:0},target=bearing(e.home,node);// the nearest corridor node is 1 m behind its back
 assert.deepEqual(e.position,{x:1,z:0});close(angle(e.facing,target),Math.PI,'asleep with its back to the corridor');
 enemies.wake(e);assert.equal(e.wakeTurn,WAKE_TURN_SECONDS);assert.equal(e.dormant,false);
 const dt=.25;let turns=0;
 while((e.wakeTurn??0)>0&&turns<10){
  const before=angle(e.facing,target),f=e.facing;
  assert.equal(tick(enemies,{x:1,z:1},{lit:true,dt}),false);turns++;
  assert.deepEqual(e.position,{x:1,z:0},'no movement while turning');assert.equal(e.alert??0,0,'blind while turning, even to a lit visitor at arm\'s length');assert.equal(e.brain.mode,'patrol');
  close(angle(e.facing,f),Math.min(before,TURN_RATE*dt),'turns at TURN_RATE');close(angle(e.facing,target),Math.max(0,before-TURN_RATE*dt));
 }
 assert.equal(turns,WAKE_TURN_SECONDS/dt);assert.equal(e.wakeTurn,0);
 tick(enemies,{x:-30,z:0},{dt:.05});assert.ok(e.position.x<1,'after the turn it walks to its post');close(e.facing,target);
 const {enemies:s,e:es}=arena();s.setDormant([es.id]);const asleep=es.facing;
 s.stunActor(es);assert.equal(es.dormant,false);assert.equal(es.wakeTurn,0);assert.equal(es.brain.mode,'stunned');assert.equal(es.brain.stunRemaining,STUN_SECONDS);
 tick(s,{x:-30,z:0});close(es.brain.stunRemaining,STUN_SECONDS-.05,'the stun counts down');assert.equal(es.facing,asleep);assert.deepEqual(es.position,{x:0,z:0});
 const {enemies:m,e:em}=arena();m.setDormant([em.id]);const sleeping=em.facing;m.wake(em);tick(m,{x:-30,z:0},{dt:.25});
 close(em.wakeTurn,WAKE_TURN_SECONDS-.25);const midTurn=em.facing;close(angle(midTurn,sleeping),TURN_RATE*.25,'a quarter of the turn is done');
 m.stunActor(em);assert.equal(em.wakeTurn,0,'a flash mid-turn ends the turn');assert.equal(em.brain.mode,'stunned');
 tick(m,{x:-30,z:0});assert.equal(em.facing,midTurn);assert.deepEqual(em.position,{x:0,z:0});close(em.brain.stunRemaining,STUN_SECONDS-.05);
 const {enemies:w,e:ew}=arena();w.setDormant([ew.id]);w.wake(ew);ew.brain.stun(2);const turning=ew.facing;
 tick(w,{x:-30,z:0});close(ew.brain.stunRemaining,1.95,'a stun landing mid-turn proceeds');assert.equal(ew.facing,turning,'and the turn waits');assert.equal(ew.wakeTurn,WAKE_TURN_SECONDS,'without spending the turn');
});
test('雨夜 narrows running-footstep hearing through hear({scale}); without options hear() keeps the historical rule byte for byte',()=>{
 const l=createLayout(),area=createAreaLookup(l.cells),rain=omenParams(['rain']).runHearing,enemies=new Enemies(l.cells,l.obstacles),e=enemies.actors[0];
 assert.equal(rain,.6);
 const blueRadius=ENEMY_PROFILES.normal.hearing*AREA_MULTIPLIERS.blue.sense;// 35.2 m, as in hearing.test.ts
 const heard=(x:number,opts?:HearOptions)=>{assert.equal(area({x,z:0}),'blue');e.position={x:0,z:0};e.investigate=null;enemies.hear({x,z:0},0,opts);return e.investigate!==null;};
 assert.deepEqual([heard(blueRadius-.1),heard(blueRadius+.1)],[true,false]);
 assert.deepEqual([heard(blueRadius*rain-.1,{scale:rain}),heard(blueRadius*rain+.1,{scale:rain})],[true,false],'rain: 21.1 m');
 assert.equal(heard(blueRadius*rain+.1),true,'the same run is heard on a dry night');
 assert.deepEqual([heard(blueRadius*1.5-.1,{scale:1.5}),heard(blueRadius*1.5+.1,{scale:1.5}),heard(blueRadius*1.5-.1)],[true,false,false],'a scale above 1 widens it');
 // The scale changes only who hears, not how long they search.
 e.searchTime=0;heard(20,{scale:rain});const rainy=[e.searchTime,e.searchBranches];e.searchTime=0;heard(20);assert.deepEqual(rainy,[e.searchTime,e.searchBranches]);
 /** Every actor's response to one call, from a clean slate. */
 const respond=(call:()=>number)=>{
  for(const a of enemies.actors){a.investigate=null;a.searchTime=0;a.searchBranches=0;a.planIn=1;a.route=[{x:1,z:1}];a.destinationFloor=a.homeFloor;}
  const count=call();return JSON.stringify({count,actors:enemies.actors.map(a=>({investigate:a.investigate,searchTime:a.searchTime,searchBranches:a.searchBranches,planIn:a.planIn,route:a.route,destinationFloor:a.destinationFloor}))});
 };
 /** The running-footstep rule as it stood before HearOptions existed. */
 const historical=(noise:{x:number;z:number})=>respond(()=>{
  const balance=AREA_MULTIPLIERS[area(noise)];let count=0;
  for(const a of enemies.actors){
   const d=Math.hypot(a.position.x-noise.x,a.position.z-noise.z);if(d>ENEMY_PROFILES[a.kind].hearing*balance.sense)continue;count++;
   a.planIn=Math.min(a.planIn,.03*a.id);a.route=[];a.investigate={...noise};a.destinationFloor=0;a.searchBranches=a.kind==='warden'?5:a.kind==='listener'?3:2;
   a.searchTime=Math.max((a.kind==='warden'?65:45)*balance.search,d/(3.3*balance.speed)+8*balance.search);
  }
  return count;
 });
 for(const noise of [{x:25,z:0},{x:-96,z:0},{x:60,z:-30}]){
  const plain=respond(()=>enemies.hear(noise));const {count}=JSON.parse(plain);
  assert.ok(count>0&&count<enemies.actors.length,'some but not all hear '+JSON.stringify(noise)+': '+count);
  assert.equal(plain,historical(noise),'historical rule at '+JSON.stringify(noise));
  assert.equal(respond(()=>enemies.hear(noise,0,{})),plain);assert.equal(respond(()=>enemies.hear(noise,0,{scale:1})),plain);
 }
 // hearing.test.ts's scenario: a run at (25,0) with a normal mask 25 m away and 赤面 (danger) 15 m away.
 const boss=enemies.actors[4];assert.equal(boss.kind,'danger');
 const scenario=(x:number,opts?:HearOptions)=>{e.position={x:0,z:0};boss.position={x:40,z:0};e.investigate=null;boss.investigate=null;enemies.hear({x,z:0},0,opts);return [e.investigate,boss.investigate];};
 assert.deepEqual(scenario(25),[{x:25,z:0},{x:25,z:0}],'a dry night: both hear, as in hearing.test.ts');
 assert.deepEqual(scenario(37),[null,{x:37,z:0}],'a dry night: the mask stops at 35.2 m');
 assert.deepEqual(scenario(25,{scale:rain}),[null,{x:25,z:0}],'雨夜: 25 m is beyond the mask\'s 21.1 m, while 赤面 still hears at 15 m (60 m × .6 = 36 m)');
 assert.deepEqual(scenario(3.9,{scale:rain}),[{x:3.9,z:0},null],'雨夜: 赤面 36.1 m away no longer hears');
});
