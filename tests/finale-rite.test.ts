import test from 'node:test';
import assert from 'node:assert/strict';
import {ShrineGoal,RITE_SECONDS,RITE_RADIUS} from '../app/shrine-goal.ts';
import {FINALE_BALANCE,finaleDistance,finalePeakSpeed,finalePhase,finaleSpeed,ringScale,type FinaleKind} from '../app/enemy-traits.ts';
import {SPRINT_SPEED,type Position} from '../app/movement.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {objective} from '../app/objective.ts';
import {scoreRun} from '../app/records.ts';
const KINDS=['hatred','wrath'] as const;
const steps=(g:ShrineGoal,n:number,p:Position,floor=0,live=.05)=>{for(let i=0;i<n;i++)g.update(.05,p,floor,live);};
const rited=()=>{const g=new ShrineGoal();g.riteSeconds=RITE_SECONDS;g.offer({blue:0,red:2});return g;};
const inRing=(g:ShrineGoal)=>({x:g.altar.x+3,z:g.altar.z-2});
const gate={x:0,z:16.8};

test('the rite constants match the balance table',()=>{
 assert.equal(RITE_SECONDS,8);assert.equal(RITE_RADIUS,7);
});

test('the ring keeps both pursuers below a sprinting visitor at every difficulty',()=>{
 assert.ok(Math.abs(finalePeakSpeed('hatred',1.2)-13.68)<1e-9);assert.ok(Math.abs(finalePeakSpeed('wrath',1.2)-19.44)<1e-9);
 assert.equal(finalePeakSpeed('hatred',.1),finalePeakSpeed('hatred',.85),'difficulty is clamped like finaleSpeed');assert.equal(finalePeakSpeed('wrath',9),finalePeakSpeed('wrath',1.2));
 assert.equal(ringScale('hatred',.85),.6);assert.equal(ringScale('hatred',1.2),.6);
 assert.ok(Math.abs(ringScale('wrath',1.2)-.97*9.2/19.44)<1e-12);assert.ok(Math.abs(finalePeakSpeed('wrath',1.2)*ringScale('wrath',1.2)-8.924)<1e-9);
 assert.ok(Math.abs(finalePeakSpeed('hatred',1.2)*ringScale('hatred',1.2)-8.208)<1e-9);
 for(const kind of KINDS)for(const d of [.5,.85,1,1.1,1.2,3]){
  const scale=ringScale(kind,d);
  assert.ok(scale>0&&scale<=.6,kind+' '+d);
  assert.ok(finalePeakSpeed(kind,d)*scale<SPRINT_SPEED,kind+' '+d+' peak in ring');
  assert.ok(finalePeakSpeed(kind,d)*scale<=.97*SPRINT_SPEED+1e-9,'a sprinting visitor always keeps a margin');
  for(let t=0;t<40;t+=.137)assert.ok(finaleSpeed(kind,t,d)<=finalePeakSpeed(kind,d)+1e-9,'the peak bounds every phase');
  // Integrated per frame, as the boss actually moves, at uneven frame times.
  for(const dt of [.05,1/60,.0331])for(let t=0;t<2*3.65+20;t+=dt)assert.ok(finaleDistance(kind,t,dt,d)*scale<SPRINT_SPEED*dt,kind+' '+d+' t='+t.toFixed(2));
 }
 assert.ok(FINALE_BALANCE.wrath.rushSpeed>SPRINT_SPEED,'outside the ring the rush still outruns the visitor');
});

test('a rushing wrath inside the ring covers less than a sprint per frame and full speed once outside',()=>{
 const cells=Array.from({length:49*49},(_,i)=>({x:i%49-24,z:Math.floor(i/49)-24,h:4,kind:'hall' as const}));
 for(const difficulty of [.85,1.2]){
  const enemies=new Enemies(cells,[]);enemies.difficulty={...enemies.difficulty,speed:difficulty};
  const kind:FinaleKind='wrath';assert.equal(enemies.beginFinale({x:80,z:0},0,()=>.99),kind);
  const boss=enemies.actors[0];boss.position={x:0,z:0};boss.floor=0;boss.planIn=0;
  enemies.ring={center:{x:0,z:0},radius:RITE_RADIUS,scale:ringScale(kind,difficulty)};
  let inside=0,outside=0;
  for(let t=0;t<2;t+=.05){
   const before={...boss.position},rush=finalePhase(kind,boss.traitTime)==='rush'&&finalePhase(kind,boss.traitTime+.05)==='rush',within=Math.hypot(before.x,before.z)<RITE_RADIUS;
   enemies.update(.05,{x:80,z:0},[],0,[],false,[],false);
   const moved=Math.hypot(boss.position.x-before.x,boss.position.z-before.z);
   if(within)assert.ok(moved<SPRINT_SPEED*.05,difficulty+' frame '+t.toFixed(2)+' moved '+moved);
   if(rush&&within)inside++;
   if(rush&&!within){outside++;assert.ok(moved>SPRINT_SPEED*.05,'the ring, not the rush, is what slows it');}
  }
  assert.ok(inside>=5&&outside>=3,inside+' '+outside);
 }
});

