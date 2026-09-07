export type ThreatState='quiet'|'hidden'|'search'|'chase'|'frozen'|'stunned';
export class RunProgress {
 elapsed=0;deaths=0;pickups=0;stuns=0;freezes=0;escapes=0;pressure=0;
 state:ThreatState='quiet';private wasChased=false;private safeFor=0;
 lastPickup:'blue'|'red'|'gold'|null=null;
 step(dt:number,status:{chasing:boolean;searching:boolean;hidden:boolean;frozen:boolean;burden:number;stunned?:boolean;finale?:boolean}){
  this.elapsed+=Math.max(0,Math.min(.15,dt));
  this.pressure=status.frozen||status.stunned?0:status.chasing?1:status.searching?.45:0;
  if(status.finale){this.wasChased=false;this.safeFor=0;}else if(status.chasing){this.wasChased=true;this.safeFor=0;}else if(this.wasChased&&!status.frozen&&!status.stunned){this.safeFor+=Math.max(0,dt);if(this.safeFor>=2){this.escapes++;this.wasChased=false;this.safeFor=0;}}
  this.state=status.frozen?'frozen':status.stunned?'stunned':status.chasing?'chase':status.searching?'search':status.hidden?'hidden':'quiet';
 }
 pickup(color:'blue'|'red'|'gold'){this.pickups++;this.lastPickup=color;}
 beginFinale(){this.wasChased=false;this.safeFor=0;this.pressure=0;this.state='quiet';}
 defeated(){this.deaths++;this.pressure=0;this.wasChased=false;this.safeFor=0;this.state='quiet';}
 snapshot(){return {elapsed:Math.floor(this.elapsed),deaths:this.deaths,pickups:this.pickups,stuns:this.stuns,freezes:this.freezes,escapes:this.escapes,pressure:this.pressure,state:this.state,lastPickup:this.lastPickup};}
}
export const formatRunTime=(seconds:number)=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+Math.floor(seconds%60).toString().padStart(2,'0');
