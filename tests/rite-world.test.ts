import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';
import {RITE_RADIUS,RITE_SECONDS} from '../app/shrine-goal.ts';
import type {WorldCue} from '../app/world-cues.ts';
// 封門の儀 as wired into the running world: an unlocking offering made once any
// finale has begun demands the rite; it accrues only while a pursuer exists and the
// visitor stands inside the altar ring, and its cues fire on step edges.
type Points=Parameters<Enemies['addPatrolTargets']>[0];
const STEP=.05,GRACE_STEPS=12/STEP,RITE_STEPS=RITE_SECONDS/STEP,OPEN_STEPS=22;
const close=(actual:number,expected:number,message?:string)=>assert.ok(Math.abs(actual-expected)<1e-9,message??`${actual} ≉ ${expected}`);
const riteBeats=(cues:readonly WorldCue[])=>cues.flatMap(c=>c.kind==='rite'?[c.beat]:[]);

function riteWorld(t:TestContext,seed:number){
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const add=Enemies.prototype.addPatrolTargets;let points:Points=[],forceCapture=false;
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:Points){points=p;return add.call(this,p);});
 t.mock.method(Enemies.prototype,'update',()=>forceCapture);
 t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);
 const gold=points.find(p=>p.id==='room:gold-yokocho')!;assert.ok(gold,'the gold bead is a patrol target');
 const altar=w.altarPosition,gate=w.goalPosition,cues:WorldCue[]=[];
 // Every step drains the bounded cue queue into `cues`, so nothing is lost over long waits.
 const step=()=>{const caught=w.step(STEP);cues.push(...w.drainCues());return caught;};
 const take=()=>cues.splice(0);
 const front=()=>{w.camera.position.set(altar.x,1.68,altar.z-2);w.camera.rotation.y=Math.PI;};
 const takeGold=()=>{w.camera.position.set(gold.position.x,1.68,gold.position.z);step();};
 const capture=()=>{forceCapture=true;try{return step();}finally{forceCapture=false;}};
 // The closed seal across the gate opening (ShrineGoal's CLOSED blocker, shifted and scaled with the goal).
 const sealed=()=>w.obstacles.some(o=>Math.abs(o.minZ-(gate.z-.1))<1e-6&&Math.abs(o.maxZ-(gate.z+.15))<1e-6&&Math.abs((o.minX+o.maxX)/2-gate.x)<1e-6&&o.maxX-o.minX>2);
 // Sprint straight at the gate opening from in front of the goal walls (still inside the ring); returns the furthest z reached.
 const walkIntoGate=(each:()=>void=()=>{})=>{w.camera.position.set(gate.x,1.68,gate.z-1.5);let furthest=-Infinity;for(let i=0;i<8;i++){const p=w.move(0,1,0,true,STEP);w.camera.position.set(p.x,p.y,p.z);step();furthest=Math.max(furthest,w.camera.position.z);each();}return furthest;};
 return {w,gold,altar,gate,step,take,front,takeGold,capture,sealed,walkIntoGate};
}

