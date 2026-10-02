import type {FinaleKind} from './enemy-traits.ts';
import type {StageId} from './stage-profile.ts';
export type Surface='wood'|'stone'|'grass'|'carpet';
export type Pace='run'|'walk'|'crouch';
/** Discrete world events for sound and presentation. Enemies stay silent:
 * nothing here reveals an enemy that the visitor could not already perceive. */
export type WorldCue=
 |{kind:'step';surface:Surface;pace:Pace}
 |{kind:'pickup';color:'blue'|'red'|'gold'}
 |{kind:'mirror-pickup'}
 |{kind:'note';id:string}
 |{kind:'door';open:boolean}
 |{kind:'offer';unlocked:boolean;surplus?:boolean;rite?:boolean}
 |{kind:'mechanism'}
 |{kind:'burst';hits:number}
 |{kind:'time-stop'}
 |{kind:'time-resume'}
 |{kind:'mirror'}
 |{kind:'chase'}
 |{kind:'escape'}
 |{kind:'finale';foe:FinaleKind}
 |{kind:'caught'}
 |{kind:'clear'}
 |{kind:'bell';beat:'warning'|'toll'|'end'|'lull';count:number;survived?:boolean}
 |{kind:'purify'}
 |{kind:'notice'}
 |{kind:'item';action:'throw'|'ring'|'pickup'|'place'|'burn';distance?:number;angle?:number;item?:'bell'|'ward'}
 |{kind:'recover';count:number;blue:number;red:number;gold:number}
 |{kind:'rite';beat:'start'|'tick'|'complete'};
/** A ward flares under an enemy's foot, so it may only be heard where the visitor
 * could already perceive it: close by, or within sight. */
export const WARD_BURN_HEARD={near:12,seen:30} as const;
export function wardBurnAudible(distance:number,inView:boolean){return distance<=WARD_BURN_HEARD.near||inView&&distance<=WARD_BURN_HEARD.seen;}
const HARD=new Set(['stone','factory','bath','cistern','cave','yokocho']);
export function surfaceFor(stage:StageId,kind:string|undefined,elevation:number):Surface{
 if(stage==='ultrareal')return 'carpet';
 if(elevation>2.2)return 'wood';
 return kind==='field'?'grass':HARD.has(kind??'')||stage==='abyss'||stage==='mountain'?'stone':'wood';
}
/** A bounded queue, so a session that never drains it cannot grow without limit. */
export class CueQueue {
 private items:WorldCue[]=[];
 push(cue:WorldCue){if(this.items.length<96)this.items.push(cue);}
 drain(){return this.items.splice(0);}
}
