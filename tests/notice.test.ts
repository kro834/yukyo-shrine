import test from 'node:test';import assert from 'node:assert/strict';
import {NOTICE_OFF,NOTICE_DECAY,SUSPECT_AT,FORGET_AT,TURN_RATE,CROUCH_DARK,CROUCH_LIT,HUNTER_FILL,RUN_INSTANT,KIND_DARK,litFillRate,darkFillRate,stepAlert,turnToward,type NoticeRules} from '../app/notice.ts';
import {EXTRA_ENEMY_PROFILES} from '../app/enemy-traits.ts';
import {WALK_SPEED} from '../app/movement.ts';
import {CROUCH_PACE} from '../app/posture.ts';
import {AREA_MULTIPLIERS} from '../app/area-rules.ts';
import type {Enemy} from '../app/shrine-gameplay.ts';
import type {Cell} from '../app/shrine-layout.ts';
import type {Obstacle,Position} from '../app/movement.ts';
const NORMAL:NoticeRules={seconds:1.2,darkRadius:2.4,darkFill:1},HARD:NoticeRules={seconds:.85,darkRadius:3,darkFill:1.25},NIGHTMARE:NoticeRules={seconds:.6,darkRadius:3.6,darkFill:1.5};
const MODES=[NORMAL,HARD,NIGHTMARE],CRAWL=WALK_SPEED*CROUCH_PACE;
const close=(actual:number,expected:number,epsilon=1e-9,message?:string)=>assert.ok(Math.abs(actual-expected)<=epsilon,message??`${actual} ≉ ${expected}`);
/** Integrates a gauge at a fixed rate until it is full; returns the elapsed time. */
const fillTime=(rate:number,dt=.01)=>{let alert=0,t=0;while(alert<1&&t<60){alert=stepAlert(alert,rate,dt);t+=dt;}return t;};
/** An enemy at the origin faces +z; a dark visitor crosses along x at `offset` (negative = behind). */
const pass=(rules:NoticeRules,offset:number,speed:number,{crouching=false,kind='normal',hunting=false,dt=1/60}={})=>{
 let alert=0,peak=0;
 for(let i=0,steps=Math.ceil(12/(speed*dt));i<=steps;i++){
  const x=-6+i*speed*dt,distance=Math.hypot(x,offset),facing=offset/Math.max(.01,distance);
  alert=stepAlert(alert,darkFillRate(rules,kind,distance,facing,true,crouching,hunting),dt);peak=Math.max(peak,alert);
 }
 return peak;
};
/** Largest crossing offset whose chord through the dark radius fills the gauge. */
const catchOffset=(rules:NoticeRules,speed:number,crouching=false)=>Math.sqrt(Math.max(0,rules.darkRadius**2-(speed/(2*rules.darkFill*(crouching?CROUCH_DARK:1)))**2));

test('constants match the balance table and suspicion has hysteresis',()=>{
 assert.deepEqual(NOTICE_OFF,{seconds:0,darkRadius:0,darkFill:0});
 assert.deepEqual([NOTICE_DECAY,SUSPECT_AT,FORGET_AT,TURN_RATE,CROUCH_DARK,CROUCH_LIT,HUNTER_FILL,RUN_INSTANT],[.6,.35,.2,2.5,.3,.6,1.4,12]);
 assert.ok(FORGET_AT<SUSPECT_AT&&SUSPECT_AT<1);
 assert.deepEqual({...KIND_DARK},{listener:1.4,errorWeep:1.5,warden:1.2,watcher:.6,errorWatch:0,hotelStaff:.8,hotelGuest:.8});
});
test('every KIND_DARK entry names a real enemy kind',()=>{
 const kinds=new Set([...Object.keys(EXTRA_ENEMY_PROFILES),'normal','danger','listener','watcher','stalker']);
 for(const kind of Object.keys(KIND_DARK))assert.ok(kinds.has(kind),kind);
});