test('an unlocking offering during the finale starts the rite on the next step, ticks each second and only then opens the gate',t=>{
 const {w,altar,gate,step,take,front,takeGold,sealed,walkIntoGate}=riteWorld(t,3);
 try{
  w.setMode('normal');w.drainCues();
  takeGold();assert.ok(w.finale,'picking up the gold begins the finale');
  assert.deepEqual(take().filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:3}]);
  front();assert.equal(w.nearAltar(),true);assert.equal(w.riteStatus(),null,'no rite before the unlocking offering');
  assert.ok(Math.hypot(gate.x-altar.x,gate.z+1.5-altar.z)<RITE_RADIUS,'the gate itself lies inside the ring');
  assert.equal(w.interact(),'offered');assert.equal(w.collection().unlocked,true);
  const offerCues=w.drainCues();
  assert.deepEqual(offerCues.filter(c=>c.kind==='offer'),[{kind:'offer',unlocked:true,rite:true}]);
  assert.deepEqual(riteBeats(offerCues),[],'interact() itself does not emit the start cue');
  assert.deepEqual(w.riteStatus(),{progress:0,remaining:RITE_SECONDS});
  assert.equal(sealed(),true);assert.equal(w.completed,false);
  assert.equal(w.interact(),'empty');assert.deepEqual(riteBeats(w.drainCues()),[],'a second interact() cannot restart the rite');
  const beats:{beat:string;at:number}[]=[];let n=0;
  const record=()=>{n++;for(const beat of riteBeats(take()))beats.push({beat,at:n});};
  step();record();
  assert.deepEqual(beats,[{beat:'start',at:1}],'exactly one start cue, on the first step after the offering');
  close(w.riteStatus()!.progress,STEP/RITE_SECONDS);
  while(n<80){step();record();assert.ok(w.riteStatus(),'rite still running at step '+n);}
  close(w.riteStatus()!.progress,.5,'four live seconds are half the rite');
  // Mid-rite the seal holds: sprinting at the gate (inside the ring) neither passes nor completes.
  const furthest=walkIntoGate(record);
  assert.ok(furthest<gate.z-.1,'the closed seal stops the visitor at z='+furthest);assert.equal(w.completed,false);assert.equal(sealed(),true);
  front();
  while(n<RITE_STEPS-1){step();record();assert.equal(w.completed,false);assert.equal(sealed(),true);}
  assert.ok(w.riteStatus()!.remaining>0&&w.riteStatus()!.remaining<.1);
  step();record();
  assert.equal(w.riteStatus(),null,'eight live seconds in the ring finish the rite');
  const ticks=beats.filter(b=>b.beat==='tick').map(b=>b.at);
  assert.equal(ticks.length,RITE_SECONDS-1,'one tick per whole second; the eighth second is the completion');
  ticks.forEach((at,i)=>assert.ok(Math.abs(at-(i+1)/STEP)<=1,`tick ${i+1} at step ${at}`));
  assert.deepEqual(beats.map(b=>b.beat),['start',...ticks.map(()=>'tick'),'complete']);assert.equal(beats.at(-1)!.at,RITE_STEPS);
  // The gate's own ~1.1 s opening follows the rite; the seal is still shut when the rite completes.
  assert.equal(sealed(),true);assert.equal(w.completed,false);
  for(let i=1;i<OPEN_STEPS;i++)step();assert.equal(sealed(),true,'the opening has not finished after 21 steps');
  step();assert.equal(sealed(),false,'the seal lifts once the gate progress reaches .98');
  assert.deepEqual(riteBeats(take()),[],'no rite cue after completion');
  walkIntoGate();assert.equal(w.completed,true,'walking into the gate now completes the shrine');
  assert.ok(take().some(c=>c.kind==='clear'));
 }finally{w.dispose();}
});

test('leaving the ring and stopped time pause the rite in the world; it never decays',t=>{
 const {w,altar,step,take,front,takeGold}=riteWorld(t,21);
 try{
  w.setMode('normal');takeGold();assert.ok(w.finale);front();assert.equal(w.interact(),'offered');take();
  for(let i=0;i<40;i++)step();
  const held=w.riteStatus()!.progress;close(held,2/RITE_SECONDS);
  w.camera.position.set(altar.x+RITE_RADIUS+.1,1.68,altar.z);
  for(let i=0;i<100;i++){step();assert.equal(w.riteStatus()!.progress,held,'just outside 7 m the rite holds');}
  w.camera.position.set(altar.x,1.68,altar.z-30);
  for(let i=0;i<200;i++)step();assert.equal(w.riteStatus()!.progress,held,'ten seconds far away do not decay it');
  assert.ok(w.finale,'the finale continues while the visitor is away');
  w.camera.position.set(altar.x+RITE_RADIUS-.1,1.68,altar.z);
  for(let i=0;i<20;i++)step();close(w.riteStatus()!.progress,3/RITE_SECONDS,'just inside 7 m resumes where it left off');
  front();assert.equal(w.stopTime(),true);assert.equal(w.timeStopped,true);
  const frozen=w.riteStatus()!.progress;
  for(let i=0;i<199;i++){step();assert.equal(w.riteStatus()!.progress,frozen,'stopped time passes no live time to the rite');}
  step();assert.equal(w.timeStopped,false);close(w.riteStatus()!.progress,frozen);
  step();close(w.riteStatus()!.progress,frozen+STEP/RITE_SECONDS,'the rite resumes with live time');
  let steps=0;while(w.riteStatus()&&steps<200){step();steps++;}
  assert.equal(steps,RITE_STEPS-61,'exactly the remaining live seconds were needed');
  assert.deepEqual(riteBeats(take()),['start',...Array<string>(RITE_SECONDS-1).fill('tick'),'complete'],'pauses neither repeat nor skip a cue');
 }finally{w.dispose();}
});