test('without a rite the gate opens on the offering exactly as before',()=>{
 const g=new ShrineGoal();assert.equal(g.riteSeconds,0);assert.equal(g.rite,0);assert.equal(g.riteActive,false);
 g.offer({blue:0,red:2});assert.equal(g.riteActive,false);
 steps(g,30,inRing(g));assert.ok(g.progress>=.98);assert.equal(g.blockers().length,0);assert.equal(g.rite,0);
 g.update(.05,gate,0);assert.equal(g.completed,true);
});

test('the rite needs eight live seconds in the altar ring before the gate starts to open',()=>{
 const g=new ShrineGoal();g.riteSeconds=RITE_SECONDS;
 assert.equal(g.riteActive,false,'no rite before the unlocking offering');steps(g,20,inRing(g));assert.equal(g.rite,0);
 g.offer({blue:0,red:2});assert.equal(g.riteActive,true);
 steps(g,100,inRing(g));g.update(.05,gate,0);assert.equal(g.completed,false,'standing in the gate cannot skip the rite');assert.ok(Math.abs(g.rite-5.05)<1e-9,'the gate lies inside the ring');
 steps(g,58,inRing(g));assert.ok(g.rite>7.9&&g.rite<RITE_SECONDS);assert.equal(g.progress,0);assert.equal(g.riteActive,true);assert.equal(g.blockers().length,1);
 steps(g,1,inRing(g));assert.equal(g.rite,RITE_SECONDS,'accumulation snaps to the end');assert.equal(g.riteActive,false);assert.equal(g.progress,0);
 steps(g,22,inRing(g));assert.ok(g.progress>=.98&&g.progress<1);assert.equal(g.blockers().length,0,'~1.1 s of the existing opening follows');
 g.update(.05,gate,0);assert.equal(g.completed,true);
});

test('leaving the ring, climbing a floor or stopping time pauses the rite without decay',()=>{
 const g=rited(),far={x:g.altar.x+RITE_RADIUS+.1,z:g.altar.z};
 steps(g,40,inRing(g));const held=g.rite;assert.ok(Math.abs(held-2)<1e-9);
 steps(g,100,far);assert.equal(g.rite,held,'outside 7 m');
 steps(g,20,{x:g.altar.x+RITE_RADIUS-.1,z:g.altar.z});assert.ok(Math.abs(g.rite-3)<1e-9,'just inside 7 m resumes where it left off');
 const resumed=g.rite;steps(g,100,inRing(g),4.8);assert.equal(g.rite,resumed,'an upper floor above the altar does not count');
 steps(g,20,inRing(g),.39);assert.ok(Math.abs(g.rite-4)<1e-9,'floor tolerance matches the gate');
 const paused=g.rite;steps(g,100,inRing(g),0,0);assert.equal(g.rite,paused,'time stop passes riteLive 0');
 for(const live of [NaN,-1,Infinity])g.update(.05,inRing(g),0,live);assert.equal(g.rite,paused,'invalid live time cannot advance the rite');
 g.update(1,inRing(g),0,1);assert.ok(Math.abs(g.rite-paused-.05)<1e-9,'a long frame is clipped like the gate progress');
 assert.equal(g.progress,0);
});

test('the rite follows a shifted altar and resets with the goal',()=>{
 const g=new ShrineGoal({x:42,z:100});g.riteSeconds=RITE_SECONDS;g.offer({blue:0,red:0,gold:1});
 steps(g,20,{x:0,z:0});assert.equal(g.rite,0,'the unshifted altar is far away');
 steps(g,20,{x:g.altar.x,z:g.altar.z-1});assert.ok(g.rite>.9);
 g.offerSurplus({blue:1,red:0});g.reset();assert.equal(g.rite,0);assert.deepEqual(g.surplus,{blue:0,red:0});assert.equal(g.unlocked,false);assert.equal(g.riteActive,false);
});

test('a capture that clears the finale cannot skip a demanded rite, nor add one to an opening gate',()=>{
 const g=rited();steps(g,20,inRing(g));
 g.riteSeconds=0;assert.equal(g.riteSeconds,RITE_SECONDS,'the demand is fixed by the unlocking offering');assert.equal(g.riteActive,true);
 steps(g,200,{x:g.altar.x,z:g.altar.z-30});assert.equal(g.progress,0);assert.equal(g.completed,false);assert.equal(g.blockers().length,1);
 steps(g,45,gate);assert.equal(g.completed,false);steps(g,155,gate);assert.equal(g.completed,true,'waiting at the gate, inside the ring, finishes the rite and then opens it');
 const done=rited();steps(done,161,inRing(done));assert.equal(done.riteActive,false);done.riteSeconds=0;done.riteSeconds=RITE_SECONDS;assert.equal(done.riteActive,false,'a finished rite is never demanded again');
 const open=new ShrineGoal();open.offer({blue:0,red:2});open.update(.05,inRing(open),0);open.riteSeconds=RITE_SECONDS;
 assert.equal(open.riteSeconds,0);assert.equal(open.riteActive,false);steps(open,30,inRing(open));assert.ok(open.progress>=.98);
 const fresh=new ShrineGoal();fresh.riteSeconds=8;fresh.riteSeconds=0;fresh.riteSeconds=-3;assert.equal(fresh.riteSeconds,0);fresh.riteSeconds=NaN;assert.equal(fresh.riteSeconds,0);
 fresh.offer({blue:0,red:2});fresh.riteSeconds=RITE_SECONDS;assert.equal(fresh.riteActive,true,'the same frame as the offering may still demand the rite');
});

