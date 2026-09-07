export type ThreatState='quiet'|'hidden'|'search'|'chase'|'frozen'|'stunned';
type ThreatStatus={chasing:boolean;searching:boolean;hidden:boolean;frozen:boolean;burden:number;stunned?:boolean;finale?:boolean;distance?:number};
/** The bar shows present danger, never time spent exploring or nearby idle foes. */
export function threatTarget(status:ThreatStatus){
 if(status.frozen||status.stunned||!status.chasing&&!status.searching)return 0;
 const distance=status.distance===undefined?0:Number.isFinite(status.distance)?Math.max(0,status.distance):Infinity;
 if(!Number.isFinite(distance))return 0;
 return status.chasing?.12+.88/(1+(distance/14)**1.7):.45*Math.exp(-distance/20);
}
export class RunProgress {
 elapsed=0;deaths=0;pickups=0;stuns=0;freezes=0;escapes=0;pressure=0;
 state:ThreatState='quiet';private wasChased=false;private safeFor=0;
 lastPickup:'blue'|'red'|'gold'|null=null;
 step(dt:number,status:ThreatStatus){
  const delta=Number.isFinite(dt)?Math.max(0,Math.min(.15,dt)):0;
  this.elapsed+=delta;
  const target=threatTarget(status);
  // A close pursuer fills the bar urgently; searches build gently. Frame-time
  // smoothing prevents jumps when the nearest threat changes. Safety is exact.
  if(target===0)this.pressure=0;
  else if(delta>0){
   const seconds=target<this.pressure?.20:status.chasing?.12+.20*(1-target):.48;
   this.pressure+=(target-this.pressure)*(-Math.expm1(-delta/seconds));
   if(Math.abs(this.pressure-target)<.0001)this.pressure=target;
   this.pressure=Math.max(0,Math.min(1,this.pressure));
  }
  if(status.finale){this.wasChased=false;this.safeFor=0;}else if(status.chasing){this.wasChased=true;this.safeFor=0;}else if(this.wasChased&&!status.frozen&&!status.stunned){this.safeFor+=delta;if(this.safeFor>=2){this.escapes++;this.wasChased=false;this.safeFor=0;}}
  this.state=status.frozen?'frozen':status.stunned?'stunned':status.chasing?'chase':status.searching?'search':status.hidden?'hidden':'quiet';
 }
 pickup(color:'blue'|'red'|'gold'){this.pickups++;this.lastPickup=color;}
 beginFinale(){this.wasChased=false;this.safeFor=0;this.pressure=0;this.state='quiet';}
 defeated(){this.deaths++;this.pressure=0;this.wasChased=false;this.safeFor=0;this.state='quiet';}
 snapshot(){return {elapsed:Math.floor(this.elapsed),deaths:this.deaths,pickups:this.pickups,stuns:this.stuns,freezes:this.freezes,escapes:this.escapes,pressure:this.pressure,state:this.state,lastPickup:this.lastPickup};}
}
export const formatRunTime=(seconds:number)=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+Math.floor(seconds%60).toString().padStart(2,'0');
