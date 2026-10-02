import type {Position} from './movement.ts';
import type {PlayMode} from './play-mode.ts';
import {floorBand} from './vertical-layout.ts';
import {isFinale} from './enemy-traits.ts';
export type NightPhase=0|1|2;
export const PHASE_NAMES=['宵の刻','夜半の刻','丑三つ時'] as const;
export type NightConfig={tollSeconds:number;warnSeconds:number;huntSeconds:number;lullSeconds:number;hunters:number;sleepers:readonly [number,number];blueBalance:readonly [number,number,number];fog:readonly [number,number,number];pickup:{blue:number;red:number};capture:number;calmAfterCapture:number;purify:{blue:number;red:number};deferMax:number;firstWarningAfter:number;startTolls:number};
export type NightInput={liveDt:number;elapsed:number;chasing:boolean;riding:boolean;player:Position;floor:number};
export type NightEvent=|{kind:'warning';origin:Position;floor:number;first:boolean}|{kind:'toll';tolls:number;phase:NightPhase;origin:Position;floor:number;wake:number}|{kind:'hunt-end';survived:boolean}|{kind:'lull-end'};
const MODE_NIGHT={normal:{tollSeconds:150,hunters:2,sleepers:[3,2]},hard:{tollSeconds:130,hunters:3,sleepers:[2,2]},nightmare:{tollSeconds:110,hunters:4,sleepers:[2,1]}} as const;
const MAX_FRACTION=.999,CAPTURE_CEILING=.95,EPSILON=1e-9;
export function nightConfig(mode:PlayMode,omen:Partial<Pick<NightConfig,'tollSeconds'|'hunters'|'startTolls'>>&{tollScale?:number;extraHunters?:number;extraSleepers?:number}={}):NightConfig{
 const shared={warnSeconds:12,huntSeconds:35,lullSeconds:20,blueBalance:[0,.25,.55] as const,fog:[1,1.2,1.45] as const,pickup:{blue:.1,red:.25},capture:.6,calmAfterCapture:25,purify:{blue:.15,red:.4},deferMax:30,firstWarningAfter:25};
 if(mode==='gallery')return {...shared,tollSeconds:Infinity,hunters:0,sleepers:[0,0],blueBalance:[0,0,0],fog:[1,1,1],pickup:{blue:0,red:0},capture:0,purify:{blue:0,red:0},firstWarningAfter:Infinity,startTolls:0};
 const base=MODE_NIGHT[mode],[early,late]=base.sleepers,extra=Math.round(omen.extraSleepers??0);
 // Batches always sum to the sleeper count: extras join the late batch, removals come off the early one.
 const sleepers:[number,number]=extra>=0?[early,late+extra]:[Math.max(0,early+extra),Math.max(0,late+Math.min(0,early+extra))];
 return {...shared,tollSeconds:(omen.tollSeconds??base.tollSeconds)*(omen.tollScale??1),hunters:Math.max(0,Math.round((omen.hunters??base.hunters)+(omen.extraHunters??0))),sleepers,startTolls:Math.max(0,Math.floor(omen.startTolls??0))};
}
export class NightClock{
 tolls=0;fraction=0;state:'calm'|'warning'|'hunt'|'lull'='calm';left=0;origin:Position|null=null;originFloor=0;deferred=0;calmHold=0;huntBroken=false;stopped=false;revision=0;
 private warnings=0;
 constructor(readonly config:NightConfig){}
 get phase():NightPhase{return Math.min(2,this.tolls+this.config.startTolls) as NightPhase;}
 get blueBalance(){return this.config.blueBalance[this.phase];}
 get fogScale(){return this.config.fog[this.phase];}
 private get threshold(){return 1-this.config.warnSeconds/this.config.tollSeconds;}
 private advance(amount:number){this.fraction=Math.max(0,Math.min(MAX_FRACTION,this.fraction+amount));}
 private calm(){this.state='calm';this.left=0;this.origin=null;this.deferred=0;this.huntBroken=false;}
 step(input:NightInput):NightEvent[]{
  const events:NightEvent[]=[],c=this.config,dt=Number.isFinite(input.liveDt)?Math.max(0,input.liveDt):0;
  if(this.stopped||dt<=0||!Number.isFinite(c.tollSeconds))return events;
  const hold=this.calmHold;this.calmHold=Math.max(0,hold-dt);this.advance(dt/c.tollSeconds);
  // Every window carries the part of the frame after its true start, so the timeline does not depend on frame size.
  let time=dt;
  if(this.state==='calm'){
   if(this.fraction<this.threshold||input.elapsed<c.firstWarningAfter||this.calmHold>0||input.riding)return events;
   time=Math.max(0,Math.min(dt,dt-hold,(this.fraction-this.threshold)*c.tollSeconds,input.elapsed-c.firstWarningAfter));
   this.state='warning';this.left=c.warnSeconds;this.deferred=0;this.origin={x:input.player.x,z:input.player.z};this.originFloor=floorBand(input.floor);this.revision++;
   events.push({kind:'warning',origin:{...this.origin},floor:this.originFloor,first:this.warnings++===0});
  }
  const held=input.chasing||input.riding||this.calmHold>0;
  for(;;){
   if(this.state==='hunt'&&input.chasing)this.huntBroken=true;
   const over=time-this.left;
   if(over<-EPSILON){this.left-=time;break;}
   time=Math.max(0,over);this.left=0;
   if(this.state==='warning'){
    if(held&&this.deferred<c.deferMax-EPSILON){const wait=Math.min(time,c.deferMax-this.deferred);this.deferred+=wait;time-=wait;if(this.deferred<c.deferMax-EPSILON)break;}
    this.tolls++;const phase=this.phase,count=this.tolls+c.startTolls;
    this.state='hunt';this.left=c.huntSeconds;this.huntBroken=false;this.deferred=0;this.fraction=Math.min(MAX_FRACTION,time/c.tollSeconds);this.revision++;
    events.push({kind:'toll',tolls:this.tolls,phase,origin:{...this.origin!},floor:this.originFloor,wake:count<=c.sleepers.length?c.sleepers[count-1]:Infinity});
   }else if(this.state==='hunt'){this.state='lull';this.left=c.lullSeconds;this.revision++;events.push({kind:'hunt-end',survived:!this.huntBroken});}
   else {this.calm();this.revision++;events.push({kind:'lull-end'});break;}
  }
  return events;
 }
 noteChase(){if(this.state==='hunt'&&!this.stopped)this.huntBroken=true;}
 pickup(color:'blue'|'red'|'gold'){if(this.stopped||color==='gold')return;const amount=this.config.pickup[color];if(amount>0){this.advance(amount);this.revision++;}}
 /** An offering that drops the bar below the warning line silences a pending (not yet rung) bell. */
 purify(used:{blue:number;red:number;gold?:number}){
  if(this.stopped)return 0;
  const before=this.fraction;this.advance(-(Math.max(0,used.blue)*this.config.purify.blue+Math.max(0,used.red)*this.config.purify.red));
  const removed=before-this.fraction;
  if(removed>0){if(this.state==='warning'&&this.fraction<this.threshold)this.calm();this.revision++;}
  return removed;
 }
 captured(){if(this.stopped)return;this.fraction=Math.min(CAPTURE_CEILING,this.fraction+this.config.capture);this.calmHold=this.config.calmAfterCapture;if(this.state==='hunt')this.huntBroken=true;this.revision++;}
 stop(){if(this.stopped)return;this.stopped=true;this.calm();this.revision++;}
 /** A finale cleared by a capture with the gate still locked hands the night back to the clock. */
 resume(){if(!this.stopped)return;this.stopped=false;this.revision++;}
 snapshot(){const phase=this.phase;return {phase,name:PHASE_NAMES[phase] as string,fraction:this.fraction,state:this.state,left:this.left,tolls:this.tolls,revision:this.revision};}
}
/** Seeded shuffle of eligible actors; one is skipped if it would leave its storey with nobody awake. */
export function chooseSleepers(actors:readonly {id:number;homeFloor:number;kind:string}[],guardianId:number,count:number,random:()=>number):number[]{
 const awake=new Map<number,number>();for(const a of actors){const storey=floorBand(a.homeFloor);awake.set(storey,(awake.get(storey)??0)+1);}
 const pool=actors.filter(a=>a.id!==guardianId&&!isFinale(a.kind)),chosen:number[]=[],want=Number.isFinite(count)?Math.max(0,Math.floor(count)):0;
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 for(const a of pool){if(chosen.length>=want)break;const storey=floorBand(a.homeFloor),left=awake.get(storey)??0;if(left<=1)continue;awake.set(storey,left-1);chosen.push(a.id);}
 return chosen;
}
