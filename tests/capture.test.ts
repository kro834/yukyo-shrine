import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../app/shrine-world.ts';
import {Enemies,Doors} from '../app/shrine-gameplay.ts';
import {MirrorInventory} from '../app/mirror-inventory.ts';
import {DEFAULTS} from '../app/preferences.ts';
import {enemyDirection} from '../app/enemy-direction.ts';
import {dropHeld,scatterDropped,type Bead} from '../app/magatama.ts';
import type {WorldCue} from '../app/world-cues.ts';

// Banked capture (落とし物): offerings stay on the altar, held beads fall in a ring
// where the visitor was caught, and the capture-side clock / finale rules around it.
type Target=Parameters<Enemies['addPatrolTargets']>[0][number];
type Point={x:number;z:number};
const DT=.05,RING=.35,DRIFT=.12,TOLL_SECONDS=150;
const close=(actual:number,expected:number,epsilon=1e-9,message?:string)=>assert.ok(Math.abs(actual-expected)<=epsilon,message??`${actual} ≉ ${expected}`);
const flat=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
/** dropHeld lays `n` held beads at angle i·2π/n on a .35 m ring. */
const ringAt=(p:Point,i:number,n:number,radius=RING)=>({x:p.x+Math.cos(i*Math.PI*2/n)*radius,z:p.z+Math.sin(i*Math.PI*2/n)*radius});
const ofKind=<K extends WorldCue['kind']>(cues:readonly WorldCue[],kind:K)=>cues.filter((c):c is Extract<WorldCue,{kind:K}>=>c.kind===kind);

test('dropHeld lays only held beads on a .35 m ring; scatterDropped sends an unrecovered bundle home',()=>{
 const bead=(id:string,color:Bead['color'],x:number,z:number,state:Partial<Bead>={}):Bead=>({id,color,position:{x,z},floor:0,collected:false,offered:false,home:{x,z,floor:0},...state});
 const held=[bead('a','blue',1,2,{collected:true}),bead('c','red',5,6,{collected:true}),bead('e','gold',9,10,{collected:true}),bead('u','blue',60,4,{floor:4.8,home:{x:60,z:4,floor:4.8},collected:true})];
 const offered=bead('b','blue',3,4,{collected:true,offered:true}),lying=bead('d','blue',7,8),beads=[held[0],offered,held[1],lying,held[2],held[3]];
 const P={x:20,z:-3};
 assert.equal(dropHeld(beads,P,0),4);
 held.forEach((b,i)=>{
  assert.deepEqual({collected:b.collected,dropped:b.dropped,floor:b.floor},{collected:false,dropped:true,floor:0},b.id);
  const want=ringAt(P,i,4);close(b.position.x,want.x);close(b.position.z,want.z);close(flat(b.position,P),RING);
 });
 assert.deepEqual(offered,bead('b','blue',3,4,{collected:true,offered:true}),'an offered bead is never touched');
 assert.deepEqual(lying,bead('d','blue',7,8),'a bead still lying in its room is not part of the bundle');
 assert.equal(dropHeld(beads,{x:0,z:0},0),0,'nothing held, nothing dropped');close(held[0].position.x,P.x+RING);
 // The visitor recovers the red (the world clears its dropped flag), then is caught again.
 const red=held[1];red.collected=true;red.dropped=false;const kept={...red.position};
 assert.equal(scatterDropped(beads),3);
 for(const b of [held[0],held[2],held[3]]){assert.equal(b.dropped,false,b.id);assert.equal(b.collected,false,b.id);assert.deepEqual(b.position,{x:b.home.x,z:b.home.z},b.id+' back home');assert.equal(b.floor,b.home.floor,b.id);}
 assert.equal(held[3].floor,4.8,'an upper-floor bead returns to its own storey');
 assert.deepEqual(red.position,kept,'a recovered bead stays in hand');assert.equal(red.collected,true);
 assert.equal(scatterDropped(beads),0,'nothing left to scatter');
});

