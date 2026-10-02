import type {PlayMode} from './play-mode.ts';
import {seededRandom} from './seeded-random.ts';
export type OmenId='calm'|'newmoon'|'silence'|'longnight'|'rain'|'ushimitsu';
export type OmenParams={tollScale:number;extraHunters:number;extraSleepers:number;fogScale:number;sense:number;hearing:number;runHearing:number;startTolls:number;startBell:number};
export type Omen={id:OmenId;name:string;line:string;multiplier:number;conflicts:readonly OmenId[];locked:boolean;params:Partial<OmenParams>};
const omen=(id:OmenId,name:string,line:string,multiplier:number,params:Partial<OmenParams>,conflicts:readonly OmenId[]=[],locked=false):Omen=>({id,name,line,multiplier,conflicts,locked,params});
export const OMENS:Readonly<Record<OmenId,Omen>>={
 calm:omen('calm','平穏','静かな夜',1,{}),
 newmoon:omen('newmoon','新月','眠る影がひとつ多く、霧が深い',1.1,{extraSleepers:1,fogScale:1.25,sense:.9}),
 silence:omen('silence','静寂','影の耳が冴え、鐘は遠い',1.1,{hearing:1.3,tollScale:1.25,startBell:1},['rain']),
 longnight:omen('longnight','長夜','鐘は遠いが、鳴れば多くが集まる',1.1,{tollScale:1.4,extraHunters:1}),
 rain:omen('rain','雨夜','足音は雨に紛れ、鐘は近い',1.05,{runHearing:.6,tollScale:.8},['silence']),
 ushimitsu:omen('ushimitsu','丑の刻参り','夜はすでに深い',1.2,{startTolls:1,extraSleepers:-1},[],true),
};
export const NEUTRAL_OMEN:OmenParams={tollScale:1,extraHunters:0,extraSleepers:0,fogScale:1,sense:1,hearing:1,runHearing:1,startTolls:0,startBell:0};
const OMEN_IDS=Object.keys(OMENS) as OmenId[],MAX_OMENS=2;
const SCALED=new Set<keyof OmenParams>(['tollScale','fogScale','sense','hearing','runHearing']);
const clash=(a:OmenId,b:OmenId)=>OMENS[a].conflicts.includes(b)||OMENS[b].conflicts.includes(a);
/** 平穏 is the absence of an omen: forced on the first run of a stage+mode and never drawn afterwards.
 * Nightmare draws uniformly among compatible pairs; gallery has no night to bend. */
export function chooseOmens(seed:number,mode:PlayMode,firstRun:boolean,unlocked:boolean):OmenId[]{
 if(mode==='gallery')return [];
 if(firstRun)return ['calm'];
 const pool=OMEN_IDS.filter(id=>id!=='calm'&&(unlocked||!OMENS[id].locked));
 const sets=mode==='nightmare'?pool.flatMap((a,i)=>pool.slice(i+1).filter(b=>!clash(a,b)).map(b=>[a,b])):pool.map(id=>[id]);
 return [...sets[Math.min(sets.length-1,Math.floor(seededRandom(seed^0x0b3e)()*sets.length))]];
}
/** Scales multiply and counts add, over the sanitized set. */
export function omenParams(ids:readonly OmenId[]):OmenParams{
 const p={...NEUTRAL_OMEN};
 for(const id of sanitizeOmens(ids))for(const [key,value] of Object.entries(OMENS[id].params) as [keyof OmenParams,number][])p[key]=SCALED.has(key)?p[key]*value:p[key]+value;
 return p;
}
export function omenMultiplier(ids:readonly OmenId[]):number{return Math.round(sanitizeOmens(ids).reduce((m,id)=>m*OMENS[id].multiplier,1)*1000)/1000;}
/** Stored or passed ids are untrusted: unknown, repeated and conflicting ids are dropped, 平穏 yields to any real omen, and at most two remain. */
export function sanitizeOmens(raw:unknown):OmenId[]{
 if(!Array.isArray(raw))return [];
 const kept:OmenId[]=[];
 for(const id of raw)if(typeof id==='string'&&Object.hasOwn(OMENS,id)&&!kept.some(k=>k===id||clash(k,id as OmenId)))kept.push(id as OmenId);
 const real=kept.filter(id=>id!=='calm');
 return real.length?real.slice(0,MAX_OMENS):kept;
}