test('litFillRate fills in exactly `seconds` at the edge of sight for every mode',()=>{
 for(const rules of MODES){
  close(litFillRate(rules,25,25,4,false,false,false),1/rules.seconds);
  close(litFillRate(rules,24.999999,25,4,false,false,false),1/rules.seconds,1e-6);
  let alert=0;for(let t=0;t<rules.seconds-1e-9;t+=.05)alert=stepAlert(alert,litFillRate(rules,25,25,4,false,false,false),.05);
  assert.equal(alert,1,'full exactly at `seconds`');
  alert=0;for(let t=0;t<rules.seconds-.05-1e-9;t+=.05)alert=stepAlert(alert,litFillRate(rules,25,25,4,false,false,false),.05);
  assert.ok(alert<1,'one frame earlier is not yet full');
 }
});
test('litFillRate: ~0.7 s at half range, ~0.3 s up close, never slower than the edge beyond it',()=>{
 close(1/litFillRate(NORMAL,12.5,25,0,false,false,false),1.2/1.75);assert.ok(Math.abs(1/litFillRate(NORMAL,12.5,25,0,false,false,false)-.7)<.02);
 close(1/litFillRate(NORMAL,0,25,0,false,false,false),.3);
 close(litFillRate(NORMAL,40,25,4,false,false,false),1/1.2,1e-12,'outside the range the falloff clamps rather than rising again');
 close(litFillRate(NORMAL,10,0,0,false,false,false),1/1.2,1e-12,'a zero range cannot divide by zero');
});
test('litFillRate is monotonic: nearer always fills at least as fast, strictly inside the range',()=>{
 for(const rules of MODES)for(const [sight,near] of [[25,4],[10,1.6],[41.25,6.6],[6,1.12]]){
  let previous=Infinity;
  for(let d=near;d<=sight;d+=sight/200){const rate=litFillRate(rules,d,sight,near,false,false,false);assert.ok(Number.isFinite(rate));assert.ok(rate<previous,`${d} m`);previous=rate;}
 }
});
test('litFillRate is instant inside nearSight, for a runner within 12 m, and when notice is off',()=>{
 assert.equal(litFillRate(NORMAL,3.99,25,4,false,false,false),Infinity);
 assert.ok(Number.isFinite(litFillRate(NORMAL,4,25,4,false,false,false)),'the near boundary itself is graded, like `sees`');
 assert.equal(litFillRate(NORMAL,2.7,25,2.8,false,true,false),Infinity,'crouched near range is the caller’s posture-adjusted value');
 assert.equal(litFillRate(NORMAL,11.99,25,4,true,false,false),Infinity);
 assert.ok(Number.isFinite(litFillRate(NORMAL,12,25,4,true,false,false)));
 assert.ok(Number.isFinite(litFillRate(NORMAL,11.99,25,4,false,false,false)),'walking at the same distance is graded');
 for(const d of [.5,10,24])assert.equal(litFillRate(NOTICE_OFF,d,25,0,false,true,false),Infinity,'NOTICE_OFF keeps today’s immediate chase');
 assert.equal(stepAlert(0,Infinity,1/60),1);assert.equal(stepAlert(.2,Infinity,1e-6),1);
});
test('litFillRate: crouching ×0.6, hunters ×1.4, both combine',()=>{
 for(const rules of MODES)for(const d of [5,12.5,24]){
  const base=litFillRate(rules,d,25,4,false,false,false);
  close(litFillRate(rules,d,25,4,false,true,false),base*CROUCH_LIT);
  close(litFillRate(rules,d,25,4,false,false,true),base*HUNTER_FILL);
  close(litFillRate(rules,d,25,4,false,true,true),base*CROUCH_LIT*HUNTER_FILL);
 }
 close(fillTime(litFillRate(NORMAL,25,25,4,false,true,false),.001),2,.002,'a crouched edge sighting takes 2 s on normal');
});
test('a lit sighting at 20 m of a 41 m red-area range is not full after 0.5 s but is by 1.3 s',()=>{
 const rate=litFillRate(NORMAL,20,41.25,6.6,false,false,false);let alert=0;
 for(let i=0;i<10;i++)alert=stepAlert(alert,rate,.05);assert.ok(alert<1);
 for(let i=0;i<16;i++)alert=stepAlert(alert,rate,.05);assert.equal(alert,1);
});