function harness(t:TestContext,seed:number){
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},render(){},clearDepth(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const add=Enemies.prototype.addPatrolTargets;
 const s={enemies:undefined as Enemies|undefined,targets:[] as Target[],force:false};
 t.mock.method(Enemies.prototype,'addPatrolTargets',function(this:Enemies,p:Target[]){s.enemies=this;s.targets=p;return add.call(this,p);});
 t.mock.method(Enemies.prototype,'update',()=>s.force);
 t.mock.method(MirrorInventory.prototype,'collect',()=>0);
 t.mock.method(Doors.prototype,'update',function(this:Doors){for(const d of this.states){d.open=true;d.progress=1;}});
 const w=createWorld(canvas as unknown as HTMLCanvasElement,renderer,seed);
 w.configure({...DEFAULTS,quality:'low'});
 // Bead patrol targets keep the bead's original (home) position object.
 const bead=(id:string)=>{const p=s.targets.find(p=>p.id==='room:'+id);assert.ok(p,'bead '+id);return {id,home:{x:p.position.x,z:p.position.z},floor:p.floor};};
 const groundBlues=()=>s.targets.filter(p=>p.id.startsWith('room:')&&p.floor===0&&!/^room:(red|gold)-/.test(p.id)).map(p=>bead(p.id.slice(5)));
 const reds=()=>s.targets.filter(p=>p.id.startsWith('room:red-')).map(p=>bead(p.id.slice(5)));
 const stand=(p:Point)=>{w.camera.position.set(p.x,1.68,p.z);};
 const fraction=()=>w.nightStatus().fraction;
 const steps=(n:number)=>{for(let i=0;i<n;i++)assert.equal(w.step(DT),false,'no capture while the pursuers are inert');};
 const step=()=>{assert.equal(w.step(DT),false);return w.drainCues();};
 const capture=()=>{s.force=true;try{return w.step(DT);}finally{s.force=false;}};
 const mesh=(id:string)=>{const m=w.scene.getObjectByName('magatama-'+id);assert.ok(m,'mesh '+id);return m;};
 const glows=()=>w.scene.children.filter(o=>o.name==='magatama-drop-glow'&&o.visible);
 const offerAtAltar=()=>{const a=w.altarPosition;stand({x:a.x,z:a.z-2});w.camera.rotation.y=Math.PI;try{return w.interact();}finally{w.camera.rotation.y=0;}};
 return {w,s,bead,groundBlues,reds,stand,fraction,steps,step,capture,mesh,glows,offerAtAltar};
}

