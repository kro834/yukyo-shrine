import test from 'node:test';
import assert from 'node:assert/strict';
import {Enemies,Doors,moveFinaleToward,openPursuedDoor} from '../app/shrine-gameplay.ts';
import {FINALE_BALANCE,finaleDistance,finalePhase,finaleSpeed,hatredIntercept,hatredPressure,type FinaleKind} from '../app/enemy-traits.ts';
import {SPRINT_SPEED,RADIUS,type Obstacle,type Position} from '../app/movement.ts';
import {TimeStop} from '../app/time-stop.ts';
import {createSectorLayout} from '../app/sector-layout.ts';
import {STAIRS} from '../app/annex.ts';
import {HIGH_STAIRS} from '../app/vertical-layout.ts';

const cells=Array.from({length:49*49},(_,i)=>({x:i%49-24,z:Math.floor(i/49)-24,h:4,kind:'hall' as const}));
function arena(kind:FinaleKind,walls:Obstacle[]=[]){
 const enemies=new Enemies(cells,walls);enemies.beginFinale({x:80,z:0},0,()=>kind==='hatred'?0:.99);
 const boss=enemies.actors[0];boss.position={x:0,z:0};boss.floor=0;boss.planIn=0;
 return {enemies,boss};
}
function advance(enemies:Enemies,seconds:number,player:Position={x:80,z:0}){
 let remaining=seconds;
 while(remaining>1e-9){const dt=Math.min(.05,remaining);enemies.update(dt,player,[],0,[],false,[],false);remaining-=dt;}
}

void test('Wrath realizes full windup, above-sprint rush and escapable recovery at exact durations',()=>{
 const {enemies,boss}=arena('wrath');
 advance(enemies,.75);assert.ok(Math.abs(boss.position.x-.75*1.1)<1e-8);assert.equal(finalePhase('wrath',boss.traitTime),'rush');
 const beforeRush=boss.position.x;advance(enemies,1.25);
 assert.ok(Math.abs(boss.position.x-beforeRush-1.25*16.2)<1e-8,'rush speed must survive movePlayer delta clipping');
 assert.equal(finalePhase('wrath',boss.traitTime),'recover');
 const beforeRecovery=boss.position.x;advance(enemies,1.65);
 assert.ok(Math.abs(boss.position.x-beforeRecovery-1.65*3.2)<1e-8);
 assert.equal(finalePhase('wrath',boss.traitTime),'windup');
 assert.ok((SPRINT_SPEED-3.2)*1.65>9,'sprinting opens over nine metres during recovery');
 for(const kind of ['hatred','wrath'] as const){
  const whole=finaleDistance(kind,17.95,.3),partitioned=Array.from({length:30},(_,i)=>finaleDistance(kind,17.95+i*.01,.01)).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(whole-partitioned)<1e-8,'phase integration is independent of frame partition');
  assert.ok(finaleSpeed(kind,18,1.1)>finaleSpeed(kind,18));
  assert.equal(finaleSpeed(kind,18,50),finaleSpeed(kind,18,1.2),'difficulty stays bounded');
 }
});

void test('Hatred accelerates persistently and intercepts only a bounded, physically reachable lead',()=>{
 const {enemies,boss}=arena('hatred');
 advance(enemies,1);const firstMetre=boss.position.x;
 boss.position={x:0,z:0};boss.traitTime=18;advance(enemies,1);
 assert.ok(Math.abs(boss.position.x-11.4)<1e-8);assert.ok(boss.position.x>firstMetre+2);assert.ok(boss.position.x>SPRINT_SPEED);
 assert.equal(hatredPressure(500),1);
 const ahead=hatredIntercept({x:0,z:0},{x:100,z:100},18,80);assert.ok(Math.hypot(ahead.x,ahead.z)<=5.000001);
 boss.position={x:0,z:0};boss.traitTime=18;let player={x:20,z:0};
 enemies.update(.05,player,[],0,[],false);
 for(let i=0;i<8;i++){player={x:20,z:player.z+.46};enemies.update(.05,player,[],0,[],false);}
 assert.ok(boss.flankPoint&&boss.flankPoint.z>player.z+1);
 assert.ok(Math.hypot(boss.flankPoint.x-player.x,boss.flankPoint.z-player.z)<=5.000001);
 player={x:20,z:player.z+.46};
 const wall={minX:18,maxX:22,minZ:player.z+.8,maxZ:player.z+1};
 enemies.update(.05,player,[wall],0,[],false);assert.equal(boss.flankPoint,null,'interception cannot point through a closed obstacle');
 player={x:60,z:60};enemies.update(.05,player,[],0,[],false);
 assert.deepEqual(boss.flankPoint,player,'a discontinuous player move discards velocity instead of extrapolating it');
});

void test('high-speed finale steps stop at thin walls and unopened doors and never overshoot targets',()=>{
 const wall={minX:1,maxX:1.01,minZ:-3,maxZ:3};let samples=0;
 const p=moveFinaleToward({x:0,z:0},{x:10,z:0},19.44,.2,[wall],point=>{samples++;assert.ok(point.x<=wall.minX-RADIUS);return false;});
 assert.ok(p.x<=1-RADIUS);assert.ok(samples>1);
 const doors=new Doors([{id:'test',x:1,z:0,alongX:false,room:'test'}]);
 const stopped=moveFinaleToward({x:0,z:0},{x:10,z:0},19.44,.2,doors.blockers());
 assert.ok(stopped.x<=1-.13-RADIUS);
 const end=moveFinaleToward({x:0,z:0},{x:.2,z:.1},19.44,.2,[]);
 assert.ok(Math.hypot(end.x-.2,end.z-.1)<1e-9);
});