test('darkFillRate is 0 for a still visitor at any distance',()=>{
 for(const rules of MODES)for(const d of [0,.3,.89,1.5])for(const facing of [-1,0,1])for(const kind of ['normal','listener','errorWeep'])
  for(const crouching of [false,true])for(const hunting of [false,true])assert.equal(darkFillRate(rules,kind,d,facing,false,crouching,hunting),0);
});
test('darkFillRate fills at darkFill inside the radius and is 0 at or beyond it',()=>{
 for(const rules of MODES){
  for(const d of [0,.5,rules.darkRadius-1e-6])assert.equal(darkFillRate(rules,'normal',d,1,true,false,false),rules.darkFill);
  for(const d of [rules.darkRadius,rules.darkRadius+.01,20])assert.equal(darkFillRate(rules,'normal',d,1,true,false,false),0);
 }
 for(const d of [0,.3,2])assert.equal(darkFillRate(NOTICE_OFF,'normal',d,1,true,false,true),0,'NOTICE_OFF never senses');
 assert.equal(darkFillRate({...NORMAL,darkFill:0},'normal',.3,1,true,false,false),0);
});
test('darkFillRate scales the radius by KIND_DARK; errorWatch never senses; unlisted kinds use 1',()=>{
 for(const [kind,factor] of Object.entries(KIND_DARK)){
  const reach=NORMAL.darkRadius*factor;
  if(factor>0)assert.ok(darkFillRate(NORMAL,kind,reach-.01,1,true,false,false)>0,kind);
  assert.equal(darkFillRate(NORMAL,kind,reach+.01,1,true,false,false),0,kind);
 }
 for(const d of [0,.05,.5])assert.equal(darkFillRate(NIGHTMARE,'errorWatch',d,1,true,false,true),0);
 assert.ok(darkFillRate(NORMAL,'listener',3.3,1,true,false,false)>0);assert.equal(darkFillRate(NORMAL,'normal',3.3,1,true,false,false),0);
 assert.equal(darkFillRate(NORMAL,'watcher',1.5,1,true,false,false),0);
 for(const kind of ['normal','danger','stalker','fox','crusher','hatred','constructor','toString'])assert.equal(darkFillRate(NORMAL,kind,2.39,1,true,false,false),1,kind);
});
test('darkFillRate halves the reach behind the enemy beyond 0.9 m',()=>{
 for(const rules of MODES){const half=rules.darkRadius/2;
  assert.ok(darkFillRate(rules,'normal',half+.1,.01,true,false,false)>0,'any forward component is in front');
  assert.equal(darkFillRate(rules,'normal',half+.1,0,true,false,false),0,'exactly abeam counts as behind');
  assert.equal(darkFillRate(rules,'normal',half+.1,-1,true,false,false),0);
  assert.ok(darkFillRate(rules,'normal',half-.1,-1,true,false,false)>0);
 }
 assert.equal(darkFillRate(NORMAL,'normal',1.5,-1,true,false,false),0);assert.equal(darkFillRate(NORMAL,'normal',.8,-1,true,false,false),1);
 // A watcher's halved reach (0.72 m) is shorter than touching range, which keeps the full 1.44 m.
 assert.equal(darkFillRate(NORMAL,'watcher',.85,-1,true,false,false),1);assert.equal(darkFillRate(NORMAL,'watcher',.95,-1,true,false,false),0);
 assert.equal(darkFillRate(NORMAL,'watcher',.95,1,true,false,false),1);
});
test('darkFillRate: crouching ×0.3, hunters ×1.4',()=>{
 for(const rules of MODES){
  close(darkFillRate(rules,'normal',1,1,true,true,false),rules.darkFill*CROUCH_DARK);
  close(darkFillRate(rules,'normal',1,1,true,false,true),rules.darkFill*HUNTER_FILL);
  close(darkFillRate(rules,'normal',1,1,true,true,true),rules.darkFill*CROUCH_DARK*HUNTER_FILL);
 }
 assert.equal(darkFillRate(NORMAL,'normal',2.5,1,true,true,true),0,'neither posture nor hunting widens the reach');
});