test('banked capture: offerings stay, held beads drop as a bundle, recover with a running tally, a second capture scatters, toll wake-ups survive capture',async t=>{
 const h=harness(t,17),{w,stand,fraction,step,steps,capture,mesh,glows}=h;
 try{
  w.setMode('normal');w.drainCues();
  const blues=h.groundBlues();assert.ok(blues.length>=5);
  const [b0,b1,b2,b3,untouched]=blues,red=h.reds()[0];
  const pick=(b:{home:Point})=>{stand(b.home);const before=fraction(),cues=step();return {cues,delta:fraction()-before};};
  let freshDelta=0;
  // Bundle under test: blue b2, blue b3 and one red, in bead order (blue rooms precede red areas).
  const held=[b2,b3,red],P=b3.home,P2=b1.home,P3=b0.home;

  await t.test('(a) capture keeps offerings and drops held beads in a .35 m ring at the capture point',()=>{
   for(const b of [b0,b1]){const {cues,delta}=pick(b);assert.deepEqual(ofKind(cues,'pickup'),[{kind:'pickup',color:'blue'}]);freshDelta=delta;}
   close(freshDelta,.1+DT/TOLL_SECONDS,1e-9,'a fresh blue pickup advances the night by .1 plus the frame');
   assert.equal(h.offerAtAltar(),'offered');
   let c=w.collection();assert.equal(c.blueOffered,2);assert.equal(c.blue,0);assert.equal(c.unlocked,false);
   for(const b of held)pick(b);
   c=w.collection();assert.deepEqual([c.blue,c.red,c.gold,c.dropped],[2,1,0,0]);assert.equal(w.finale,null,'one red is not a collection');
   w.drainCues();stand(P);
   assert.equal(capture(),true,'the forced catch reports a capture');
   assert.equal(ofKind(w.drainCues(),'caught').length,1);
   c=w.collection();
   assert.deepEqual({blue:c.blue,red:c.red,gold:c.gold,blueOffered:c.blueOffered,redOffered:c.redOffered,unlocked:c.unlocked,dropped:c.dropped},{blue:0,red:0,gold:0,blueOffered:2,redOffered:0,unlocked:false,dropped:3},'offerings stay on the altar; only held beads drop');
   assert.deepEqual(w.captureReport(),{dropped:3,scattered:0});
   assert.equal(fraction(),.95,'.45 of pickups plus the .6 capture penalty stops at the .95 ceiling');
   assert.ok(flat(w.camera.position,P)>24,'the visitor wakes more than 24 m from the bundle');
   // The first held bead lies at angle 0 of the ring: exactly 0.35 m east of the capture point.
   const dir=w.bundleDirection();assert.ok(dir);assert.equal(dir.count,3);
   const expected=enemyDirection(w.camera.position,{x:P.x+RING,z:P.z},w.camera.rotation.y);
   close(dir.distance,expected.distance);close(dir.angle,expected.angle);assert.ok(dir.distance>24-RING);
   stand(P);const fromCapture=w.bundleDirection()!;close(fromCapture.distance,RING,1e-9,'the bundle ring has a .35 m radius');
   w.render(1000);
   for(const b of held){const m=mesh(b.id),r=flat(m.position,P);assert.equal(m.visible,true,b.id);assert.ok(r>=RING-DRIFT-1e-9&&r<=RING+DRIFT+1e-9,`${b.id} lies ${r.toFixed(3)} m from the capture point`);close(m.position.y,.95,.07+1e-9);}
   for(const b of [b0,b1])assert.equal(mesh(b.id).visible,false,'offered beads stay collected');
   const still=mesh(untouched.id);assert.equal(still.position.x,untouched.home.x);assert.equal(still.position.z,untouched.home.z);
   const g=glows();assert.equal(g.length,3,'each dropped bead carries a pale glow');for(const s of g){close(s.position.y,.55);assert.ok(flat(s.position,P)<=RING+DRIFT+1e-9);}
  });

  await t.test('(b) recovery emits a running per-colour tally, no pickup cue and no night advance',()=>{
   // `first` is the earliest still-dropped bead in bead order, which bundleDirection() points at.
   const tallies=[{i:0,first:0,tally:{blue:1,red:0,gold:0}},{i:2,first:1,tally:{blue:1,red:1,gold:0}},{i:1,first:1,tally:{blue:2,red:1,gold:0}}];
   let left=3,last:WorldCue|undefined;
   for(const {i,first,tally} of tallies){
    stand(P);const pointing=w.bundleDirection();assert.ok(pointing);assert.equal(pointing.count,left);
    close(pointing.distance,RING,1e-9,'from the capture point the bundle is .35 m away');close(pointing.angle,enemyDirection(P,ringAt(P,first,3),0).angle,1e-9,'ring slot '+first);
    // One metre out along the bead's own ring direction: .65 m to that bead, >1.15 m to the others.
    stand(ringAt(P,i,3,1));const before=fraction(),cues=step();left--;
    assert.deepEqual(ofKind(cues,'recover'),[{kind:'recover',count:1,...tally}],'tally after bead '+i);
    assert.equal(ofKind(cues,'pickup').length,0,'a recovered bead is not a pickup');
    const delta=fraction()-before;close(delta,DT/TOLL_SECONDS,1e-9,'recovering does not advance the night');
    assert.ok(freshDelta-delta>.099,'a fresh pickup advances the night by .1 more than a recovery');
    assert.equal(w.collection().dropped,left);last=cues.find(c=>c.kind==='recover');
   }
   assert.ok(last&&last.kind==='recover');
   assert.equal(last.blue+last.red+last.gold,w.captureReport().dropped,'the final cue covers the whole bundle');
   const c=w.collection();assert.deepEqual([c.blue,c.red,c.dropped],[2,1,0]);assert.equal(w.bundleDirection(),null);
   w.render(1100);assert.equal(glows().length,0);for(const b of held)assert.equal(mesh(b.id).visible,false);
  });

  await t.test('(c) a second capture while beads are still dropped scatters them home',()=>{
   stand(P2);assert.equal(capture(),true);assert.deepEqual(w.captureReport(),{dropped:3,scattered:0});w.drainCues();
   // The tally restarted after the last bundle was fully recovered.
   stand(ringAt(P2,2,3,1));assert.deepEqual(ofKind(step(),'recover'),[{kind:'recover',count:1,blue:0,red:1,gold:0}]);
   assert.deepEqual([w.collection().red,w.collection().dropped],[1,2]);
   stand(P3);assert.equal(capture(),true);
   assert.deepEqual(w.captureReport(),{dropped:1,scattered:2},'the two unrecovered blues scatter; the held red drops');
   const c=w.collection();assert.deepEqual([c.blue,c.red,c.dropped,c.blueOffered],[0,0,1,2]);
   w.render(2000);
   for(const b of [b2,b3]){const m=mesh(b.id);assert.equal(m.visible,true);assert.equal(m.position.x,b.home.x,b.id+' back home');assert.equal(m.position.z,b.home.z,b.id+' back home');}
   const r=flat(mesh(red.id).position,P3);assert.ok(r>=RING-DRIFT-1e-9&&r<=RING+DRIFT+1e-9);
   assert.equal(glows().length,1,'only the new bundle glows');
   const dir=w.bundleDirection();assert.ok(dir);assert.equal(dir.count,1);close(dir.distance,flat(w.camera.position,{x:P3.x+RING,z:P3.z}));
   // A scattered bead is an ordinary bead again: picking it up is a pickup, not a recovery.
   stand(b2.home);const cues=step();assert.deepEqual(ofKind(cues,'pickup'),[{kind:'pickup',color:'blue'}]);assert.equal(ofKind(cues,'recover').length,0);
   assert.deepEqual([w.collection().blue,w.collection().dropped],[1,1]);
  });

  await t.test('(f) a pending toll wake-up survives a capture and woken sleepers stay awake',t=>{
   // Every sleeper stays put while this mock pretends the visitor is watching them.
   const wake=t.mock.method(Enemies.prototype,'wakeBatch',()=>0);
   const args=()=>wake.mock.calls.map(c=>({count:c.arguments[0],force:c.arguments[4]}));
   assert.equal(w.nightStatus().sleeping,5,'normal starts with 3+2 sleepers');
   let toll:WorldCue|undefined;
   for(let i=0;i<1500&&!toll;i++){assert.equal(wake.mock.callCount(),0,'no wake-up is attempted before a toll');toll=step().find(c=>c.kind==='bell'&&c.beat==='toll');}
   assert.deepEqual(toll,{kind:'bell',beat:'toll',count:2},'the first toll rings the second phase in');
   assert.deepEqual([w.nightStatus().tolls,w.nightStatus().state,w.nightStatus().sleeping],[1,'hunt',5]);
   assert.deepEqual(args(),[{count:3,force:false}],'the first toll asks for the first batch of three');
   // Through the hunt and the lull (55 s) the deferred wake-up keeps retrying.
   const seen:WorldCue[]=[];let lull:WorldCue|undefined,since=0;
   for(let i=0;i<1300&&!lull;i++,since+=DT){const cues=step();seen.push(...cues);lull=cues.find(c=>c.kind==='bell'&&c.beat==='lull');}
   assert.deepEqual(lull,{kind:'bell',beat:'lull',count:0},'lull-end rings as a lull bell');
   assert.deepEqual(seen.filter(c=>c.kind==='bell'&&c.beat==='end'),[{kind:'bell',beat:'end',count:0,survived:true}]);
   assert.ok(since>50&&since<60,`lull ended ${since.toFixed(2)} s after the toll`);
   assert.ok(args().every(a=>a.count===3&&a.force===false));
   const before=wake.mock.callCount();
   assert.equal(capture(),true);assert.equal(wake.mock.callCount(),before,'no wake-up on the capture frame');
   assert.deepEqual(w.captureReport(),{dropped:1,scattered:1});assert.equal(w.nightStatus().sleeping,5);
   steps(200);
   // 65 s after the toll: the minute would have forced the wake-up had the capture not restarted it.
   const after=args().slice(before);assert.equal(after.length,200,'the pending wake-up retries every frame after respawn');
   assert.ok(after.every(a=>a.count===3&&a.force===false),'still three pending, and the retry minute restarted at the capture');
   wake.mock.restore();
   let tolls=0,i=0;for(;i<1300&&w.nightStatus().sleeping===5;i++)tolls+=step().filter(c=>c.kind==='bell'&&c.beat==='toll').length;
   assert.equal(tolls,0,'woken by the first toll, before any second bell');
   assert.equal(w.nightStatus().sleeping,2,'exactly the first batch of three woke');
   steps(20);assert.equal(w.nightStatus().sleeping,2);
   assert.equal(capture(),true);assert.equal(w.nightStatus().sleeping,2,'a capture does not put woken sleepers back to sleep');
  });
 }finally{w.dispose();}
});

