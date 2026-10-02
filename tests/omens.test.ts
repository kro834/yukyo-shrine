import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {OMENS,NEUTRAL_OMEN,chooseOmens,omenParams,omenMultiplier,sanitizeOmens,type OmenId,type OmenParams} from '../app/run-omens.ts';
import {nightConfig} from '../app/night-clock.ts';
import {recordKey,stageSummary,applyClear,scoreRun,type Records,type RunSummary} from '../app/records.ts';
import {stageRules} from '../app/stage-profile.ts';
import {Enemies} from '../app/shrine-gameplay.ts';
import {createWorld} from '../app/shrine-world.ts';
import type {PlayMode} from '../app/play-mode.ts';
const near=(a:number,b:number,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} ≉ ${b}`);
const IDS=Object.keys(OMENS) as OmenId[],REAL=IDS.filter(id=>id!=='calm'),RANKED=['normal','hard','nightmare'] as const,SEEDS=6000;
const draws=(mode:PlayMode,unlocked:boolean,seeds=SEEDS)=>{const counts=new Map<string,number>();for(let seed=0;seed<seeds;seed++){const k=chooseOmens(seed,mode,false,unlocked).join('+');counts.set(k,(counts.get(k)??0)+1);}return counts;};
/** Every set a later night can bear, per mode and lock state. */
const drawable=(mode:PlayMode,unlocked:boolean)=>[...draws(mode,unlocked,800).keys()].map(k=>k.split('+') as OmenId[]);

test('omen table: names, lines, multipliers, conflicts and the lock match the spec',()=>{
 assert.deepEqual(IDS,['calm','newmoon','silence','longnight','rain','ushimitsu']);
 const rows=Object.fromEntries(IDS.map(id=>[id,[OMENS[id].id,OMENS[id].name,OMENS[id].line,OMENS[id].multiplier,OMENS[id].locked]]));
 assert.deepEqual(rows,{
  calm:['calm','平穏','静かな夜',1,false],
  newmoon:['newmoon','新月','眠る影がひとつ多く、霧が深い',1.1,false],
  silence:['silence','静寂','影の耳が冴え、鐘は遠い',1.1,false],
  longnight:['longnight','長夜','鐘は遠いが、鳴れば多くが集まる',1.1,false],
  rain:['rain','雨夜','足音は雨に紛れ、鐘は近い',1.05,false],
  ushimitsu:['ushimitsu','丑の刻参り','夜はすでに深い',1.2,true],
 });
 assert.deepEqual(OMENS.calm.params,{});
 assert.deepEqual(OMENS.newmoon.params,{extraSleepers:1,fogScale:1.25,sense:.9});
 assert.deepEqual(OMENS.silence.params,{hearing:1.3,tollScale:1.25,startBell:1});
 assert.deepEqual(OMENS.longnight.params,{tollScale:1.4,extraHunters:1});
 assert.deepEqual(OMENS.rain.params,{runHearing:.6,tollScale:.8});
 assert.deepEqual(OMENS.ushimitsu.params,{startTolls:1,extraSleepers:-1});
 for(const id of IDS)for(const other of OMENS[id].conflicts){assert.ok(OMENS[other].conflicts.includes(id),`${id} ✕ ${other} is symmetric`);assert.notEqual(other,id);}
 assert.deepEqual(IDS.flatMap(id=>OMENS[id].conflicts.map(o=>id+'✕'+o)),['silence✕rain','rain✕silence']);
 for(const id of IDS){assert.ok(OMENS[id].line.length>0&&!/[「」]/.test(OMENS[id].line),'lines are bare text; the HUD frames them');assert.ok(Object.keys(OMENS[id].params).every(k=>Object.hasOwn(NEUTRAL_OMEN,k)));}
});

test('chooseOmens: deterministic per seed, 平穏 on the first run, nothing in the gallery',()=>{
 for(const mode of RANKED)for(const unlocked of [false,true])for(let seed=0;seed<300;seed++){
  const a=chooseOmens(seed*7919+13,mode,false,unlocked),b=chooseOmens(seed*7919+13,mode,false,unlocked);
  assert.deepEqual(a,b);assert.notEqual(a,b,'each call returns a fresh array');
  assert.deepEqual(chooseOmens(seed,mode,true,unlocked),['calm']);
 }
 for(const seed of [0,1,0x0b3e,-5,2**32-1,123.75,NaN])assert.deepEqual(chooseOmens(seed,'gallery',false,true),[]);
 for(const seed of [0,1,99])assert.deepEqual(chooseOmens(seed,'gallery',true,false),[]);
 const seen=new Set<string>();for(let seed=0;seed<40;seed++)seen.add(chooseOmens(seed,'normal',false,true).join('+'));assert.ok(seen.size>=4,'consecutive seeds vary the night');
 const huge=chooseOmens(0xffffffff,'nightmare',false,true);assert.equal(huge.length,2);assert.deepEqual(chooseOmens(NaN,'normal',false,false),chooseOmens(0,'normal',false,false));
});

test('normal and hard draw one real omen; 丑の刻参り only after a ranked clear; every omen is reachable and evenly drawn',()=>{
 for(const mode of ['normal','hard'] as const){
  const open=draws(mode,true),locked=draws(mode,false);
  assert.deepEqual([...open.keys()].sort(),[...REAL].sort());
  assert.deepEqual([...locked.keys()].sort(),REAL.filter(id=>id!=='ushimitsu').sort());
  for(const [,n] of open)assert.ok(n/SEEDS>.17&&n/SEEDS<.23,`${n/SEEDS} near 1/5`);
  for(const [,n] of locked)assert.ok(n/SEEDS>.22&&n/SEEDS<.28,`${n/SEEDS} near 1/4`);
  for(let seed=0;seed<500;seed++){const ids=chooseOmens(seed,mode,false,seed%2===0);assert.equal(ids.length,1);assert.notEqual(ids[0],'calm');}
 }
});

test('nightmare draws two distinct, non-conflicting omens, uniformly over the compatible pairs',()=>{
 const open=draws('nightmare',true),locked=draws('nightmare',false);
 assert.equal(open.size,9,'C(5,2) minus 静寂✕雨夜');assert.equal(locked.size,5,'C(4,2) minus 静寂✕雨夜');
 for(const [counts,expected] of [[open,1/9],[locked,1/5]] as const)for(const [k,n] of counts){
  const [a,b]=k.split('+') as OmenId[];
  assert.ok(a&&b&&a!==b);assert.ok(IDS.indexOf(a)<IDS.indexOf(b),'pairs come in table order');
  assert.ok(!OMENS[a].conflicts.includes(b)&&!OMENS[b].conflicts.includes(a),k);assert.ok(a!=='calm'&&b!=='calm');
  assert.ok(Math.abs(n/SEEDS-expected)<expected*.25,`${k} ${n/SEEDS} near ${expected}`);
 }
 assert.ok(![...locked.keys()].some(k=>k.includes('ushimitsu')));assert.ok([...open.keys()].some(k=>k.includes('ushimitsu')));
 for(let seed=0;seed<2000;seed++){const ids=chooseOmens(seed,'nightmare',false,true);assert.equal(ids.length,2);assert.deepEqual(sanitizeOmens(ids),ids);}
});

test('omenParams: neutral baseline, every omen bends something, scales multiply and counts add',()=>{
 assert.deepEqual(NEUTRAL_OMEN,{tollScale:1,extraHunters:0,extraSleepers:0,fogScale:1,sense:1,hearing:1,runHearing:1,startTolls:0,startBell:0});
 assert.deepEqual(omenParams([]),NEUTRAL_OMEN);assert.deepEqual(omenParams(['calm']),NEUTRAL_OMEN);
 const fresh=omenParams([]);assert.notEqual(fresh,NEUTRAL_OMEN);fresh.sense=0;assert.equal(NEUTRAL_OMEN.sense,1);assert.equal(omenParams([]).sense,1);
 for(const id of REAL){const p=omenParams([id]);assert.ok((Object.keys(NEUTRAL_OMEN) as (keyof OmenParams)[]).some(k=>p[k]!==NEUTRAL_OMEN[k]),id);assert.deepEqual(p,{...NEUTRAL_OMEN,...OMENS[id].params});}
 assert.deepEqual(omenParams(['newmoon']),{...NEUTRAL_OMEN,extraSleepers:1,fogScale:1.25,sense:.9});
 assert.deepEqual(omenParams(['ushimitsu']),{...NEUTRAL_OMEN,startTolls:1,extraSleepers:-1});
 const quiet=omenParams(['silence','longnight']);near(quiet.tollScale,1.75);assert.equal(quiet.extraHunters,1);assert.equal(quiet.startBell,1);near(quiet.hearing,1.3);
 const deep=omenParams(['newmoon','ushimitsu']);assert.equal(deep.extraSleepers,0);assert.equal(deep.startTolls,1);near(deep.fogScale,1.25);near(deep.sense,.9);
 const wet=omenParams(['rain','longnight']);near(wet.tollScale,1.12);near(wet.runHearing,.6);assert.equal(wet.hearing,1);
 for(const [a,b] of [['newmoon','rain'],['silence','ushimitsu'],['longnight','ushimitsu']] as [OmenId,OmenId][]){
  const p=omenParams([a,b]),pa=omenParams([a]),pb=omenParams([b]);
  for(const k of ['tollScale','fogScale','sense','hearing','runHearing'] as const)near(p[k],pa[k]*pb[k]);
  for(const k of ['extraHunters','extraSleepers','startTolls','startBell'] as const)assert.equal(p[k],pa[k]+pb[k]);
  assert.deepEqual(omenParams([b,a]),p,'order does not matter');
 }
 assert.deepEqual(omenParams(['newmoon','newmoon']),omenParams(['newmoon']),'a repeated id counts once');
 assert.deepEqual(omenParams(['silence','rain']),omenParams(['silence']),'a conflicting id is ignored');
 assert.deepEqual(omenParams(['ghost' as OmenId,'rain']),omenParams(['rain']));
});

test('omenMultiplier: multipliers multiply, rounded for the clear screen',()=>{
 assert.equal(omenMultiplier([]),1);assert.equal(omenMultiplier(['calm']),1);
 for(const id of IDS)assert.equal(omenMultiplier([id]),OMENS[id].multiplier);
 assert.equal(omenMultiplier(['newmoon','longnight']),1.21);assert.equal(omenMultiplier(['newmoon','ushimitsu']),1.32);
 assert.equal(omenMultiplier(['rain','ushimitsu']),1.26);assert.equal(omenMultiplier(['newmoon','rain']),1.155);assert.equal(omenMultiplier(['silence','longnight']),1.21);
 for(const a of REAL)for(const b of REAL)if(a!==b&&!OMENS[a].conflicts.includes(b))assert.equal(omenMultiplier([a,b]),Math.round(OMENS[a].multiplier*OMENS[b].multiplier*1000)/1000);
 assert.equal(omenMultiplier(['silence','rain']),1.1);assert.equal(omenMultiplier(['rain','rain']),1.05);
 for(const mode of RANKED)for(const unlocked of [false,true])for(const ids of drawable(mode,unlocked)){const m=omenMultiplier(ids);assert.ok(m>1&&m<=1.32,`${ids.join('+')} ×${m}`);}
});

test('sanitizeOmens: drops non-arrays, unknown, repeated and conflicting ids; 平穏 yields; at most two',()=>{
 for(const raw of [null,undefined,'newmoon',42,true,{0:'newmoon',length:1},{ids:['rain']},new Set(['rain'])])assert.deepEqual(sanitizeOmens(raw),[]);
 assert.deepEqual(sanitizeOmens([]),[]);
 assert.deepEqual(sanitizeOmens(['newmoon','ghost',3,null,undefined,{id:'rain'},['rain'],'toString','__proto__','constructor','NEWMOON',' rain']),['newmoon']);
 assert.deepEqual(sanitizeOmens(['rain','rain','rain']),['rain']);
 assert.deepEqual(sanitizeOmens(['rain','silence']),['rain']);assert.deepEqual(sanitizeOmens(['silence','rain','newmoon']),['silence','newmoon']);
 assert.deepEqual(sanitizeOmens(['calm']),['calm']);assert.deepEqual(sanitizeOmens(['calm','calm']),['calm']);
 assert.deepEqual(sanitizeOmens(['calm','longnight']),['longnight']);assert.deepEqual(sanitizeOmens(['ushimitsu','calm','rain']),['ushimitsu','rain']);
 assert.deepEqual(sanitizeOmens(['newmoon','silence','longnight','ushimitsu']),['newmoon','silence']);
 const input=['longnight','ghost'];sanitizeOmens(input);assert.deepEqual(input,['longnight','ghost'],'the input is not mutated');
 for(const mode of RANKED)for(let seed=0;seed<200;seed++){const ids=chooseOmens(seed,mode,seed%5===0,seed%3===0);assert.deepEqual(sanitizeOmens(JSON.parse(JSON.stringify(ids))),ids);}
});

test('omens feed the night config and item bag without leaving the mode clamps',()=>{
 for(const mode of RANKED)assert.deepEqual(nightConfig(mode,omenParams([])),nightConfig(mode));
 const at=(mode:PlayMode,ids:OmenId[])=>nightConfig(mode,omenParams(ids));
 assert.deepEqual(at('normal',['newmoon']).sleepers,[3,3]);assert.deepEqual(at('hard',['newmoon']).sleepers,[2,3]);assert.deepEqual(at('nightmare',['newmoon']).sleepers,[2,2]);
 near(at('normal',['silence']).tollSeconds,187.5);near(at('hard',['longnight']).tollSeconds,182);assert.equal(at('hard',['longnight']).hunters,4);assert.equal(at('nightmare',['longnight']).hunters,5);
 near(at('normal',['rain']).tollSeconds,120);near(at('nightmare',['rain']).tollSeconds,88);
 const deep=at('normal',['ushimitsu']);assert.equal(deep.startTolls,1);assert.deepEqual(deep.sleepers,[2,2]);assert.deepEqual(at('nightmare',['ushimitsu']).sleepers,[1,1]);
 assert.deepEqual(at('nightmare',['newmoon','ushimitsu']).sleepers,nightConfig('nightmare').sleepers);
 near(at('nightmare',['silence','longnight']).tollSeconds,192.5);assert.equal(at('nightmare',['silence','longnight']).hunters,5);
 for(const mode of RANKED){
  const base=nightConfig(mode),baseSleepers=base.sleepers[0]+base.sleepers[1];
  for(const unlocked of [false,true])for(const ids of drawable(mode,unlocked)){
   const p=omenParams(ids),c=nightConfig(mode,p),label=mode+':'+ids.join('+');
   assert.ok(c.tollSeconds>=base.tollSeconds*.8-1e-9&&c.tollSeconds<=base.tollSeconds*1.75+1e-9,label);
   assert.ok(c.hunters>=base.hunters&&c.hunters<=base.hunters+1,label);assert.ok(Math.abs(c.sleepers[0]+c.sleepers[1]-baseSleepers)<=1,label);assert.ok(c.sleepers[0]>=1,label);
   assert.ok(c.startTolls<=1&&c.startTolls===p.startTolls,label);
   assert.ok(p.sense>=.9&&p.sense<=1,'an omen never sharpens ordinary sight');assert.ok(p.hearing>=1&&p.hearing<=1.3);assert.ok(p.runHearing>=.6&&p.runHearing<=1);assert.ok(p.fogScale>=1&&p.fogScale<=1.25);
   const bells=(mode==='nightmare'?0:1)+p.startBell;assert.ok(bells>=0&&bells<=3,'start bells stay within the bell cap');
  }
 }
 assert.deepEqual(nightConfig('gallery',omenParams(['longnight','newmoon'])),nightConfig('gallery'),'the gallery night ignores omens');
});

test('the first run and the 丑の刻参り unlock follow the stored records',()=>{
 const firstRun=(records:Records,mode:PlayMode)=>!records[recordKey('shrine',mode)],unlocked=(records:Records)=>!!stageSummary(records,'shrine').rank;
 const run=(mode:PlayMode):RunSummary=>({stage:'shrine',mode,elapsed:600,deaths:0,escapes:2,notes:3,notesTotal:6});
 let records:Records={};
 assert.equal(firstRun(records,'normal'),true);assert.equal(unlocked(records),false);assert.deepEqual(chooseOmens(5,'normal',firstRun(records,'normal'),unlocked(records)),['calm']);
 records=applyClear(records,run('gallery'),scoreRun(run('gallery'))).records;assert.equal(unlocked(records),false,'a gallery walk is not a ranked clear');assert.equal(firstRun(records,'normal'),true);
 records=applyClear(records,run('hard'),scoreRun(run('hard'))).records;assert.equal(unlocked(records),true,'a ranked clear in any mode unlocks it');
 assert.equal(firstRun(records,'hard'),false);assert.equal(firstRun(records,'normal'),true,'each stage+mode learns its baseline first');
 assert.deepEqual(chooseOmens(5,'normal',firstRun(records,'normal'),unlocked(records)),['calm']);
 assert.ok([...Array(200).keys()].some(seed=>chooseOmens(seed,'hard',firstRun(records,'hard'),unlocked(records))[0]==='ushimitsu'));
});

type OmenWorld={setMode(mode:PlayMode,opts?:{omens?:OmenId[]}):void;nightStatus():{sleeping:number};dispose():void};
function world(t:{mock:{method:typeof test.mock.method}}){
 let enemies:Enemies|undefined;const setDormant=Enemies.prototype.setDormant;
 t.mock.method(Enemies.prototype,'setDormant',function(this:Enemies,ids:readonly number[]){enemies=this;return setDormant.call(this,ids);});
 t.mock.method(Enemies.prototype,'update',()=>false);
 const g=globalThis as unknown as Record<string,unknown>;g.innerWidth=1280;g.innerHeight=720;g.devicePixelRatio=1;
 const canvas={getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};
 g.document={addEventListener(){},removeEventListener(){},createElement:()=>canvas,createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})};
 const renderer={setPixelRatio(){},setSize(){},shadowMap:{},capabilities:{getMaxAnisotropy:()=>1},dispose(){}} as unknown as THREE.WebGLRenderer;
 const w:OmenWorld=createWorld(canvas as unknown as HTMLCanvasElement,renderer,11);
 return {w,get enemies(){return enemies!;}};
}
test('world: setMode without omens keeps the baseline night and difficulty',t=>{
 const h=world(t),w=h.w;
 try{
  w.setMode('normal');assert.equal(w.nightStatus().sleeping,5);assert.deepEqual(h.enemies.modifiers,{blueBalance:0,sense:1,hearing:1});assert.deepEqual(h.enemies.difficulty,stageRules('shrine','normal'));
  w.setMode('normal',{omens:[]});assert.equal(w.nightStatus().sleeping,5);assert.deepEqual(h.enemies.modifiers,{blueBalance:0,sense:1,hearing:1});assert.deepEqual(h.enemies.difficulty,stageRules('shrine','normal'));
 }finally{w.dispose();}
});
test('world: 新月 adds a sleeper and narrows ordinary sight outside `difficulty`',t=>{
 const h=world(t),w=h.w;
 try{
  w.setMode('normal',{omens:['newmoon']});assert.equal(w.nightStatus().sleeping,6);assert.deepEqual(h.enemies.modifiers,{blueBalance:0,sense:.9,hearing:1});assert.deepEqual(h.enemies.difficulty,stageRules('shrine','normal'));
  w.setMode('normal',{omens:['silence']});assert.equal(w.nightStatus().sleeping,5);assert.equal(h.enemies.modifiers.hearing,1.3);assert.equal(h.enemies.modifiers.sense,1);
  w.setMode('normal');assert.equal(w.nightStatus().sleeping,5);assert.deepEqual(h.enemies.modifiers,{blueBalance:0,sense:1,hearing:1});
 }finally{w.dispose();}
});