test('stepAlert decays at 0.6/s when nothing fills and stays within [0,1]',()=>{
 close(stepAlert(1,0,.5),.7);close(stepAlert(.5,-3,.25),.35);close(stepAlert(.5,Number.NaN,.25),.35);
 assert.equal(stepAlert(.1,0,1),0);assert.equal(stepAlert(0,0,5),0);assert.equal(stepAlert(.9,2,1),1);
 close(stepAlert(.2,.5,.4),.4);
 let alert=1;for(let i=0;i<20;i++)alert=stepAlert(alert,0,.05);close(alert,.4);
 for(let i=0;i<14;i++)alert=stepAlert(alert,0,.05);assert.equal(alert,0,'decay lands exactly on 0');
});
test('stepAlert holds on a paused or invalid frame and sanitises the stored value',()=>{
 for(const dt of [0,-1,Number.NaN,Infinity])assert.equal(stepAlert(.5,2,dt),.5);
 assert.equal(stepAlert(.5,Infinity,0),.5,'no time passes during the time stop');
 assert.equal(stepAlert(Number.NaN,0,.1),0);assert.equal(stepAlert(3,0,0),1);assert.equal(stepAlert(-2,0,0),0);
});
test('stepAlert is frame-rate independent while filling and while decaying',()=>{
 const run=(dt:number)=>{let alert=0;for(let t=0;t<.6-1e-9;t+=dt)alert=stepAlert(alert,1.25,dt);const peak=alert;for(let t=0;t<.5-1e-9;t+=dt)alert=stepAlert(alert,0,dt);return [peak,alert];};
 const [a,b]=[run(1/120),run(1/20)];close(a[0],.75,1e-9);close(a[0],b[0],1e-9);close(a[1],.45,1e-9);close(a[1],b[1],1e-9);
});
test('suspicion telegraph timings: a 0.78 alert decays past FORGET_AT in under a second',()=>{
 let alert=.78,t=0;while(alert>=FORGET_AT){alert=stepAlert(alert,0,.01);t+=.01;}
 close(t,(.78-FORGET_AT)/NOTICE_DECAY,.011);
 alert=SUSPECT_AT;t=0;while(alert>=FORGET_AT){alert=stepAlert(alert,0,.01);t+=.01;}close(t,.25,.011);
});

test('turnToward turns at 2.5 rad/s along the shortest arc without overshooting',()=>{
 close(turnToward(0,Math.PI/2,.1),.25);close(turnToward(0,-Math.PI/2,.1),-.25);
 close(turnToward(0,.1,.1),.1,1e-12,'snaps onto a target within one step');
 close(turnToward(3,-3,.1),3.25,1e-12,'wraps across ±π the short way');close(turnToward(3,-3,1),3+(2*Math.PI-6),1e-12);
 close(turnToward(-3,3,.01),-3-.025);
 close(turnToward(0,Math.PI/2,.1,1),.1,1e-12,'custom rate');
 assert.equal(turnToward(1,2,0),1);assert.equal(turnToward(1,2,-1),1);
 close(turnToward(7*Math.PI,7*Math.PI+.2,.04),7*Math.PI+.1,1e-9,'continuous with an unwrapped yaw');
});
test('turnToward converges on a quarter-turn in ~0.63 s and holds there',()=>{
 let facing=0,t=0;while(Math.abs(facing-Math.PI/2)>1e-12&&t<5){facing=turnToward(facing,Math.PI/2,1/60);t+=1/60;}
 close(t,Math.PI/2/TURN_RATE,1/60+1e-9);for(let i=0;i<30;i++)facing=turnToward(facing,Math.PI/2,1/60);close(facing,Math.PI/2,1e-12);
});

