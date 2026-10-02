import test from 'node:test';
import assert from 'node:assert/strict';
import {NightClock,nightConfig,chooseSleepers,PHASE_NAMES,type NightConfig,type NightEvent,type NightInput} from '../app/night-clock.ts';
import {seededRandom} from '../app/seeded-random.ts';
const near=(a:number,b:number,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} ≉ ${b}`);
const BASE:NightInput={liveDt:.5,elapsed:0,chasing:false,riding:false,player:{x:0,z:0},floor:0};
/** A dyadic period keeps half-second frame sums exact, so window lengths can be asserted exactly. */
const EXACT:NightConfig={...nightConfig('normal'),tollSeconds:128};
type Script=Partial<NightInput>|((t:number)=>Partial<NightInput>);
/** Steps one clock at a fixed frame size; elapsed follows live time unless the script overrides it. */
function harness(config:NightConfig=EXACT,dt=.5){
 const clock=new NightClock(config),log:{t:number;event:NightEvent}[]=[];let t=0;
 const step=(script:Script={})=>{const o=typeof script==='function'?script(t):script,live=o.liveDt??dt;t+=Number.isFinite(live)?Math.max(0,live):0;const events=clock.step({...BASE,liveDt:dt,elapsed:t,...o});for(const event of events)log.push({t,event});return events;};
 const until=<K extends NightEvent['kind']>(kind:K,script:Script={},limit=200000)=>{for(let i=0;i<limit;i++){const e=step(script).find(e=>e.kind===kind);if(e)return e as Extract<NightEvent,{kind:K}>;}throw new Error('no '+kind);};
 const run=(seconds:number,script:Script={})=>{const end=t+seconds-1e-9;while(t<end)step(script);};
 return {clock,log,step,until,run,get t(){return t;}};
}
const at=(log:{t:number;event:NightEvent}[],kind:NightEvent['kind'])=>log.filter(l=>l.event.kind===kind).map(l=>l.t);
test('night config: toll period, hunters and wake batches per mode; omens scale only the night',()=>{
 const expected={normal:[150,2,[3,2]],hard:[130,3,[2,2]],nightmare:[110,4,[2,1]]} as const;
 for(const [mode,[toll,hunters,sleepers]] of Object.entries(expected) as [keyof typeof expected,(typeof expected)[keyof typeof expected]][]){
  const c=nightConfig(mode);assert.equal(c.tollSeconds,toll);assert.equal(c.hunters,hunters);assert.deepEqual(c.sleepers,sleepers);
  assert.deepEqual({warn:c.warnSeconds,hunt:c.huntSeconds,lull:c.lullSeconds,defer:c.deferMax,first:c.firstWarningAfter,calm:c.calmAfterCapture,capture:c.capture,start:c.startTolls},{warn:12,hunt:35,lull:20,defer:30,first:25,calm:25,capture:.6,start:0});
  assert.deepEqual(c.pickup,{blue:.1,red:.25});assert.deepEqual(c.purify,{blue:.15,red:.4});assert.deepEqual(c.blueBalance,[0,.25,.55]);assert.deepEqual(c.fog,[1,1.2,1.45]);
 }
 near(nightConfig('normal',{tollScale:1.25}).tollSeconds,187.5);near(nightConfig('normal',{tollScale:.8}).tollSeconds,120);near(nightConfig('nightmare',{tollScale:.8}).tollSeconds,88);
 const longNight=nightConfig('nightmare',{tollScale:1.4,extraHunters:1});near(longNight.tollSeconds,154);assert.equal(longNight.hunters,5);
 assert.deepEqual(nightConfig('normal',{extraSleepers:1}).sleepers,[3,3]);assert.deepEqual(nightConfig('nightmare',{extraSleepers:1}).sleepers,[2,2]);
 assert.deepEqual(nightConfig('normal',{extraSleepers:-1,startTolls:1}).sleepers,[2,2]);assert.deepEqual(nightConfig('nightmare',{extraSleepers:-1}).sleepers,[1,1]);
 assert.deepEqual(nightConfig('nightmare',{extraSleepers:-4}).sleepers,[0,0]);
 for(const mode of ['normal','hard','nightmare'] as const)for(const extraSleepers of [-1,0,1,2]){const c=nightConfig(mode,{extraSleepers});assert.equal(c.sleepers[0]+c.sleepers[1],nightConfig(mode).sleepers[0]+nightConfig(mode).sleepers[1]+extraSleepers);}
 const override=nightConfig('hard',{tollSeconds:90,hunters:1,startTolls:1});assert.equal(override.tollSeconds,90);assert.equal(override.hunters,1);assert.equal(override.startTolls,1);
 const neutral={tollScale:1,extraHunters:0,extraSleepers:0,fogScale:1,sense:1,hearing:1,runHearing:1,startTolls:0,startBell:0};
 for(const mode of ['normal','hard','nightmare'] as const)assert.deepEqual(nightConfig(mode,neutral),nightConfig(mode));
 const a=nightConfig('normal'),b=nightConfig('normal');a.pickup.blue=9;a.purify.red=9;assert.equal(b.pickup.blue,.1);assert.equal(b.purify.red,.4);
});
test('gallery night is inert: never steps, never tolls, ignores omens and pickups',()=>{
 const g=nightConfig('gallery');assert.equal(g.tollSeconds,Infinity);assert.equal(g.hunters,0);assert.deepEqual(g.sleepers,[0,0]);assert.deepEqual(g.blueBalance,[0,0,0]);assert.deepEqual(g.fog,[1,1,1]);
 assert.deepEqual(nightConfig('gallery',{tollScale:.5,extraHunters:3,extraSleepers:2,startTolls:1}),g);
 const h=harness(g,1);h.clock.pickup('red');h.clock.pickup('blue');h.clock.captured();h.run(2000,{chasing:true});
 assert.equal(h.log.length,0);assert.equal(h.clock.fraction,0);assert.equal(h.clock.state,'calm');assert.equal(h.clock.phase,0);assert.equal(h.clock.blueBalance,0);assert.equal(h.clock.fogScale,1);assert.equal(h.clock.purify({blue:3,red:3}),0);
});
test('the incense burns only on live time; pickups push it, offerings pull it back to zero at most',()=>{
 const h=harness(nightConfig('normal'));h.step({liveDt:30});near(h.clock.fraction,.2);const f=h.clock.fraction,rev=h.clock.revision;
 for(let i=0;i<1000;i++)assert.deepEqual(h.step({liveDt:0}),[]);
 for(const liveDt of [-1,NaN,Infinity])assert.deepEqual(h.step({liveDt}),[]);
 assert.equal(h.clock.fraction,f);assert.equal(h.clock.revision,rev);
 h.clock.captured();for(let i=0;i<1000;i++)h.step({liveDt:0});assert.equal(h.clock.calmHold,25,'time stop pauses the post-capture calm');
 const c=new NightClock(nightConfig('hard'));c.pickup('blue');near(c.fraction,.1);c.pickup('red');near(c.fraction,.35);const r=c.revision;c.pickup('gold');near(c.fraction,.35);assert.equal(c.revision,r);
 for(let i=0;i<10;i++)c.pickup('red');assert.equal(c.fraction,.999);
 c.fraction=.5;near(c.purify({blue:1,red:0}),.15);near(c.fraction,.35);
 near(c.purify({blue:0,red:1,gold:1}),.35);assert.equal(c.fraction,0);const before=c.revision;assert.equal(c.purify({blue:2,red:2}),0);assert.equal(c.revision,before);
 c.fraction=.9;near(c.purify({blue:2,red:1}),.7);near(c.fraction,.2);assert.equal(c.purify({blue:-3,red:-1}),0);near(c.fraction,.2);
});
test('a capture jumps the bar by .6 (never past .95) and holds every warning for 25 s',()=>{
 const c=new NightClock(nightConfig('normal'));c.fraction=.1;c.captured();near(c.fraction,.7);assert.equal(c.calmHold,25);
 c.fraction=.5;c.captured();assert.equal(c.fraction,.95);
 const h=harness();h.clock.fraction=.5;h.step();h.clock.captured();const captured=h.t;
 const warning=h.until('warning',{elapsed:1000});assert.equal(h.t-captured,25);assert.equal(warning.first,true);
});
test('exactly one warning and one toll per crossing at any frame size; windows keep their length',()=>{
 for(const dt of [1/60,.25,1,5]){
  const h=harness(nightConfig('normal'),dt);h.run(400);
  assert.deepEqual(h.log.map(l=>l.event.kind),['warning','toll','hunt-end','lull-end','warning','toll','hunt-end','lull-end'],`dt ${dt}`);
  // Events surface at the end of the frame holding their true time: 138, 150, 185, 205, 288, 300, 335, 355 s.
  h.log.forEach((l,i)=>{const truth=[138,150,185,205,288,300,335,355][i];assert.ok(l.t>=truth-1e-6&&l.t<truth+dt+1e-6,`${l.event.kind} at ${l.t}, dt ${dt}`);});
 }
 const h=harness();h.until('warning');assert.equal(h.t,116);for(let i=0;i<23;i++)assert.deepEqual(h.step(),[]);assert.equal(h.clock.left,.5);assert.equal(h.step()[0].kind,'toll');
 const s=harness();s.until('warning');for(let i=0;i<10;i++)s.step();for(let i=0;i<1000;i++)assert.deepEqual(s.step({liveDt:0}),[]);
 for(let i=0;i<13;i++)assert.deepEqual(s.step(),[]);assert.equal(s.step()[0].kind,'toll','the time stop pauses the warning');
 assert.equal(s.clock.state,'hunt');assert.equal(s.clock.left,35);
});
test('the hunt origin is where the player stood when the bell warned, never the live position',()=>{
 const h=harness(),player={x:10,z:20};
 const warning=h.until('warning',()=>({player,floor:5.1}));
 assert.deepEqual(warning.origin,{x:10,z:20});assert.equal(warning.floor,4.8);assert.equal(h.clock.originFloor,4.8);
 player.x=50;warning.origin.z=-1;assert.deepEqual(h.clock.origin,{x:10,z:20},'the snapshot is a copy');
 const toll=h.until('toll',{player:{x:50,z:20},floor:0});
 assert.deepEqual(toll.origin,{x:10,z:20});assert.equal(toll.floor,4.8);assert.ok(Math.hypot(toll.origin.x-50,toll.origin.z-20)>=40);
 const third=harness(),w=third.until('warning',{player:{x:-3,z:7},floor:9.8});assert.equal(w.floor,9.6);
});
test('the toll waits out a chase, a ride or the post-capture calm, but never longer than 30 s',()=>{
 for(const held of [{chasing:true},{riding:true}]){
  const h=harness();h.until('warning');const w=h.t;h.until('toll',held);assert.equal(h.t-w,42,JSON.stringify(held));
 }
 const brief=harness();brief.until('warning');const w=brief.t;brief.until('toll',t=>({chasing:t-w<20}));assert.equal(brief.t-w,20.5);assert.equal(brief.clock.left,34.5);
 const capture=harness();capture.until('warning');const cw=capture.t;capture.clock.captured();capture.until('toll');assert.equal(capture.t-cw,25,'the calm after a capture holds the bell');
 const twice=harness();twice.until('warning');const tw=twice.t;twice.run(11.5);twice.clock.captured();twice.run(18.5);twice.clock.captured();
 twice.until('toll');assert.equal(twice.t-tw,42,'deferral is capped even while the calm is renewed');
 const coarse=harness(nightConfig('normal'),7);coarse.until('warning');assert.equal(coarse.t,140);near(coarse.clock.left,10,1e-6);
 coarse.until('toll',{chasing:true});assert.equal(coarse.t,182);near(coarse.clock.left,33,1e-6);assert.equal(coarse.clock.deferred,0);
});
test('no warning in the first 25 s of a run or while riding, even with a full incense bar',()=>{
 for(const mode of ['normal','hard','nightmare'] as const){
  const h=harness(nightConfig(mode));for(let i=0;i<4;i++)h.clock.pickup('red');assert.equal(h.clock.fraction,.999);
  h.until('warning');assert.equal(h.t,25,mode);
 }
 const ride=harness();ride.clock.fraction=.999;ride.run(100,{riding:true,elapsed:1000});assert.equal(ride.log.length,0);assert.equal(ride.clock.state,'calm');
 assert.equal(ride.step({elapsed:1000})[0].kind,'warning');
});
test('stop() ends the night for the finale: no further events and the phase is frozen',()=>{
 const h=harness();h.until('toll');h.clock.stop();const rev=h.clock.revision,f=h.clock.fraction;
 h.run(3000,{chasing:true});h.clock.pickup('red');h.clock.noteChase();h.clock.captured();h.clock.stop();
 assert.equal(h.clock.purify({blue:5,red:5}),0);assert.equal(h.log.filter(l=>l.t>h.t-3000).length,0);
 assert.equal(h.clock.phase,1);assert.equal(h.clock.tolls,1);assert.equal(h.clock.fraction,f);assert.equal(h.clock.calmHold,0);assert.equal(h.clock.revision,rev);assert.equal(h.clock.state,'calm');assert.equal(h.clock.snapshot().name,'夜半の刻');
 const warned=harness();warned.until('warning');warned.clock.stop();warned.run(500);assert.equal(at(warned.log,'toll').length,0);
});
test('tolls deepen the night 宵→夜半→丑三つ and stay there; late tolls wake every remaining sleeper',()=>{
 assert.deepEqual(PHASE_NAMES,['宵の刻','夜半の刻','丑三つ時']);
 for(const mode of ['normal','hard','nightmare'] as const){
  const config=nightConfig(mode),h=harness(config),seen:{phase:number;balance:number;fog:number;name:string}[]=[];
  assert.equal(h.clock.phase,0);assert.equal(h.clock.blueBalance,0);assert.equal(h.clock.fogScale,1);assert.equal(h.clock.snapshot().name,'宵の刻');
  const tolls=[];for(let i=0;i<4;i++){tolls.push(h.until('toll'));seen.push({phase:h.clock.phase,balance:h.clock.blueBalance,fog:h.clock.fogScale,name:h.clock.snapshot().name});}
  assert.deepEqual(tolls.map(t=>[t.tolls,t.phase,t.wake]),[[1,1,config.sleepers[0]],[2,2,config.sleepers[1]],[3,2,Infinity],[4,2,Infinity]],mode);
  assert.deepEqual(seen,[{phase:1,balance:.25,fog:1.2,name:'夜半の刻'},{phase:2,balance:.55,fog:1.45,name:'丑三つ時'},{phase:2,balance:.55,fog:1.45,name:'丑三つ時'},{phase:2,balance:.55,fog:1.45,name:'丑三つ時'}]);
 }
 const late=harness(nightConfig('normal',{startTolls:1,extraSleepers:-1}));assert.equal(late.clock.phase,1);assert.equal(late.clock.blueBalance,.25);assert.equal(late.clock.snapshot().name,'夜半の刻');
 const first=late.until('toll'),second=late.until('toll');assert.deepEqual([first.tolls,first.phase,first.wake],[1,2,2]);assert.deepEqual([second.tolls,second.phase,second.wake],[2,2,Infinity]);
});
test('tolls stay at least 67 s apart however fast the bar fills',()=>{
 const h=harness();h.run(1000,()=>{h.clock.pickup('red');return {};});
 const tolls=at(h.log,'toll');assert.ok(tolls.length>=10);assert.equal(tolls[0],37);
 for(let i=1;i<tolls.length;i++)assert.ok(tolls[i]-tolls[i-1]>=67&&tolls[i]-tolls[i-1]<=67.5,`gap ${tolls[i]-tolls[i-1]}`);
 assert.equal(at(h.log,'warning').length,tolls.length);
});
test('a chase during the 35 s hunt forfeits the survival reward; one before it does not',()=>{
 const clean=harness();clean.until('toll');assert.equal(clean.clock.state,'hunt');const t0=clean.t;
 const end=clean.until('hunt-end');assert.equal(end.survived,true);assert.equal(clean.t-t0,35);assert.equal(clean.clock.state,'lull');assert.equal(clean.clock.left,20);
 clean.until('lull-end');assert.equal(clean.t-t0,55);assert.equal(clean.clock.state,'calm');assert.equal(clean.clock.origin,null);
 const noted=harness();noted.until('toll');noted.run(20);noted.clock.noteChase();assert.equal(noted.until('hunt-end').survived,false);
 const early=harness();early.until('warning');early.clock.noteChase();early.until('toll');assert.equal(early.until('hunt-end').survived,true,'a chase before the toll does not count');
 const chased=harness();chased.until('toll');chased.run(10);chased.step({chasing:true});assert.equal(chased.until('hunt-end').survived,false,'a chase still running in the window counts');
 const caught=harness();caught.until('toll');caught.run(5);caught.clock.captured();assert.equal(caught.until('hunt-end').survived,false);
 const lull=harness();lull.until('hunt-end');lull.clock.noteChase();assert.equal(lull.clock.huntBroken,false);lull.until('toll');assert.equal(lull.until('hunt-end').survived,true);
});
test('an offering that clears the warning line silences the pending bell; phase never reverts',()=>{
 const h=harness();h.until('warning');h.run(5);assert.ok(h.clock.purify({blue:1,red:0})>0);
 assert.equal(h.clock.state,'calm');assert.equal(h.clock.origin,null);assert.ok(h.clock.fraction<.92);
 const next=h.until('warning');assert.equal(next.first,false);assert.deepEqual(h.log.map(l=>l.event.kind),['warning','warning']);
 const faint=harness({...nightConfig('normal'),purify:{blue:.01,red:.4}});faint.until('warning');faint.clock.pickup('red');faint.clock.purify({blue:1,red:0});assert.equal(faint.clock.state,'warning');faint.until('toll');
 const deep=harness();deep.until('toll');deep.until('toll');deep.run(10);deep.clock.pickup('red');deep.clock.purify({blue:0,red:3});
 assert.equal(deep.clock.fraction,0);assert.equal(deep.clock.phase,2);assert.equal(deep.clock.state,'hunt');assert.equal(deep.clock.tolls,2);
});
test('snapshot and revision follow every visible change',()=>{
 const h=harness();assert.deepEqual(h.clock.snapshot(),{phase:0,name:'宵の刻',fraction:0,state:'calm',left:0,tolls:0,revision:0});
 h.step();assert.equal(h.clock.revision,0,'plain burning does not bump the revision');
 h.clock.pickup('blue');assert.equal(h.clock.revision,1);
 h.until('warning');const warned=h.clock.snapshot();assert.ok(warned.left>11.5&&warned.left<=12);assert.deepEqual({...warned,fraction:0,left:0},{phase:0,name:'宵の刻',fraction:0,state:'warning',left:0,tolls:0,revision:2});
 let rev=h.clock.revision;for(const kind of ['toll','hunt-end','lull-end'] as const){h.until(kind);assert.equal(h.clock.revision,++rev,kind);}
 h.clock.captured();assert.equal(h.clock.revision,++rev);h.clock.stop();assert.equal(h.clock.revision,++rev);
 const snap=h.clock.snapshot();assert.deepEqual([snap.phase,snap.name,snap.tolls,snap.state],[1,'夜半の刻',1,'calm']);
});
test('the clock is deterministic for the same input script and frame-rate independent',()=>{
 const play=(seed:number,dt:number)=>{const random=seededRandom(seed),h=harness(nightConfig('hard'),dt);
  h.run(900,()=>{const r=random();if(r<.004)h.clock.pickup(r<.002?'red':'blue');if(r>.999)h.clock.purify({blue:1,red:0});return {chasing:random()<.002,player:{x:Math.floor(h.t),z:-Math.floor(h.t)}};});
  return {log:h.log,snap:h.clock.snapshot()};};
 assert.deepEqual(play(11,.05),play(11,.05));assert.notDeepEqual(play(11,.05).log,play(12,.05).log);
 const smooth=harness(nightConfig('nightmare'),1/60),coarse=harness(nightConfig('nightmare'),.5);smooth.run(600);coarse.run(600);
 const a=smooth.log.map(l=>[l.event.kind,l.t]),b=coarse.log.map(l=>[l.event.kind,l.t]);assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){assert.equal(a[i][0],b[i][0]);assert.ok(Math.abs((a[i][1] as number)-(b[i][1] as number))<=.5+1e-6,`${a[i][0]} ${a[i][1]} vs ${b[i][1]}`);}
});
const ROSTER=(kinds?:readonly string[])=>Array.from({length:12},(_,id)=>({id,homeFloor:id===3||id===10?4.8:id===7||id===11?9.6:0,kind:kinds?.length?kinds[id%kinds.length]:id>=8?['mire','warden','fox','pilgrim'][id-8]:id===4?'danger':['normal','listener','watcher','stalker'][id%4]}));
const awakeEverywhere=(actors:ReturnType<typeof ROSTER>,chosen:number[])=>[0,4.8,9.6].every(f=>actors.some(a=>a.homeFloor===f&&!chosen.includes(a.id)));
test('chooseSleepers: per-mode counts, never the gold guardian or a finale kind, someone awake on every storey',()=>{
 const actors=ROSTER(),guardian=4,sets=new Set<string>();
 for(let seed=1;seed<=40;seed++)for(const [count,label] of [[5,'normal'],[4,'hard'],[3,'nightmare'],[6,'新月'],[2,'悪夢 丑の刻参り']] as const){
  const chosen=chooseSleepers(actors,guardian,count,seededRandom(seed^0x51ee9));
  assert.equal(chosen.length,count,`${label} seed ${seed}`);assert.equal(new Set(chosen).size,count);assert.ok(!chosen.includes(guardian));
  assert.ok(chosen.every(id=>actors.some(a=>a.id===id)));assert.ok(awakeEverywhere(actors,chosen),`${label} seed ${seed}: a storey fell asleep`);
  if(count===5)sets.add([...chosen].sort((a,b)=>a-b).join());
 }
 assert.ok(sets.size>=20,'different seeds choose different sleepers');
 for(let seed=1;seed<=40;seed++){const all=chooseSleepers(actors,guardian,12,seededRandom(seed));assert.equal(all.length,9);assert.ok(awakeEverywhere(actors,all));}
 const finale=ROSTER(['normal','hatred','wrath']);for(let seed=1;seed<=40;seed++)assert.ok(chooseSleepers(finale,0,12,seededRandom(seed)).every(id=>finale[id].kind==='normal'));
 for(let seed=1;seed<=40;seed++){const upper=chooseSleepers(actors,3,12,seededRandom(seed));assert.ok(upper.includes(10),'the guardian keeps its storey awake');assert.ok(!upper.includes(3));}
 const hotel=ROSTER(['hotelStaff','hotelGuest']),stay=chooseSleepers(hotel,0,5,seededRandom(7));assert.equal(stay.length,5);assert.ok(awakeEverywhere(hotel,stay));
 for(const count of [0,-2,NaN])assert.deepEqual(chooseSleepers(actors,guardian,count,seededRandom(1)),[]);
 assert.deepEqual(chooseSleepers([{id:0,homeFloor:0,kind:'normal'}],-1,3,seededRandom(1)),[]);
});
test('chooseSleepers is deterministic per seed and an extra sleeper never reshuffles the others',()=>{
 const actors=ROSTER();
 for(let seed=1;seed<=40;seed++){
  assert.deepEqual(chooseSleepers(actors,4,5,seededRandom(seed^0x51ee9)),chooseSleepers(actors,4,5,seededRandom(seed^0x51ee9)));
  const draws=(count:number)=>{let n=0;const random=seededRandom(seed);chooseSleepers(actors,4,count,()=>{n++;return random();});return n;};
  assert.equal(draws(3),draws(6));
  const five=chooseSleepers(actors,4,5,seededRandom(seed)),six=chooseSleepers(actors,4,6,seededRandom(seed)),four=chooseSleepers(actors,4,4,seededRandom(seed));
  assert.deepEqual(six.slice(0,5),five);assert.deepEqual(five.slice(0,4),four);
 }
});
