import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies,Doors,WAKE_TURN_SECONDS,TOLL_WAKE_DISTANCE,HUNT_RADIUS,type Enemy} from '../app/shrine-gameplay.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';
import {DEFAULTS} from '../app/preferences.ts';
import {lightBlocked} from '../app/flash-visibility.ts';
import {enemyDirection} from '../app/enemy-direction.ts';
import {SUSPECT_AT,TURN_RATE} from '../app/notice.ts';
import {BURST_RECHARGE} from '../app/burst-recharge.ts';
import {surplusPoints,scoreRun} from '../app/records.ts';
import type {Obstacle} from '../app/movement.ts';
import type {WorldCue} from '../app/world-cues.ts';

// 夜刻の鐘 as wired into the running world: the incense clock's warning, toll,
// hunt and lull with their bell cues, the sleepers a toll wakes, the capture
// calm, purification at the altar, surplus offerings and the inert gallery.
// One seeded world is shared by ordered subtests (building it costs ~15 s);
// each subtest starts from setMode(), which renews the night, the sleepers and
// the item bag but keeps collected beads and altar offerings, so the bead
// budget below is planned so that no collection completes before (f).
type Target=Parameters<Enemies['addPatrolTargets']>[0][number];
type Point={x:number;z:number};
type Bell=Extract<WorldCue,{kind:'bell'}>;
// Spec values (app/night-clock.ts, normal mode), written out so a config regression fails here.
const DT=.05,TOLL_SECONDS=150,WARN_SECONDS=12,HUNT_SECONDS=35,LULL_SECONDS=20,CALM_SECONDS=25,CAPTURE=.6,CEILING=.95,DEFER_SECONDS=60;
const THRESHOLD=1-WARN_SECONDS/TOLL_SECONDS;
const close=(actual:number,expected:number,epsilon=1e-9,message?:string)=>assert.ok(Math.abs(actual-expected)<=epsilon,message??`${actual} ≉ ${expected}`);
const flat=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Enemy yaw convention: facing=atan2(dx,dz). */
const bearing=(from:Point,to:Point)=>Math.atan2(to.x-from.x,to.z-from.z);
const gap=(facing:number,desired:number)=>Math.atan2(Math.sin(desired-facing),Math.cos(desired-facing));
const ofKind=<K extends WorldCue['kind']>(cues:readonly WorldCue[],kind:K)=>cues.filter((c):c is Extract<WorldCue,{kind:K}>=>c.kind===kind);
const realUpdate=Enemies.prototype.update;

function harness(t:TestContext,seed:number){
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},render(){},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const add=Enemies.prototype.addPatrolTargets;
 const s={enemies:undefined as Enemies|undefined,targets:[] as Target[],force:false,updates:0};
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:Target[]){s.enemies=this;s.targets=p;return add.call(this,p);});
 // Pursuers stay inert (cheap steps) unless a capture is forced.
 t.mock.method(Enemies.prototype,'update',()=>{s.updates++;return s.force;});
 t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);
 w.configure({...DEFAULTS,quality:'low'});
 const e=()=>{assert.ok(s.enemies,'the Enemies instance was captured');return s.enemies;};
 const bead=(id:string)=>{const p=s.targets.find(p=>p.id==='room:'+id);assert.ok(p,'bead '+id);return {id,home:{x:p.position.x,z:p.position.z},floor:p.floor};};
 const groundBlues=()=>s.targets.filter(p=>p.id.startsWith('room:')&&p.floor===0&&!/^room:(red|gold)-/.test(p.id)).map(p=>bead(p.id.slice(5)));
 const reds=()=>s.targets.filter(p=>p.id.startsWith('room:red-')&&p.floor===0).map(p=>bead(p.id.slice(5)));
 const stand=(p:Point)=>{w.camera.position.set(p.x,1.68,p.z);};
 /** Turn the camera to look straight at `to` (three.js yaw: forward is (-sin y, -cos y)). */
 const face=(to:Point)=>{w.camera.rotation.y=Math.atan2(-(to.x-w.camera.position.x),-(to.z-w.camera.position.z));};
 const night=()=>w.nightStatus();
 const step=()=>{assert.equal(w.step(DT),false,'no capture while the pursuers are inert');return w.drainCues();};
 const steps=(n:number)=>{const cues:WorldCue[]=[];for(let i=0;i<n;i++)cues.push(...step());return cues;};
 const capture=()=>{s.force=true;try{return w.step(DT);}finally{s.force=false;}};
 const altarFront=()=>{const a=w.altarPosition;return {x:a.x,z:a.z-2};};
 const offerAtAltar=()=>{stand(altarFront());w.camera.rotation.y=Math.PI;return w.interact();};
 const pick=(b:{home:Point})=>{stand(b.home);const before=night().fraction,cues=step();return {cues,delta:night().fraction-before};};
 const sleepers=()=>e().actors.filter(a=>a.dormant);
 /** The nearest corridor node a sleeper turns toward on waking (beyond half a metre, within 40 m). */
 const corridorNode=(a:Enemy)=>{const node=e().nodesNear(a.position,a.floor,40).filter(p=>flat(p,a.position)>.5).sort((p,q)=>flat(p,a.position)-flat(q,a.position))[0];assert.ok(node,'a corridor node near enemy '+a.id);return node;};
 return {w,s,e,bead,groundBlues,reds,stand,face,night,step,steps,capture,altarFront,offerAtAltar,pick,sleepers,corridorNode};
}