test('normal: walking past at 1.5 m is caught, at 2.0 m it telegraphs and then forgets',()=>{
 assert.equal(pass(NORMAL,1.5,WALK_SPEED),1);
 const peak=pass(NORMAL,2,WALK_SPEED);assert.ok(peak>=SUSPECT_AT&&peak<1);close(peak,.78,.03);
 close(2*Math.sqrt(NORMAL.darkRadius**2-1.5**2)/WALK_SPEED,1.1,.01,'the chord at 1.5 m lasts 1.1 s');
});
test('normal: a crouched pass at 1.5 m telegraphs (≈0.66) and crouching never fills at any offset ≥0.5 m',()=>{
 const peak=pass(NORMAL,1.5,CRAWL,{crouching:true});assert.ok(peak>=SUSPECT_AT&&peak<1);close(peak,.66,.03);
 for(let offset=.5;offset<=2.4;offset+=.05)assert.ok(pass(NORMAL,offset,CRAWL,{crouching:true})<1,`${offset} m`);
});
test('dark passes behind the enemy: 1.5 m is unsensed; touching range always is',()=>{
 for(const rules of MODES.slice(0,2))assert.equal(pass(rules,-1.5,WALK_SPEED),0);
 const behind=(d:number)=>{let alert=0;for(let t=0;t<1.25;t+=1/60)alert=stepAlert(alert,darkFillRate(NORMAL,'normal',d,-1,true,false,false),1/60);return alert;};
 assert.equal(behind(1.5),0);assert.equal(behind(.8),1,'a visitor moving 0.8 m behind for 1.25 s is noticed');
});
test('a still visitor at 0.3 m in the dark never fills the gauge over 10 s',()=>{
 for(const rules of MODES){let alert=0;for(let t=0;t<10;t+=1/60)alert=stepAlert(alert,darkFillRate(rules,'errorWeep',.3,1,false,false,true),1/60);assert.equal(alert,0);}
});
test('the catch offset grows with difficulty and the chord model matches the simulation',()=>{
 for(const rules of MODES)for(const crouching of [false,true]){
  const speed=crouching?CRAWL:WALK_SPEED,limit=catchOffset(rules,speed,crouching);
  if(limit>.1)assert.equal(pass(rules,limit-.05,speed,{crouching,dt:1/240}),1,`${rules.seconds} ${crouching} inside`);
  assert.ok(pass(rules,limit+.05,speed,{crouching,dt:1/240})<1,`${rules.seconds} ${crouching} outside`);
 }
 const walk=MODES.map(r=>catchOffset(r,WALK_SPEED));assert.ok(walk[0]<walk[1]&&walk[1]<walk[2]);
 close(walk[0],1.69,.01);assert.ok(pass(HARD,2.1,WALK_SPEED)===1&&pass(NIGHTMARE,2.6,WALK_SPEED)===1);
 assert.equal(catchOffset(NORMAL,CRAWL,true),0,'normal crouching cannot fill even through the centre');
 assert.ok(pass(NORMAL,0,CRAWL,{crouching:true})<1);
});
test('hunters sense a dark walker 1.4× faster',()=>{
 assert.ok(pass(NORMAL,2,WALK_SPEED,{hunting:true})===1,'a hunter catches the 2.0 m walk a patroller only suspects');
 close(darkFillRate(NORMAL,'normal',2,1,true,false,true)/darkFillRate(NORMAL,'normal',2,1,true,false,false),HUNTER_FILL);
});