test('surplus beads are accepted only after the unlock and become score',()=>{
 const g=new ShrineGoal();
 assert.deepEqual(g.offerSurplus({blue:3,red:1,gold:1}),{blue:0,red:0,gold:0});assert.deepEqual(g.surplus,{blue:0,red:0});
 g.offer({blue:0,red:2});assert.equal(g.unlocked,true);
 assert.deepEqual(g.offer({blue:2,red:1}),{blue:0,red:0,gold:0},'offer() is unchanged after the unlock');
 assert.deepEqual(g.offerSurplus({blue:2,red:1}),{blue:2,red:1,gold:0});assert.deepEqual(g.surplus,{blue:2,red:1});
 assert.deepEqual(g.offerSurplus({blue:0,red:0,gold:1}),{blue:0,red:0,gold:1});assert.deepEqual(g.surplus,{blue:2,red:2},'gold counts as red');
 assert.deepEqual(g.offerSurplus({blue:0,red:0}),{blue:0,red:0,gold:0},'an empty bag offers nothing');
 assert.deepEqual(g.offerSurplus({blue:-2,red:-1,gold:-1}),{blue:0,red:0,gold:0});assert.deepEqual(g.surplus,{blue:2,red:2});
 const r=rited();steps(r,20,inRing(r));assert.deepEqual(r.offerSurplus({blue:1,red:0}),{blue:1,red:0,gold:0},'surplus is accepted during the rite');assert.equal(r.riteActive,true);
 const lines=scoreRun({stage:'shrine',mode:'normal',elapsed:540,deaths:0,escapes:0,notes:0,notesTotal:3,surplus:{...g.surplus}}).lines;
 assert.deepEqual(lines.at(-1),{label:'余剰奉納',detail:'青2・赤2',points:1200});
});

test('the objective names the omen and the rite before the gate, and points surplus beads at the altar',()=>{
 const base={blue:0,red:0,gold:0,blueOffered:0,redOffered:0,unlocked:false,finale:'hatred' as const};
 assert.deepEqual(objective('normal',{...base,red:2,omen:true}),{step:'offer',title:'何かが来る — 祭壇へ向かえ',detail:'鐘が三つ鳴る前に、祭壇への道を思い出せ'});
 assert.equal(objective('hard',{...base,unlocked:true,omen:true}).step,'gate','a re-armed omen after the unlock still leads to the gate');
 assert.equal(objective('gallery',{...base,omen:true}).step,'explore');
 const rite=(r:{progress:number;remaining?:number},patch={})=>objective('normal',{...base,unlocked:true,rite:r,...patch});
 assert.deepEqual(rite({progress:0,remaining:8}),{step:'gate',title:'封門の儀 · 祭壇の輪の中で耐えよ',detail:'憎悪が輪の中では遅くなる · 8秒'});
 assert.equal(rite({progress:.6,remaining:3.2}).detail,'憎悪が輪の中では遅くなる · 4秒');
 assert.equal(rite({progress:.625,remaining:3.0000000001}).detail,'憎悪が輪の中では遅くなる · 3秒','float noise does not add a second');
 assert.equal(rite({progress:.5}).detail,'憎悪が輪の中では遅くなる · 4秒','remaining defaults from progress');
 assert.equal(rite({progress:0,remaining:8},{finale:'wrath'}).detail,'憤怒が輪の中では遅くなる · 8秒');
 assert.equal(rite({progress:0,remaining:8},{blue:1}).detail,'憎悪が輪の中では遅くなる · 8秒 · 余った勾玉は祭壇で点になる');
 assert.equal(objective('normal',{...base,unlocked:true,omen:true,rite:{progress:.5,remaining:4}}).title,'何かが来る — 祭壇へ向かえ','the omen outranks the rite');
 assert.deepEqual(objective('normal',{...base,unlocked:true,rite:null}),{step:'gate',title:'封門をくぐる',detail:'憎悪を振り切り、祭壇の奥の扉へ'});
 assert.equal(objective('normal',{...base,unlocked:true,red:1}).detail,'憎悪を振り切り、祭壇の奥の扉へ · 余った勾玉は祭壇で点になる');
 assert.equal(objective('normal',{...base,unlocked:true,finale:null,gold:1}).detail,'祭壇の奥の扉が開いています · 余った勾玉は祭壇で点になる');
 assert.equal(objective('normal',{...base,blue:7,omen:false,rite:null}).detail,'憎悪から逃れながら祭壇へ','no surplus hint before the unlock');
});