test('a capture during the rite keeps its progress; the grace neither accrues it nor opens the gate until the finale re-arms',t=>{
 const {w,altar,step,take,front,takeGold,capture,sealed,walkIntoGate}=riteWorld(t,21);
 try{
  w.setMode('normal');takeGold();assert.ok(w.finale);front();assert.equal(w.interact(),'offered');
  for(let i=0;i<50;i++)step();
  const before=w.riteStatus()!.progress;close(before,2.5/RITE_SECONDS);take();
  assert.equal(capture(),true);
  const caughtCues=take();assert.ok(caughtCues.some(c=>c.kind==='caught'));assert.deepEqual(riteBeats(caughtCues),[],'a capture neither completes nor restarts the rite');
  assert.equal(w.finale,null,'the capture clears the finale');assert.equal(w.collection().unlocked,true,'the offering stays on the altar');
  const held=w.riteStatus()!.progress;assert.ok(held>=before&&held<=before+STEP/RITE_SECONDS+1e-12,'progress kept: '+held);
  assert.ok(Math.hypot(w.camera.position.x-altar.x,w.camera.position.z-altar.z)>RITE_RADIUS,'respawned outside the ring');
  assert.equal(sealed(),true);
  front();let n=0;
  const check=()=>{n++;if(w.finale)return;assert.equal(w.riteStatus()!.progress,held,'no accrual in the ring while no pursuer exists (step '+n+')');assert.equal(w.completed,false);assert.equal(sealed(),true,'the gate stays closed through the grace (step '+n+')');};
  while(!w.finale&&n<GRACE_STEPS+5){
   if(n===100){const furthest=walkIntoGate(check);front();assert.ok(furthest<w.goalPosition.z-.1,'the seal holds during the grace: z='+furthest);}
   else{step();check();}
  }
  assert.ok(n>=GRACE_STEPS&&n<=GRACE_STEPS+1,'the finale re-arms when the 12 s grace runs out, step '+n);
  assert.ok(w.finale);
  const graceCues=take();
  assert.deepEqual(riteBeats(graceCues),[],'the grace and re-arm emit no rite cue');
  assert.deepEqual(graceCues.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:2}],'a re-arm on an unlocked gate tolls twice');
  assert.equal(w.omenRemaining(),4);
  assert.ok(w.riteStatus()!.progress>held,'accrual resumes with the re-armed pursuer');
  let steps=0;while(w.riteStatus()&&steps<200){step();steps++;if(w.riteStatus())assert.equal(sealed(),true);}
  assert.equal(steps,Math.round((RITE_SECONDS-held*RITE_SECONDS)/STEP)-1,'only the remainder of the rite was needed');
  assert.deepEqual(riteBeats(take()),[...Array<string>(RITE_SECONDS-3).fill('tick'),'complete'],'ticks for seconds 3–7 only, then completion');
  assert.equal(sealed(),true);for(let i=0;i<OPEN_STEPS;i++)step();assert.equal(sealed(),false);
  walkIntoGate();assert.equal(w.completed,true);
 }finally{w.dispose();}
});