// Enemies acceptance: shrine-gameplay is imported lazily so the pure rules above never depend on it.
// A single graph node at the origin leaves a patrolling enemy nowhere to wander, so only the gauge decides.
const spot=(kind:Cell['kind']):Cell[]=>[{x:0,z:0,h:4,kind}];
const fixture=async(kind:Cell['kind']='hall',rules=NORMAL)=>{
 const {Enemies}=await import('../app/shrine-gameplay.ts'),enemies=new Enemies(spot(kind),[]),e=enemies.actors[0];
 enemies.actors=[e];Object.assign(e,{kind:'normal',floor:0,position:{x:0,z:0},facing:0,waypoint:null,route:[],investigate:null,patrol:null});e.brain.reacquireDelay=0;enemies.notice=rules;
 (enemies as unknown as {assignPatrol(a:Enemy):void}).assignPatrol=a=>{a.patrol=null;};
 const step=(player:Position,dt:number,lit:boolean,walls:Obstacle[]=[])=>enemies.update(dt,player,walls,0,undefined,lit,undefined,lit);
 return {enemies,e,step};
};
test('Enemies: a lit visitor 20 m away in the cone is not chased after 0.5 s but is after 1.3 s',async()=>{
 const {e,step}=await fixture('factory');e.facing=Math.PI/2;
 for(let i=0;i<10;i++)step({x:20,z:0},.05,true);assert.equal(e.brain.mode,'patrol');assert.ok(e.alert!>=SUSPECT_AT&&e.alert!<1);
 for(let i=0;i<16;i++)step({x:20,z:0},.05,true);assert.equal(e.brain.mode,'chase');
});
test('Enemies: suspicion halts the enemy on its route and turns it toward the visitor at 2.5 rad/s',async()=>{
 const {e,step}=await fixture('factory');e.facing=Math.PI/2-1;
 for(let i=0;i<5;i++)step({x:20,z:0},.05,true);assert.ok(e.alert!>=SUSPECT_AT);close(e.facing,Math.PI/2-1+TURN_RATE*.05);
 e.patrol={id:'far',point:{x:40,z:0},floor:0,visits:0};e.route=[{x:8,z:0}];const facing=e.facing;
 step({x:20,z:0},.05,true);assert.deepEqual(e.position,{x:0,z:0});assert.deepEqual(e.route,[{x:8,z:0}]);close(e.facing,facing+TURN_RATE*.05);
 assert.deepEqual(e.suspect,{x:20,z:0});assert.equal(e.brain.mode,'patrol');
});
test('Enemies: breaking line of sight at alert 0.5 leaves patrol and searches the suspect point for 8 s × area',async()=>{
 const {e,step}=await fixture('factory'),player={x:20,z:0},wall=[{minX:9,maxX:10,minZ:-3,maxZ:3}];e.facing=Math.PI/2;
 for(let i=0;i<7;i++)step(player,.05,true);close(e.alert!,.5,.05);assert.deepEqual(e.suspect,player);
 for(let i=0;i<40&&e.suspect;i++)step(player,.05,true,wall);
 assert.equal(e.suspect,null);assert.ok(e.alert!<FORGET_AT);assert.equal(e.brain.mode,'patrol');
 assert.deepEqual(e.investigate,player);assert.equal(e.searchBranches,1);close(e.searchTime,8*AREA_MULTIPLIERS.red.search,.051);
});
const darkPass=async(offset:number,speed:number,crouching:boolean)=>{
 const {enemies,e,step}=await fixture();enemies.playerMoving=true;enemies.playerCrouching=crouching;
 let chased=false,peak=0;const dt=1/60;
 for(let i=0,steps=Math.ceil(12/(speed*dt));i<=steps;i++){step({x:-6+i*speed*dt,z:offset},dt,false);chased||=e.brain.mode==='chase';peak=Math.max(peak,e.alert??0);}
 return {chased,peak};
};
test('Enemies: a dark walker passing a facing enemy at 1.5 m is chased; the crouched pass only telegraphs',async()=>{
 assert.equal((await darkPass(1.5,WALK_SPEED,false)).chased,true);
 const crouched=await darkPass(1.5,CRAWL,true);assert.equal(crouched.chased,false);assert.ok(crouched.peak>=SUSPECT_AT&&crouched.peak<1);
 const wide=await darkPass(2,WALK_SPEED,false);assert.equal(wide.chased,false);assert.ok(wide.peak>=SUSPECT_AT);
});
test('Enemies: a still visitor 0.3 m away in the dark is never captured over 10 s',async()=>{
 const {enemies,e,step}=await fixture();enemies.playerMoving=false;
 for(let t=0;t<10;t+=1/60){assert.equal(step({x:0,z:.3},1/60,false),false);assert.notEqual(e.brain.mode,'chase');}assert.equal(e.alert??0,0);
});
test('Enemies: a dark walker behind the enemy is unsensed at 1.5 m but chased at 0.8 m',async()=>{
 for(const [d,mode] of [[1.5,'patrol'],[.8,'chase']] as const){
  const {enemies,e,step}=await fixture();enemies.playerMoving=true;
  for(let t=0;t<1.5;t+=1/60)step({x:0,z:-d},1/60,false);assert.equal(e.brain.mode,mode,`${d} m`);
 }
});
test('Enemies: a wall between the enemy eye and the visitor blocks dark sense',async()=>{
 for(const [walls,mode] of [[[{minX:-2,maxX:2,minZ:.6,maxZ:.9}],'patrol'],[[],'chase']] as const){
  const {enemies,e,step}=await fixture();enemies.playerMoving=true;
  for(let t=0;t<2;t+=1/60)step({x:0,z:1.5},1/60,false,[...walls]);assert.equal(e.brain.mode,mode);if(walls.length)assert.equal(e.alert??0,0);
 }
});
test('Enemies: a final pursuer ignores the gauge and still captures in the dark',async()=>{
 const {e,step}=await fixture();e.kind='hatred';e.facing=Math.PI/2;
 step({x:8,z:0},.05,true);assert.equal(e.brain.mode,'chase');assert.equal(e.alert??0,0);
 assert.equal(step({x:e.position.x+.5,z:0},.05,false),true);assert.equal(e.alert??0,0);
});
test('Enemies default to NOTICE_OFF: sight is an immediate chase and darkness stays free',async()=>{
 const {Enemies}=await import('../app/shrine-gameplay.ts'),enemies=new Enemies(spot('hall'),[]),e=enemies.actors[0];
 assert.deepEqual(enemies.notice,NOTICE_OFF);enemies.actors=[e];Object.assign(e,{kind:'normal',floor:0,position:{x:0,z:0},facing:Math.PI/2});e.brain.reacquireDelay=0;
 enemies.playerMoving=true;for(let i=0;i<60;i++)enemies.update(1/60,{x:.6,z:0},[],0,undefined,false,undefined,false);
 assert.notEqual(e.brain.mode,'chase');assert.equal(e.alert??0,0);
 enemies.update(.05,{x:8,z:0},[],0,undefined,true,undefined,true);assert.equal(e.brain.mode,'chase');
});
test('Enemies: stunActor, burst and reset clear the gauge and the suspicion',async()=>{
 const {enemies,e}=await fixture();
 e.alert=.7;e.suspect={x:1,z:1};enemies.stunActor(e);assert.equal(e.alert,0);assert.equal(e.suspect,null);
 e.position={x:0,z:-3};e.alert=.6;e.suspect={x:1,z:1};assert.equal(enemies.burst({x:0,z:0,y:1.5},[],0,0,0),1);assert.equal(e.alert,0);assert.equal(e.suspect,null);
 e.alert=.9;e.suspect={x:1,z:1};enemies.reset();assert.equal(e.alert,0);assert.equal(e.suspect,null);
});