test('finale re-arm and night clock: a locked gate gets the full 6 s omen and resumes the clock (clearPhase follows the latest finale); an unlocked gate re-arms in 4 s with the clock stopped',async t=>{
 const h=harness(t,17),{w,stand,fraction,step,steps,capture}=h;
 try{
  w.setMode('normal',{omens:['ushimitsu']});w.drainCues();
  assert.equal(w.nightStatus().startTolls,1);assert.equal(w.nightStatus().phase,1);
  const gold=h.bead('gold-yokocho');
  /** Steps until a finale begins; returns the live seconds taken and that frame's cues. */
  const untilFinale=(limit:number)=>{let seconds=0,cues:WorldCue[]=[];for(let i=0;i<limit&&!w.finale;i++){cues=step();seconds+=DT;}return {seconds,cues};};
  let frozen=0;

  await t.test('(e) the gold pickup stops the night clock',()=>{
   steps(20);const before=fraction();assert.ok(before>0);
   stand(gold.home);const cues=step();
   assert.deepEqual(ofKind(cues,'pickup'),[{kind:'pickup',color:'gold'}]);assert.ok(w.finale);
   assert.deepEqual(cues.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:3}]);
   assert.equal(w.omenRemaining(),6,'the first finale has the full six-second omen');
   assert.equal(w.nightStatus().clearPhase,1,'clearPhase records the night phase at the finale');
   frozen=fraction();assert.equal(frozen,before,'the gold frame does not advance the clock');
   steps(100);assert.equal(fraction(),frozen,'the clock is stopped during the finale');
  });

  await t.test('(e)+(d) a capture with the gate locked resumes the clock, and the finale re-arms after 12 s with the full omen',()=>{
   const dropAt=w.camera.position.clone();
   assert.equal(capture(),true);assert.equal(w.finale,null);
   assert.deepEqual(w.captureReport(),{dropped:1,scattered:0});assert.deepEqual([w.collection().gold,w.collection().dropped],[0,1]);
   assert.equal(fraction(),frozen+.6,'the capture adds .6 to the resumed clock');assert.equal(w.nightStatus().state,'calm');
   w.drainCues();
   stand(dropAt);const before=fraction(),cues=step();
   assert.deepEqual(ofKind(cues,'recover'),[{kind:'recover',count:1,blue:0,red:0,gold:1}]);
   assert.equal(ofKind(cues,'pickup').length,0);assert.equal(w.finale,null,'no finale during the 12 s grace');
   close(fraction()-before,DT/TOLL_SECONDS,1e-9,'the clock runs again');
   const mid=fraction();steps(100);close(fraction(),mid+100*DT/TOLL_SECONDS,1e-9,'and keeps advancing');
   const {seconds,cues:rearm}=untilFinale(300),graceSeconds=DT+100*DT+seconds;
   assert.ok(w.finale,'the held gold re-arms the finale');
   assert.ok(graceSeconds>12-1e-6&&graceSeconds<12+DT+1e-6,`re-armed ${graceSeconds.toFixed(2)} s after the capture`);
   assert.equal(ofKind(rearm,'finale').length,1);
   assert.deepEqual(rearm.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:3}],'a re-arm on a locked gate tolls three times');
   assert.equal(w.omenRemaining(),6,'a re-arm on a locked gate gets the full six-second omen');
   assert.equal(w.nightStatus().clearPhase,1);
   frozen=fraction();steps(40);assert.equal(fraction(),frozen,'the clock stops again');
  });

  await t.test('(d)+(e) a second locked capture re-arms with the full omen again, and clearPhase follows the latest finale',()=>{
   const dropAt=w.camera.position.clone();
   assert.equal(capture(),true);assert.equal(w.finale,null);assert.deepEqual(w.captureReport(),{dropped:1,scattered:0});
   assert.equal(fraction(),.95,'the resumed clock takes the .6 penalty up to the .95 ceiling');
   w.drainCues();
   // Leave the gold where it fell: the resumed clock holds calm for 25 s, warns for 12 s, then tolls into 丑三つ時.
   let toll:WorldCue|undefined,seconds=0;
   for(let i=0;i<1200&&!toll;i++){toll=step().find(c=>c.kind==='bell'&&c.beat==='toll');seconds+=DT;}
   assert.deepEqual(toll,{kind:'bell',beat:'toll',count:3},'the resumed night tolls its third bell');
   assert.ok(seconds>37-1e-6&&seconds<37+2*DT+1e-6,`tolled ${seconds.toFixed(2)} s after the capture`);
   assert.deepEqual([w.nightStatus().phase,w.nightStatus().clearPhase],[2,1],'clearPhase still records the earlier finale');
   assert.equal(w.finale,null,'a dropped gold bead does not count toward the finale');
   stand(dropAt);const cues=step();
   assert.deepEqual(ofKind(cues,'recover'),[{kind:'recover',count:1,blue:0,red:0,gold:1}]);
   assert.ok(w.finale,'with the grace long over the recovered gold re-arms at once');
   assert.equal(ofKind(cues,'finale').length,1);
   assert.deepEqual(cues.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:3}],'still locked: three tolls');
   assert.equal(w.omenRemaining(),6,'still locked: the full six-second omen');
   assert.equal(w.nightStatus().clearPhase,2,'clearPhase is overwritten by the latest finale');
   frozen=fraction();steps(20);assert.equal(fraction(),frozen,'the clock stops for the new finale');
  });

  await t.test('(e)+(d) a capture with the gate unlocked leaves the clock stopped and re-arms with the 4 s omen',()=>{
   assert.equal(h.offerAtAltar(),'offered');
   const offered=w.drainCues();assert.deepEqual(ofKind(offered,'offer').map(c=>({unlocked:c.unlocked,surplus:c.surplus})),[{unlocked:true,surplus:undefined}],'the gold is the unlocking offering, not surplus');
   assert.equal(w.collection().unlocked,true);assert.equal(w.collection().gold,0);assert.ok(w.finale);
   frozen=fraction();
   assert.equal(capture(),true);assert.equal(w.finale,null);
   assert.deepEqual(w.captureReport(),{dropped:0,scattered:0},'nothing was held');
   assert.equal(fraction(),frozen,'no capture penalty and no resume once the gate is open');
   w.drainCues();
   const {seconds,cues}=untilFinale(300);
   assert.ok(w.finale,'the offered gold re-arms the finale');
   assert.ok(seconds>12-1e-6&&seconds<12+DT+1e-6,`re-armed ${seconds.toFixed(2)} s after the capture`);
   assert.equal(fraction(),frozen,'the clock stayed stopped through the grace');
   assert.deepEqual(cues.filter(c=>c.kind==='bell'),[{kind:'bell',beat:'toll',count:2}],'an unlocked re-arm tolls twice');
   assert.equal(w.omenRemaining(),4,'an unlocked re-arm gets the short omen');
  });
 }finally{w.dispose();}
});
