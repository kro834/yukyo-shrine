import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRun,sanitizeRecords,applyClear,stageSummary,recordKey,type RunSummary} from '../app/records.ts';
const run=(patch:Partial<RunSummary>):RunSummary=>({stage:'shrine',mode:'normal',elapsed:540,deaths:0,escapes:3,notes:3,notesTotal:3,...patch});
test('a fast deathless clear with every note earns S, while captures and long searches lower the rank',()=>{
 assert.equal(scoreRun(run({})).rank,'S');
 assert.equal(scoreRun(run({elapsed:900,escapes:2,notes:1})).rank,'A');
 assert.equal(scoreRun(run({elapsed:1200,deaths:1,escapes:1,notes:0})).rank,'C');
 assert.equal(scoreRun(run({elapsed:1800,deaths:2,escapes:0,notes:0})).rank,'D');
 const lines=scoreRun(run({deaths:2})).lines;assert.equal(lines[1].points,-1200);assert.equal(lines[0].detail,'09:00');
 assert.equal(scoreRun(run({elapsed:99999,deaths:40,escapes:0,notes:0})).score,0,'the score never becomes negative');
});
test('harder modes multiply the same performance; gallery walks are unranked',()=>{
 const normal=scoreRun(run({elapsed:900,escapes:2,notes:1})),hard=scoreRun(run({mode:'hard',elapsed:900,escapes:2,notes:1})),nightmare=scoreRun(run({mode:'nightmare',elapsed:900,escapes:2,notes:1}));
 assert.ok(normal.score<hard.score&&hard.score<nightmare.score);assert.equal(nightmare.rank,'S');
 assert.deepEqual(scoreRun(run({mode:'gallery'})),{score:0,rank:null,multiplier:0,lines:[]});
 assert.equal(scoreRun(run({escapes:50})).lines[2].points,1200,'escape points are capped');
});
test('records keep the fastest time, the best score and count every clear',()=>{
 let records=sanitizeRecords(null);const first=run({elapsed:900,escapes:2,notes:1}),r1=scoreRun(first);
 const a=applyClear(records,first,r1);records=a.records;assert.equal(a.first,true);assert.equal(a.newTime,false);
 assert.deepEqual(records[recordKey('shrine','normal')],{clears:1,bestTime:900,bestScore:r1.score,bestRank:'A',fewestDeaths:0});
 const slow=run({elapsed:1500,deaths:1,notes:0}),b=applyClear(records,slow,scoreRun(slow));records=b.records;
 assert.equal(b.newTime,false);assert.equal(b.newScore,false);assert.deepEqual(records[recordKey('shrine','normal')],{clears:2,bestTime:900,bestScore:r1.score,bestRank:'A',fewestDeaths:0});
 const fast=run({}),c=applyClear(records,fast,scoreRun(fast));records=c.records;
 assert.equal(c.newTime,true);assert.equal(c.newScore,true);assert.equal(records[recordKey('shrine','normal')].bestRank,'S');
 records=applyClear(records,run({stage:'abyss',mode:'gallery',elapsed:300}),scoreRun(run({mode:'gallery'}))).records;
 assert.deepEqual(stageSummary(records,'shrine'),{rank:'S',clears:3});assert.deepEqual(stageSummary(records,'abyss'),{rank:null,clears:1});assert.deepEqual(stageSummary(records,'outer'),{rank:null,clears:0});
});
test('stored records drop unknown stages, modes and corrupt values',()=>{
 const clean=sanitizeRecords({'shrine:normal':{clears:2,bestTime:-5,bestScore:'x',bestRank:'Z',fewestDeaths:1.7},'moon:normal':{clears:1},'abyss:easy':{clears:1},'outer:hard':{clears:0},'error:nightmare':{clears:1,bestTime:600,bestScore:7000,bestRank:'S',fewestDeaths:0}});
 assert.deepEqual(clean,{'shrine:normal':{clears:2,bestTime:null,bestScore:null,bestRank:null,fewestDeaths:1},'error:nightmare':{clears:1,bestTime:600,bestScore:7000,bestRank:'S',fewestDeaths:0}});
 assert.deepEqual(sanitizeRecords([1,2]),{});assert.deepEqual(sanitizeRecords('x'),{});
});
test('the objective advances from collecting to offering to the gate, naming the final pursuer',async()=>{
 const {objective,routePips}=await import('../app/objective.ts');
 const base={blue:0,red:0,gold:0,blueOffered:0,redOffered:0,unlocked:false,finale:null};
 assert.equal(objective('gallery',base).step,'explore');assert.equal(objective('normal',base).step,'collect');
 assert.equal(objective('hard',{...base,blue:4,blueOffered:2}).step,'offer');assert.equal(objective('normal',{...base,red:2,finale:'wrath'}).detail,'憤怒から逃れながら祭壇へ');
 assert.equal(objective('nightmare',{...base,unlocked:true,finale:'hatred'}).title,'封門をくぐる');assert.match(objective('normal',{...base,unlocked:true,finale:'hatred'}).detail,/憎悪/);
 assert.deepEqual(routePips(3,2,6),['offered','offered','held','held','held','empty']);assert.deepEqual(routePips(9,0,2),['held','held']);assert.deepEqual(routePips(1,5,2),['offered','offered']);
});
test('without the new fields the score keeps exactly the four original lines',()=>{
 for(const patch of [{},{deaths:2},{elapsed:1800,escapes:0,notes:0},{hunts:0,surplus:{blue:0,red:0}}])assert.deepEqual(scoreRun(run(patch)).lines.map(l=>l.label),['探索時間',(patch as Partial<RunSummary>).deaths?'復活':'無傷踏破','追跡回避','手記']);
 assert.equal(scoreRun(run({})).score,6350);assert.equal(scoreRun(run({})).omenMultiplier,undefined);
});
test('surviving tolls, sealing the gate early and surplus beads append lines after the original four',()=>{
 const r=scoreRun(run({hunts:3,clearPhase:1,surplus:{blue:2,red:1}}));
 assert.deepEqual(r.lines.slice(4),[{label:'鐘を凌いだ',detail:'3回',points:450},{label:'刻',detail:'夜半の刻に封門',points:250},{label:'余剰奉納',detail:'青2・赤1',points:900}]);
 assert.equal(r.score,6350+450+250+900);
 assert.deepEqual(scoreRun(run({hunts:9})).lines[4],{label:'鐘を凌いだ',detail:'9回',points:750},'toll survival is capped at five');
 assert.deepEqual([0,1,2].map(p=>scoreRun(run({clearPhase:p as 0|1|2})).lines[4]),[{label:'刻',detail:'宵の刻に封門',points:600},{label:'刻',detail:'夜半の刻に封門',points:250},{label:'刻',detail:'丑三つ時に封門',points:0}]);
 assert.deepEqual(scoreRun(run({surplus:{blue:0,red:3}})).lines[4],{label:'余剰奉納',detail:'青0・赤3',points:1200},'surplus is capped at 1200');
 assert.equal(scoreRun(run({surplus:{blue:6,red:0}})).lines[4].points,1200);assert.equal(scoreRun(run({surplus:{blue:1,red:0}})).lines[4].points,200);
 assert.deepEqual(scoreRun(run({clearPhase:2,surplus:{blue:1,red:0}})).lines.slice(4).map(l=>l.label),['刻','余剰奉納'],'only defined fields append, in order');
 for(const bad of [{hunts:-2},{hunts:NaN},{surplus:{blue:-1,red:-4}},{surplus:{blue:NaN,red:0}}])assert.equal(scoreRun(run(bad as Partial<RunSummary>)).lines.length,4);
 assert.equal(scoreRun(run({hunts:2.9})).lines[4].detail,'2回');
});
test('mode and omen multipliers apply to the whole sum; the clear screen gets the omen factor',()=>{
 const extra={hunts:2,clearPhase:0 as const,surplus:{blue:1,red:1}},sum=6350+300+600+700;
 assert.equal(scoreRun(run(extra)).score,sum);assert.equal(scoreRun(run({...extra,mode:'hard'})).score,Math.round(sum*1.2));assert.equal(scoreRun(run({...extra,mode:'nightmare'})).score,Math.round(sum*1.5));
 const surplusOnly=scoreRun(run({mode:'hard',surplus:{blue:0,red:3}})).score-scoreRun(run({mode:'hard'})).score;assert.equal(surplusOnly,1440,'the capped surplus is multiplied by the mode');
 const omen=scoreRun(run({...extra,mode:'hard',omen:{ids:['newmoon'],multiplier:1.1}}));
 assert.equal(omen.score,Math.round(sum*1.2*1.1));assert.equal(omen.multiplier,1.2);assert.equal(omen.omenMultiplier,1.1);
 const calm=scoreRun(run({omen:{ids:['calm'],multiplier:1}}));assert.equal(calm.score,6350);assert.equal(calm.omenMultiplier,1);
 assert.equal(scoreRun(run({omen:{ids:[],multiplier:NaN}})).score,6350,'a corrupt multiplier is neutral');
 assert.deepEqual(scoreRun(run({mode:'gallery',...extra,omen:{ids:['newmoon'],multiplier:1.1}})),{score:0,rank:null,multiplier:0,lines:[]});
});
test('the rank reflects the bonuses, so risk is what lifts a clean run to S',()=>{
 const clean=run({escapes:1,notes:1});assert.equal(scoreRun(clean).score,5450);assert.equal(scoreRun(clean).rank,'A');
 assert.equal(scoreRun({...clean,clearPhase:0}).rank,'S');assert.equal(scoreRun({...clean,hunts:4}).rank,'S');assert.equal(scoreRun({...clean,surplus:{blue:3,red:0}}).rank,'S');
 assert.equal(scoreRun({...clean,clearPhase:2}).rank,'A','丑三つ earns nothing');assert.equal(scoreRun({...clean,omen:{ids:['newmoon'],multiplier:1.1}}).score,5995);assert.equal(scoreRun({...clean,omen:{ids:['ushimitsu'],multiplier:1.2}}).rank,'S');
 let records=sanitizeRecords(null);const best=scoreRun({...clean,clearPhase:0});records=applyClear(records,{...clean,clearPhase:0},best).records;
 assert.deepEqual(records[recordKey('shrine','normal')],{clears:1,bestTime:540,bestScore:best.score,bestRank:'S',fewestDeaths:0},'the stored record shape is unchanged');
});
test('run progress counts survived tolls and shows a faint 気配 state below a search',async()=>{
 const {RunProgress,threatTarget}=await import('../app/run-progress.ts');
 const quiet={chasing:false,searching:false,hidden:false,frozen:false,burden:0,distance:5};
 const p=new RunProgress();assert.equal(p.snapshot().hunts,0);p.hunts+=2;p.defeated();assert.equal(p.snapshot().hunts,2,'captures do not erase survived tolls');
 assert.equal(threatTarget(quiet),0);assert.equal(threatTarget({...quiet,noticed:0}),0);
 assert.ok(Math.abs(threatTarget({...quiet,noticed:.5})-.14)<1e-12);assert.ok(Math.abs(threatTarget({...quiet,noticed:1})-.28)<1e-12);
 assert.equal(threatTarget({...quiet,noticed:7}),.28);for(const bad of [NaN,-1,Infinity])assert.equal(threatTarget({...quiet,noticed:bad}),0);
 assert.equal(threatTarget({...quiet,hidden:true,noticed:1}),.28,'darkness does not hide a foe that already senses the visitor');
 for(const patch of [{frozen:true},{stunned:true}])assert.equal(threatTarget({...quiet,...patch,noticed:1}),0);
 assert.equal(threatTarget({...quiet,searching:true,noticed:1}),threatTarget({...quiet,searching:true}),'a search or chase ignores the gauge');
 assert.equal(threatTarget({...quiet,chasing:true,noticed:1}),threatTarget({...quiet,chasing:true}));
 const state=(patch:object)=>{const r=new RunProgress();r.step(.05,{...quiet,...patch});return r.state;};
 assert.equal(state({noticed:.4}),'noticed');assert.equal(state({noticed:.4,hidden:true}),'noticed');assert.equal(state({hidden:true}),'hidden');assert.equal(state({}),'quiet');assert.equal(state({noticed:0,hidden:true}),'hidden');
 assert.equal(state({noticed:.4,searching:true}),'search');assert.equal(state({noticed:.4,chasing:true}),'chase');assert.equal(state({noticed:.4,frozen:true}),'frozen');assert.equal(state({noticed:.4,stunned:true}),'stunned');
 const fill=new RunProgress();for(let i=0;i<120;i++)fill.step(1/60,{...quiet,noticed:1});assert.ok(fill.pressure>.2&&fill.pressure<=.28);
 fill.step(.05,quiet);assert.equal(fill.pressure,0,'a gauge that empties clears the bar at once');assert.equal(fill.escapes,0,'being noticed is not a chase to escape');
});
