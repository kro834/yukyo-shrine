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
