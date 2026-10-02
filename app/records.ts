import {PLAY_MODES,type PlayMode} from './play-mode.ts';
import {STAGES,type StageId} from './stage-profile.ts';
import {PHASE_NAMES,type NightPhase} from './night-clock.ts';
import type {OmenId} from './run-omens.ts';
export type Rank='S'|'A'|'B'|'C'|'D';
export type RunSummary={stage:StageId;mode:PlayMode;elapsed:number;deaths:number;escapes:number;notes:number;notesTotal:number;hunts?:number;clearPhase?:NightPhase;surplus?:{blue:number;red:number};omen?:{ids:OmenId[];multiplier:number}};
export type ScoreLine={label:string;detail:string;points:number};
export type ScoreResult={score:number;rank:Rank|null;multiplier:number;omenMultiplier?:number;lines:ScoreLine[]};
export type StageRecord={clears:number;bestTime:number|null;bestScore:number|null;bestRank:Rank|null;fewestDeaths:number|null};
export type Records=Record<string,StageRecord>;
export const RECORDS_KEY='yukyo-records-v1';
export const MODE_MULTIPLIER:Record<PlayMode,number>={gallery:0,normal:1,hard:1.2,nightmare:1.5};
export const RANK_FLOORS:readonly [Rank,number][]=[['S',6000],['A',4500],['B',3000],['C',1500],['D',-Infinity]];
const RANK_ORDER:Rank[]=['S','A','B','C','D'];
const clock=(seconds:number)=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+Math.floor(seconds%60).toString().padStart(2,'0');
/** Time earns its full value within ten minutes and none after forty; a
 * deathless clear earns a bonus, while each capture costs points. Surviving
 * tolls, sealing the gate early and surplus beads reward risk on top. Gallery
 * walks are recorded as clears without a rank. */
export function scoreRun(r:RunSummary):ScoreResult{
 const multiplier=MODE_MULTIPLIER[r.mode];
 if(!multiplier)return {score:0,rank:null,multiplier,lines:[]};
 const elapsed=Math.max(0,r.elapsed),deaths=Math.max(0,Math.floor(r.deaths)),escapes=Math.max(0,Math.floor(r.escapes)),notes=Math.max(0,Math.floor(r.notes));
 const lines:ScoreLine[]=[
  {label:'探索時間',detail:clock(elapsed),points:Math.round(4000*Math.min(1,Math.max(0,(2400-elapsed)/1800)))},
  deaths?{label:'復活',detail:deaths+'回',points:-600*deaths}:{label:'無傷踏破',detail:'復活なし',points:1000},
  {label:'追跡回避',detail:escapes+'回',points:Math.min(8,escapes)*150},
  {label:'手記',detail:notes+' / '+r.notesTotal,points:notes*300},
 ];
 const hunts=Math.max(0,Math.floor(r.hunts??0)||0),blue=Math.max(0,Math.floor(r.surplus?.blue??0)||0),red=Math.max(0,Math.floor(r.surplus?.red??0)||0);
 if(hunts>0)lines.push({label:'鐘を凌いだ',detail:hunts+'回',points:Math.min(5,hunts)*150});
 if(r.clearPhase!==undefined&&PHASE_NAMES[r.clearPhase])lines.push({label:'刻',detail:PHASE_NAMES[r.clearPhase]+'に封門',points:[600,250,0][r.clearPhase]});
 if(blue+red>0)lines.push({label:'余剰奉納',detail:'青'+blue+'・赤'+red,points:Math.min(1200,blue*200+red*500)});
 const omen=r.omen&&Number.isFinite(r.omen.multiplier)&&r.omen.multiplier>0?r.omen.multiplier:1;
 const score=Math.max(0,Math.round(lines.reduce((sum,l)=>sum+l.points,0)*multiplier*omen));
 return {score,rank:RANK_FLOORS.find(([,floor])=>score>=floor)![0],multiplier,...r.omen?{omenMultiplier:omen}:{},lines};
}
export const recordKey=(stage:StageId,mode:PlayMode)=>stage+':'+mode;
const count=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.floor(v):null;
/** Stored progress is untrusted: unknown stages, modes and values are dropped. */
export function sanitizeRecords(raw:unknown):Records{
 const result:Records={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const stage of Object.keys(STAGES) as StageId[])for(const {id:mode} of PLAY_MODES){
  const v=(raw as Record<string,unknown>)[recordKey(stage,mode)];if(!v||typeof v!=='object')continue;
  const r=v as Record<string,unknown>,clears=count(r.clears);if(!clears)continue;
  result[recordKey(stage,mode)]={clears,bestTime:count(r.bestTime),bestScore:count(r.bestScore),bestRank:RANK_ORDER.includes(r.bestRank as Rank)?r.bestRank as Rank:null,fewestDeaths:count(r.fewestDeaths)};
 }
 return result;
}
export function applyClear(records:Records,summary:RunSummary,result:ScoreResult){
 const key=recordKey(summary.stage,summary.mode),old=records[key],elapsed=Math.floor(Math.max(0,summary.elapsed));
 const newTime=old?.bestTime==null||elapsed<old.bestTime,newScore=result.rank!==null&&(old?.bestScore==null||result.score>old.bestScore);
 const next:StageRecord={clears:(old?.clears??0)+1,bestTime:newTime?elapsed:old!.bestTime,bestScore:newScore?result.score:old?.bestScore??null,bestRank:newScore?result.rank:old?.bestRank??null,fewestDeaths:Math.min(old?.fewestDeaths??Infinity,summary.deaths)};
 return {records:{...records,[key]:next},newTime:!!old&&newTime,newScore:!!old&&newScore,first:!old};
}
/** The best rank across ranked modes, and every clear including gallery walks. */
export function stageSummary(records:Records,stage:StageId){
 let rank:Rank|null=null,clears=0;
 for(const {id:mode} of PLAY_MODES){const r=records[recordKey(stage,mode)];if(!r)continue;clears+=r.clears;if(r.bestRank&&(!rank||RANK_ORDER.indexOf(r.bestRank)<RANK_ORDER.indexOf(rank)))rank=r.bestRank;}
 return {rank,clears};
}