void test('both bosses replan promptly and react to doors quickly without bypassing door animation or stun',()=>{
 const wall={minX:-.1,maxX:.1,minZ:-6,maxZ:6};
 for(const kind of ['hatred','wrath'] as const){
  const {enemies,boss}=arena(kind,[wall]);boss.position={x:-12,z:0};enemies.update(.05,{x:12,z:0},[wall],0,[],false);
  assert.ok(boss.route.length);assert.ok(boss.planIn>0&&boss.planIn<=.180001);
  const doors=new Doors([{id:'test',x:0,z:0,alongX:true,room:'test'}]);boss.position={x:0,z:1};boss.floor=0;boss.facing=Math.PI;boss.brain.mode='chase';
  const delay=FINALE_BALANCE[kind].doorDelay;
  assert.equal(openPursuedDoor(doors,boss,[],delay-.001),false);
  assert.equal(openPursuedDoor(doors,boss,[],.002),true);
  assert.equal(boss.planIn,0);assert.equal(boss.route.length,0);assert.equal(doors.blockers().length,1,'door leaf remains physical until its normal animation clears');
  doors.update(.46,{x:0,z:3});assert.equal(doors.blockers().length,0);
  doors.states[0].open=false;boss.brain.stun();assert.equal(openPursuedDoor(doors,boss,[],2),false);
 }
});

void test('flash stops both bosses for all nine seconds; freeze pauses attack clocks for all ten seconds',()=>{
 for(const kind of ['hatred','wrath'] as const){
  const {enemies,boss}=arena(kind);boss.traitTime=kind==='hatred'?18:1.1;boss.doorWait=.1;
  const player={x:0,z:3};assert.equal(enemies.burst(player,[],0,0,0),1);
  const frozen={...boss.position};for(let i=0;i<180;i++)enemies.update(.05,player,[],0,[],false);
  assert.deepEqual(boss.position,frozen);assert.equal(boss.brain.stunRemaining,0);assert.equal(boss.doorWait,0);
  assert.equal(boss.traitTime,kind==='hatred'?18:0,'Hatred retains pressure; interrupted Wrath earns a new windup');
  enemies.update(.05,player,[],0,[],false);assert.notDeepEqual(boss.position,frozen);
  const stop=new TimeStop(),clock=boss.traitTime,position={...boss.position};assert.equal(stop.use(),true);
  for(let i=0;i<200;i++){const dt=stop.step(.05);if(dt>1e-9)enemies.update(dt,player,[],0,[],false);}
  assert.equal(stop.remaining,0);assert.equal(boss.traitTime,clock);assert.deepEqual(boss.position,position);
  enemies.update(stop.step(.05),player,[],0,[],false);assert.ok(boss.traitTime>clock);
 }
});

void test('Wrath follows real stairs across both floors, with no capture through a wall or another storey',()=>{
 const l=createSectorLayout(1),enemies=new Enemies(l.cells,l.obstacles);enemies.beginFinale({x:0,z:14},0,()=>.99);const boss=enemies.actors[0];
 for(const [s,low,high] of [[STAIRS[0],0,4.8],[HIGH_STAIRS[0],4.8,9.6]] as const){
  const x=(s.minX+s.maxX)/2;boss.position={x,z:s.minZ-1};boss.floor=low;boss.route=[];boss.planIn=0;
  for(let i=0;i<350&&boss.floor<high;i++)enemies.update(.05,{x,z:s.maxZ+3},[],high,[],false,[]);
  assert.equal(boss.floor,high);
 }
 const {enemies:open,boss:runner}=arena('wrath');runner.traitTime=1;runner.position={x:0,z:0};
 assert.equal(open.update(.05,{x:0,z:0},[],4.8,[],false),false);
 runner.floor=0;runner.position={x:0,z:0};runner.traitTime=1;
 assert.equal(open.update(.05,{x:1,z:0},[{minX:.5,maxX:.55,minZ:-3,maxZ:3}],0,[],false),false);
});

void test('gallery disables all boss side effects and reset clears pressure, phase and prediction state',()=>{
 const {enemies,boss}=arena('hatred');enemies.difficulty.enemies=false;
 const position={...boss.position};assert.equal(enemies.update(.1,{x:0,z:0},[]),false);assert.deepEqual(boss.position,position);assert.equal(boss.traitTime,0);assert.equal(enemies.patrolClock,0);
 enemies.difficulty.enemies=true;advance(enemies,1);enemies.reset();assert.equal(enemies.actors.length,12);assert.equal(enemies.finalKind,null);
 assert.ok(enemies.actors.every(e=>e.traitTime===0&&e.flankPoint===null&&e.doorWait===0&&e.planIn===0));
 enemies.beginFinale({x:20,z:20},0,()=>.99);assert.equal(enemies.actors.length,1);assert.equal(enemies.actors[0].traitTime,0);assert.equal(enemies.actors[0].doorWait,0);
 assert.equal(finalePhase('wrath',enemies.actors[0].traitTime),'windup');
});