test('夜刻の鐘 in the world: bells, sleepers, notice, capture calm, purification, surplus and the inert gallery',async t=>{
 const h=harness(t,17),{w,s,e,stand,face,night,step,steps,capture,altarFront,offerAtAltar,pick,sleepers,corridorNode}=h;
 const ids=(actors:readonly Enemy[])=>actors.map(a=>a.id).sort((a,b)=>a-b);
 try{
  const blues=h.groundBlues(),reds=h.reds(),gold=h.bead('gold-yokocho');
  assert.ok(blues.length>=6&&reds.length>=3,'seed 17 has enough ground beads for the plan');

  await t.test('(e) sleepers: 3+2 on normal, toll wake-ups skip the near or watched, force wakes all, the wake turn, and a capture keeps the sleepers',()=>{
   w.setMode('normal',{omens:['ushimitsu']});
   assert.equal(night().sleeping,2,'丑の刻参り begins past the first toll: only the late batch (2) sleeps');
   w.setMode('normal');w.drainCues();
   assert.equal(night().sleeping,5,'normal: batches of 3 and 2');assert.equal(sleepers().length,5);
   assert.deepEqual([...e().dormantIds].sort((a,b)=>a-b),ids(sleepers()));
   for(const a of sleepers()){
    assert.deepEqual(a.position,a.home,'a sleeper stands at home');assert.equal(a.wakeTurn,0);
    close(Math.abs(gap(a.facing,bearing(a.position,corridorNode(a)))),Math.PI,1e-9,'a sleeper turns its back to the nearest corridor node');
   }
   // Far away with the real walls between: the toll's batch of three takes the three farthest sleepers.
   const far=altarFront(),walls=w.obstacles;
   const byDistance=[...sleepers()].sort((a,b)=>flat(b.position,far)-flat(a.position,far));
   for(const a of byDistance){
    assert.ok(Math.abs(a.floor)>=1||flat(a.position,far)>=TOLL_WAKE_DISTANCE,'precondition: sleeper '+a.id+' is 20 m or more away');
    if(Math.abs(a.floor)<1)assert.ok(lightBlocked({...far,y:1.5},{...a.position,y:a.floor+1.5},walls),'precondition: walls hide sleeper '+a.id);
   }
   assert.equal(e().wakeBatch(3,far,0,walls),3);
   assert.deepEqual(ids(sleepers()),ids(byDistance.slice(3)),'the farthest three woke first');assert.equal(night().sleeping,2);
   for(const a of byDistance.slice(0,3)){assert.equal(a.dormant,false);assert.equal(a.wakeTurn,WAKE_TURN_SECONDS);assert.equal(e().dormantIds.has(a.id),false);}
   assert.equal(e().wakeBatch(3,far,0,walls),2,'only two were left');assert.equal(night().sleeping,0);

   // Near or in view: a sleeper within 20 m never wakes at the toll; with no walls every ground sleeper is in view.
   w.setMode('normal');
   const ground=sleepers().filter(a=>Math.abs(a.floor)<1),upper=sleepers().filter(a=>Math.abs(a.floor)>=1);
   assert.ok(ground.length>=2,'two or more sleepers on the ground floor');
   const near=ground[0],at={x:near.position.x+1,z:near.position.z};
   assert.equal(e().wakeBatch(5,at,0,[]),upper.length,'in an open floor plan only sleepers on another storey are unseen');
   assert.deepEqual(ids(sleepers()),ids(ground));
   const woke=e().wakeBatch(5,at,0,walls);
   assert.equal(near.dormant,true,'the sleeper a metre away never wakes at the toll');
   assert.equal(woke,ground.length-1,'behind the real walls every other ground sleeper wakes');
   for(const a of ground)if(!a.dormant)assert.ok(flat(a.position,at)>=TOLL_WAKE_DISTANCE);
   assert.equal(e().wakeBatch(5,at,0,walls,true),1,'force wakes the near one regardless');
   assert.equal(near.dormant,false);assert.equal(near.wakeTurn,WAKE_TURN_SECONDS);assert.equal(night().sleeping,0);

   // The 20 m line, with a synthetic wall that hides the sleeper: inside it defers, outside it wakes; unhidden it defers.
   w.setMode('normal');const asleep=ids(sleepers());
   const wall:Obstacle={minX:near.position.x+5,maxX:near.position.x+5.4,minZ:near.position.z-3,maxZ:near.position.z+3};
   for(const [offset,blockers,awake] of [[TOLL_WAKE_DISTANCE-.1,[wall],false],[TOLL_WAKE_DISTANCE+.1,[wall],true],[TOLL_WAKE_DISTANCE+.1,[],false]] as const){
    e().setDormant(asleep);assert.equal(near.dormant,true);
    e().wakeBatch(5,{x:near.position.x+offset,z:near.position.z},0,[...blockers]);
    assert.equal(near.dormant,!awake,`offset ${offset} m, ${blockers.length?'hidden':'in view'}`);
   }

   // F1: a woken sleeper spends one second turning toward its corridor, neither moving nor seeing.
   w.setMode('normal');
   const sleeper=near,node=corridorNode(sleeper),home={...sleeper.position},toward=bearing(home,node);
   e().wake(sleeper);assert.equal(sleeper.dormant,false);assert.equal(sleeper.wakeTurn,WAKE_TURN_SECONDS);
   // The visitor stands lit and still between the sleeper and its corridor, exactly where it will look.
   const d=flat(home,node),lit={x:home.x+(node.x-home.x)*Math.min(1.5,d)/d,z:home.z+(node.z-home.z)*Math.min(1.5,d)/d};
   e().playerMoving=false;e().playerRunning=false;e().playerCrouching=false;
   let turns=0,previous=Math.abs(gap(sleeper.facing,toward));
   while((sleeper.wakeTurn??0)>0&&turns<40){
    realUpdate.call(e(),DT,lit,walls,0,undefined,true,undefined,true);turns++;
    assert.deepEqual(sleeper.position,home,'no movement during the wake turn');assert.equal(sleeper.brain.mode,'patrol');
    assert.equal(sleeper.alert??0,0,'no sight during the wake turn');
    const now=Math.abs(gap(sleeper.facing,toward));assert.ok(now<previous,'it keeps turning toward the corridor');previous=now;
   }
   assert.equal(turns,Math.round(WAKE_TURN_SECONDS/DT),'the wake turn lasts exactly one second');
   close(previous,Math.PI-TURN_RATE*WAKE_TURN_SECONDS,1e-9,'one second at the turn rate from facing away');
   realUpdate.call(e(),DT,lit,walls,0,undefined,true,undefined,true);
   assert.ok((sleeper.alert??0)>0,'sight returns the moment the turn ends');assert.equal(sleeper.alertSource,'lit');

   // A capture resets the pursuers: the still-dormant sleep on, the woken stay awake.
   w.setMode('normal');
   const firstTwo=[...sleepers()].sort((a,b)=>flat(b.position,far)-flat(a.position,far)).slice(0,2),stillAsleep=sleepers().filter(a=>!firstTwo.includes(a));
   assert.equal(e().wakeBatch(2,far,0,walls),2);
   for(const a of firstTwo){a.position={x:a.home.x+3,z:a.home.z};a.facing+=1;}
   assert.equal(w.collection().blue+w.collection().red+w.collection().gold,0,'nothing held, nothing to drop');
   stand(far);assert.equal(capture(),true);assert.ok(ofKind(w.drainCues(),'caught').length===1);
   assert.equal(night().sleeping,3);assert.deepEqual(ids(sleepers()),ids(stillAsleep));assert.deepEqual([...e().dormantIds].sort((a,b)=>a-b),ids(stillAsleep));
   for(const a of firstTwo){assert.equal(a.dormant,false,'woken '+a.id+' stays awake');assert.deepEqual(a.position,a.home);assert.equal(a.wakeTurn,0);}
   for(const a of stillAsleep){assert.deepEqual(a.position,a.home);close(Math.abs(gap(a.facing,bearing(a.position,corridorNode(a)))),Math.PI,1e-9);}
   // enemies.reset() on its own: a sleeper woken since is not put back to sleep, the rest stay dormant.
   const [roused,...dozing]=stillAsleep;e().wake(roused);roused.position={x:roused.home.x+2,z:roused.home.z};
   e().reset();
   assert.equal(roused.dormant,false,'reset() keeps a woken id awake');assert.equal(e().dormantIds.has(roused.id),false);assert.deepEqual(roused.position,roused.home);
   assert.deepEqual(ids(sleepers()),ids(dozing));assert.equal(night().sleeping,2);
  });

  await t.test('(F5) the one-time notice cue needs a dark-sensed gauge at SUSPECT_AT in view, and re-arms with setMode',()=>{
   w.setMode('normal');w.drainCues();
   const watcher=e().actors.find(a=>!a.dormant&&a.floor===0&&a.brain.mode==='patrol');assert.ok(watcher);
   const node=corridorNode(watcher),d=flat(watcher.position,node),k=Math.min(1.5,d)/d;
   stand({x:watcher.position.x+(node.x-watcher.position.x)*k,z:watcher.position.z+(node.z-watcher.position.z)*k});face(watcher.position);
   close(enemyDirection(w.camera.position,watcher.position,w.camera.rotation.y).angle,0,1e-9,'the watcher is dead ahead');
   const notices=(n:number)=>ofKind(steps(n),'notice').length;
   watcher.alert=.9;watcher.alertSource='lit';
   assert.equal(w.noticeLevel(),.9,'the gauge is in view');assert.equal(w.noticeLevel(true),0,'but it was filled by sight');
   assert.equal(notices(10),0,'a lit sighting never teaches the dark lesson');
   watcher.alertSource='dark';watcher.alert=SUSPECT_AT-.01;
   assert.equal(w.noticeLevel(true),SUSPECT_AT-.01);assert.equal(notices(10),0,'below SUSPECT_AT');
   watcher.alert=SUSPECT_AT+.01;
   assert.equal(notices(1),1,'reaching SUSPECT_AT in the dark notices once');assert.equal(notices(40),0,'never again this run');
   w.setMode('normal');w.drainCues();assert.equal(watcher.alert,0,'setMode resets the gauges');
   watcher.alert=.5;watcher.alertSource='dark';w.camera.rotation.y+=Math.PI;
   assert.equal(w.noticeLevel(true),0);assert.equal(notices(5),0,'behind the camera it cannot be noticed');
   face(watcher.position);assert.equal(notices(1),1,'a new run re-arms the lesson');
  });

  await t.test('(a) calm → warning → toll → hunt → lull → calm, with bell cues, the hunt reward, the lull bell and the first wake batch',()=>{
   w.setMode('normal');w.drainCues();
   let st=night();
   assert.deepEqual({phase:st.phase,name:st.name,startTolls:st.startTolls,state:st.state,tolls:st.tolls,fraction:st.fraction,sleeping:st.sleeping,reward:st.reward},{phase:0,name:'宵の刻',startTolls:0,state:'calm',tolls:0,fraction:0,sleeping:5,reward:null});
   assert.deepEqual(w.omenStatus().ids,[]);assert.equal(w.itemStatus().ward,0);
   const spot=altarFront();stand(spot);
   const farthest=[...sleepers()].sort((a,b)=>flat(b.position,spot)-flat(a.position,spot)),hunts=w.runStatus().hunts;
   const bells:{bell:Bell;at:number}[]=[],states:{state:string;at:number}[]=[];
   let n=0,last='calm',burstAt=-1;
   while(n<6000&&!bells.some(b=>b.bell.beat==='lull')){
    const before=night();
    if(before.state==='hunt'&&before.left<5&&burstAt<0){assert.notEqual(w.burst(),null);assert.equal(w.burstCooldown,BURST_RECHARGE);burstAt=n;}
    const cues=step();n++;st=night();
    for(const bell of ofKind(cues,'bell'))bells.push({bell,at:n});
    if(st.state!==last){states.push({state:st.state,at:n});last=st.state;}
    if(st.state==='warning'&&before.state==='calm'){assert.ok(st.left<=WARN_SECONDS&&st.left>=WARN_SECONDS-DT-1e-9,'the 12 s warning window, less the part of the frame after the crossing: '+st.left);assert.ok(before.fraction<THRESHOLD&&st.fraction>=THRESHOLD);}
    if(st.state==='hunt'&&before.state==='warning'){
     assert.deepEqual({tolls:st.tolls,phase:st.phase,name:st.name},{tolls:1,phase:1,name:'夜半の刻'});close(st.left,HUNT_SECONDS,DT);
     assert.ok(st.fraction<DT/TOLL_SECONDS+1e-12,'the toll empties the incense');
     assert.equal(st.sleeping,2,'the first toll wakes the first batch of three at once');
     assert.deepEqual(ids(sleepers()),ids(farthest.slice(3)),'the three farthest from the visitor');
     for(const a of farthest.slice(0,3))assert.equal(a.wakeTurn,WAKE_TURN_SECONDS);
     const hunters=e().actors.filter(a=>(a.hunting??0)>0);
     assert.equal(hunters.length,2,'normal sends two hunters');
     for(const a of hunters){assert.equal(a.hunting,HUNT_SECONDS);assert.ok(a.investigate&&flat(a.investigate,spot)<=HUNT_RADIUS,'hunters converge on the warning origin');}
    }
    if(st.state==='lull'&&before.state==='hunt'){
     assert.equal(w.runStatus().hunts,hunts+1,'a survived hunt is counted');
     assert.equal(st.reward,'ward','a ward while fewer than two are carried');assert.equal(w.itemStatus().ward,1);
     assert.equal(w.burstCooldown,0,'the survived hunt refills the burst');
    }
   }
   assert.deepEqual(bells.map(b=>b.bell),[
    {kind:'bell',beat:'warning',count:1},
    {kind:'bell',beat:'toll',count:2},
    {kind:'bell',beat:'end',count:0,survived:true},
    {kind:'bell',beat:'lull',count:0},
   ]);
   assert.deepEqual(states.map(x=>x.state),['warning','hunt','lull','calm']);
   assert.deepEqual(states.map(x=>x.at),bells.map(b=>b.at),'every state change rings its bell on the same step');
   const [warn,toll,end,lull]=bells.map(b=>b.at);
   assert.ok(Math.abs(warn*DT-THRESHOLD*TOLL_SECONDS)<=DT+1e-9,`the warning rings when the incense reaches ${THRESHOLD}: step ${warn}`);
   assert.ok(Math.abs((toll-warn)*DT-WARN_SECONDS)<=DT+1e-9,'12 s warning');
   assert.ok(Math.abs((end-toll)*DT-HUNT_SECONDS)<=DT+1e-9,'35 s hunt');
   assert.ok(Math.abs((lull-end)*DT-LULL_SECONDS)<=DT+1e-9,'20 s lull');
   assert.ok(burstAt>toll&&burstAt<end&&(end-burstAt)*DT<BURST_RECHARGE,'the burst was still recharging when the hunt ended');
   st=night();assert.deepEqual({state:st.state,left:st.left,phase:st.phase,tolls:st.tolls},{state:'calm',left:0,phase:1,tolls:1});
  });

  await t.test('(a) 丑の刻参り starts at 夜半の刻 and tolls three; a toll defers the sleeper beside the visitor for a minute; a chase forfeits the hunt reward',()=>{
   w.setMode('normal',{omens:['ushimitsu']});w.drainCues();
   let st=night();
   assert.deepEqual({phase:st.phase,name:st.name,startTolls:st.startTolls,sleeping:st.sleeping,state:st.state},{phase:1,name:'夜半の刻',startTolls:1,sleeping:2,state:'calm'});
   assert.deepEqual(w.omenStatus().ids,['ushimitsu']);
   const [near,other]=[...sleepers()].sort((a,b)=>a.id-b.id);assert.ok(Math.abs(near.floor)<1,'a ground sleeper to stand beside');
   const node=corridorNode(near),k=2/flat(near.position,node),spot={x:near.position.x+(node.x-near.position.x)*k,z:near.position.z+(node.z-near.position.z)*k};
   stand(spot);assert.ok(flat(spot,near.position)<TOLL_WAKE_DISTANCE);
   assert.ok(Math.abs(other.floor)>=1||flat(spot,other.position)>=TOLL_WAKE_DISTANCE,'the other sleeper is far away');
   const hunts=w.runStatus().hunts,bells:{bell:Bell;at:number}[]=[];
   let n=0,tollAt=-1,chased=false,forcedAt=-1;
   while(n<6000&&forcedAt<0){
    const before=night();
    // One frame of chase during the hunt breaks it.
    const chaser=e().actors.find(a=>!a.dormant&&(a.hunting??0)===0);assert.ok(chaser);
    if(before.state==='hunt'&&!chased&&before.left<HUNT_SECONDS-5){chaser.brain.mode='chase';chased=true;}
    const cues=step();n++;st=night();
    if(chaser.brain.mode==='chase'){assert.equal(ofKind(cues,'chase').length,1);chaser.brain.mode='patrol';}
    for(const bell of ofKind(cues,'bell'))bells.push({bell,at:n});
    if(tollAt<0&&st.tolls===1){
     tollAt=n;assert.deepEqual({phase:st.phase,name:st.name},{phase:2,name:'丑三つ時'});
     assert.equal(st.sleeping,1,'the far sleeper wakes at the toll');assert.equal(other.dormant,false);
     assert.equal(near.dormant,true,'the one beside the visitor is deferred');
    }
    if(tollAt>0&&st.sleeping===0)forcedAt=n;
    if(tollAt>0&&forcedAt<0)assert.equal(near.dormant,true,'still deferred at step '+n);
   }
   assert.deepEqual(bells.map(b=>b.bell),[
    {kind:'bell',beat:'warning',count:1},
    {kind:'bell',beat:'toll',count:3},
    {kind:'bell',beat:'end',count:0,survived:false},
    {kind:'bell',beat:'lull',count:0},
   ]);
   assert.ok(Math.abs((forcedAt-tollAt+1)*DT-DEFER_SECONDS)<=DT+1e-9,`the deferred wake-up is forced a minute after the toll (${(forcedAt-tollAt+1)*DT} s)`);
   assert.equal(near.dormant,false);assert.equal(near.wakeTurn,WAKE_TURN_SECONDS);
   assert.equal(w.runStatus().hunts,hunts,'a broken hunt is not counted');assert.equal(night().reward,null);assert.equal(w.itemStatus().ward,0);
  });

  await t.test('(c) a capture adds .6 (ceiling .95) and holds every warning for 25 s of live time past the threshold',()=>{
   w.setMode('normal');w.drainCues();
   assert.ok(w.runStatus().elapsed>=25,'past the first-warning grace, so only the calm hold can hold the bell');
   stand(altarFront());steps(20);
   const f0=night().fraction;close(f0,20*DT/TOLL_SECONDS);
   assert.equal(capture(),true);assert.equal(night().fraction,Math.min(CEILING,f0+CAPTURE),'the capture frame adds exactly .6');
   assert.equal(night().state,'calm');
   assert.equal(capture(),true);assert.equal(night().fraction,CEILING,'a second capture stops at the .95 ceiling');
   w.drainCues();
   let live=0,count=0,warnedAt=-1;
   while(warnedAt<0&&count<2000){
    if(count===100)assert.equal(w.stopTime(),true,'a ten-second time stop inside the hold');
    const frozen=Math.min(DT,w.timeStopRemaining),cues=step();count++;live+=DT-frozen;
    if(ofKind(cues,'bell').length){assert.deepEqual(ofKind(cues,'bell'),[{kind:'bell',beat:'warning',count:1}]);warnedAt=live;break;}
    assert.equal(night().state,'calm');assert.ok(night().fraction>THRESHOLD,'past the warning line throughout');
   }
   assert.ok(warnedAt>=CALM_SECONDS-1e-9&&warnedAt<=CALM_SECONDS+DT+1e-9,`the warning waits 25 s of live time (rang at ${warnedAt})`);
   assert.ok(count*DT>CALM_SECONDS+10-DT,'the frozen ten seconds did not count');
   assert.equal(night().state,'warning');
  });

  await t.test('(b) offering at the altar purifies only when it lowers the incense',()=>{
   w.setMode('normal');w.drainCues();
   const [b0,b1]=blues,[r0]=reds;
   let p=pick(b0);assert.deepEqual(ofKind(p.cues,'pickup'),[{kind:'pickup',color:'blue'}]);close(p.delta,.1+DT/TOLL_SECONDS,1e-9,'a blue pickup adds .1');
   steps(200);
   let before=night().fraction;assert.ok(before>.15);
   assert.equal(offerAtAltar(),'offered');let cues=w.drainCues();
   assert.deepEqual(ofKind(cues,'offer'),[{kind:'offer',unlocked:false}]);assert.equal(ofKind(cues,'purify').length,1);
   close(night().fraction,before-.15,1e-12,'one blue purifies .15');
   p=pick(r0);close(p.delta,.25+DT/TOLL_SECONDS,1e-9,'a red pickup adds .25');
   p=pick(b1);close(p.delta,.1+DT/TOLL_SECONDS);
   before=night().fraction;assert.ok(before>0&&before<.4,'less incense than one red purifies: '+before);
   assert.deepEqual([w.collection().blue,w.collection().red],[1,1]);
   assert.equal(offerAtAltar(),'offered');cues=w.drainCues();
   assert.deepEqual([w.collection().redOffered,w.collection().red,w.collection().blue],[1,0,1],'the red goes first');
   assert.equal(ofKind(cues,'purify').length,1);assert.equal(night().fraction,0,'purified down to zero, never below');
   assert.equal(offerAtAltar(),'offered','the held blue is still accepted');cues=w.drainCues();
   assert.deepEqual(ofKind(cues,'offer'),[{kind:'offer',unlocked:false}]);
   assert.equal(ofKind(cues,'purify').length,0,'nothing left to purify: no purify cue');assert.equal(night().fraction,0);
   assert.deepEqual([w.collection().blueOffered,w.collection().redOffered,w.collection().unlocked],[2,1,false]);
  });

  await t.test('(f) surplus: after the unlock extra beads become score (gold as red), with an offer cue; nothing held is empty',()=>{
   w.setMode('normal');w.drainCues();
   const [,,b2,b3]=blues,[,r1,r2]=reds;
   const p=pick(r1);assert.ok(w.finale,'the second red completes a collection and begins the finale');
   assert.deepEqual(ofKind(p.cues,'bell'),[{kind:'bell',beat:'toll',count:3}]);
   const frozen=night().fraction;
   assert.equal(offerAtAltar(),'offered');let cues=w.drainCues();
   assert.deepEqual(ofKind(cues,'offer'),[{kind:'offer',unlocked:true}]);assert.equal(w.collection().unlocked,true);
   assert.equal(ofKind(cues,'purify').length,0,'the night is stopped for the finale: nothing is purified');assert.equal(night().fraction,frozen);
   for(const b of [gold,b2,r2])pick(b);
   assert.deepEqual([w.collection().gold,w.collection().blue,w.collection().red],[1,1,1]);w.drainCues();
   assert.equal(offerAtAltar(),'surplus');cues=w.drainCues();
   assert.deepEqual(ofKind(cues,'offer'),[{kind:'offer',unlocked:true,surplus:true}]);assert.equal(ofKind(cues,'purify').length,0);
   assert.deepEqual(w.collection().surplus,{blue:1,red:2},'gold counts as red');
   assert.deepEqual([w.collection().gold,w.collection().blue,w.collection().red],[0,0,0],'every held bead is spent');
   pick(b3);w.drainCues();
   assert.equal(offerAtAltar(),'surplus');assert.deepEqual(ofKind(w.drainCues(),'offer'),[{kind:'offer',unlocked:true,surplus:true}]);
   assert.deepEqual(w.collection().surplus,{blue:2,red:2},'surplus accumulates');
   assert.equal(offerAtAltar(),'empty');assert.deepEqual(ofKind(w.drainCues(),'offer'),[],'an empty altar visit emits no offer');
   assert.deepEqual(w.collection().surplus,{blue:2,red:2});
   // F7 scoring: 200 per blue, 500 per red, capped at 1200.
   assert.equal(surplusPoints({blue:2,red:1}),900);assert.equal(surplusPoints({blue:1,red:1}),700);
   assert.equal(surplusPoints({blue:6,red:0}),1200);assert.equal(surplusPoints({blue:0,red:3}),1200,'1500 is capped');
   assert.equal(surplusPoints(w.collection().surplus),1200,'this run: 400+1000 capped');
   const line=scoreRun({stage:'shrine',mode:'normal',elapsed:600,deaths:0,escapes:0,notes:0,notesTotal:3,surplus:w.collection().surplus}).lines.find(l=>l.label==='余剰奉納');
   assert.deepEqual(line,{label:'余剰奉納',detail:'青2・赤2',points:1200});
  });

  await t.test('(d) the gallery has no night: no omen, sleepers, bells, purification, notice, capture or finale',()=>{
   w.setMode('gallery',{omens:['ushimitsu']});w.drainCues();
   const st=night();
   assert.deepEqual({phase:st.phase,name:st.name,startTolls:st.startTolls,sleeping:st.sleeping,state:st.state,fraction:st.fraction,tolls:st.tolls,reward:st.reward},{phase:0,name:'宵の刻',startTolls:0,sleeping:0,state:'calm',fraction:0,tolls:0,reward:null});
   assert.deepEqual(w.omenStatus().ids,[]);assert.equal(e().dormantIds.size,0);assert.equal(w.finale,null);
   assert.ok(w.collection().unlocked,'the gate is offered, so outside the gallery a finale would arm on the next step');
   const p=pick(blues[4]);assert.deepEqual(ofKind(p.cues,'pickup'),[{kind:'pickup',color:'blue'}]);assert.equal(p.delta,0,'pickups do not feed a gallery night');
   stand(altarFront());w.camera.rotation.y=Math.PI;
   assert.equal(w.nearAltar(),false);const r=w.interact();
   assert.ok(r!=='offered'&&r!=='surplus'&&r!=='empty','the altar takes nothing in the gallery: '+String(r));
   assert.equal(w.collection().blue,1,'the bead is kept');
   // A dark-sensed gauge right in front of the visitor would teach the notice lesson outside the gallery.
   const watcher=e().actors.find(a=>a.floor===0);assert.ok(watcher);
   watcher.position={x:w.camera.position.x+1.2,z:w.camera.position.z};face(watcher.position);watcher.alert=.9;watcher.alertSource='dark';
   const before=s.updates,revision=night().revision;s.force=true;
   const cues:WorldCue[]=[];
   // Longer than a whole normal toll period plus its warning.
   try{for(let i=0;i<(TOLL_SECONDS+WARN_SECONDS+10)/DT;i++){assert.equal(w.step(DT),false,'no capture in the gallery, even when one is forced');cues.push(...w.drainCues());}}
   finally{s.force=false;}
   for(const kind of ['bell','purify','notice','finale','caught','offer'] as const)assert.equal(ofKind(cues,kind).length,0,'no '+kind+' cue in the gallery');
   assert.equal(s.updates,before,'pursuers are never stepped');assert.equal(w.finale,null);assert.equal(w.collection().finale,null);
   const end=night();assert.deepEqual({fraction:end.fraction,tolls:end.tolls,state:end.state,revision:end.revision,sleeping:end.sleeping},{fraction:0,tolls:0,state:'calm',revision,sleeping:0});
  });
 }finally{w.dispose();}
});