test('an offering made in the grace after a capture still demands the rite, which waits for the re-armed finale',t=>{
 const {w,altar,step,take,front,takeGold,capture,sealed,walkIntoGate}=riteWorld(t,3);
 try{
  w.setMode('normal');takeGold();assert.ok(w.finale);assert.equal(w.collection().gold,1);
  front();take();
  assert.equal(capture(),true,'caught beside the altar before offering');
  assert.equal(w.finale,null);assert.equal(w.collection().unlocked,false);assert.equal(w.riteStatus(),null);
  assert.equal(w.captureReport().dropped,1);assert.equal(w.collection().gold,0);assert.equal(w.collection().dropped,1);
  assert.ok(Math.hypot(w.camera.position.x-altar.x,w.camera.position.z-altar.z+2)>20,'respawned away from the dropped gold');
  take();front();step();let n=1;
  assert.deepEqual(take().filter(c=>c.kind==='recover'),[{kind:'recover',count:1,blue:0,red:0,gold:1}]);
  assert.equal(w.collection().gold,1);assert.equal(w.finale,null,'recovering the gold inside the grace does not re-arm early');
  front();assert.equal(w.nearAltar(),true);
  assert.equal(w.interact(),'offered');assert.equal(w.collection().unlocked,true);assert.equal(w.finale,null);
  assert.deepEqual(w.riteStatus(),{progress:0,remaining:RITE_SECONDS},'the rite is demanded although no pursuer exists');
  assert.equal(sealed(),true);assert.deepEqual(riteBeats(w.drainCues()),[]);
  step();n++;assert.deepEqual(riteBeats(take()),['start'],'the start cue follows on the next step');
  const check=()=>{n++;if(w.finale)return;assert.equal(w.riteStatus()!.progress,0,'no accrual before the re-arm (step '+n+')');assert.equal(w.completed,false);assert.equal(sealed(),true,'the gate stays closed through the grace (step '+n+')');};
  while(!w.finale&&n<GRACE_STEPS+5){
   if(n===120){const furthest=walkIntoGate(check);front();assert.ok(furthest<w.goalPosition.z-.1,'the seal holds during the grace: z='+furthest);}
   else{step();check();}
  }
  assert.ok(n>=GRACE_STEPS&&n<=GRACE_STEPS+1,'the finale re-arms when the 12 s grace runs out, step '+n);
  assert.ok(w.finale);
  const graceCues=take();assert.deepEqual(riteBeats(graceCues),[],'no second start cue at the re-arm');
  assert.equal(graceCues.filter(c=>c.kind==='finale').length,1);
  assert.deepEqual(graceCues.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:2}],'the gate was unlocked in the grace, so the re-arm takes the short omen');
  assert.equal(w.omenRemaining(),4);
  close(w.riteStatus()!.progress,STEP/RITE_SECONDS,'the rite accrues from the re-arm step on');
  let steps=1;while(w.riteStatus()&&steps<200){step();steps++;assert.equal(w.completed,false);}
  assert.equal(steps,RITE_STEPS,'the full eight live seconds are still required');
  assert.deepEqual(riteBeats(take()),[...Array<string>(RITE_SECONDS-1).fill('tick'),'complete']);
  for(let i=0;i<OPEN_STEPS;i++)step();assert.equal(sealed(),false);
  walkIntoGate();assert.equal(w.completed,true);
 }finally{w.dispose();}
});

test('the gallery never demands a rite and its gate opens on the plain schedule',t=>{
 const {w,gate,step,take,takeGold,sealed,walkIntoGate}=riteWorld(t,3);
 try{
  w.setMode('gallery');w.drainCues();
  assert.equal(w.collection().unlocked,true,'the gallery pre-offers the gold');assert.equal(w.riteStatus(),null);assert.equal(sealed(),true);
  for(let i=1;i<OPEN_STEPS;i++){step();assert.equal(w.riteStatus(),null);}
  assert.equal(sealed(),true);step();assert.equal(sealed(),false,'the seal lifts after the usual ~1.1 s with no rite');
  takeGold();assert.equal(w.finale,null,'no finale in the gallery');assert.equal(w.riteStatus(),null);
  for(let i=0;i<40;i++)step();
  assert.deepEqual(riteBeats(take()),[],'no rite cue in the gallery');
  const furthest=walkIntoGate();assert.ok(furthest>gate.z+1,'the open gate lets the visitor through: z='+furthest);
  assert.equal(w.completed,false,'a gallery walk is never a clear');
 }finally{w.dispose();}
});
