export type ThreatState='quiet'|'hidden'|'search'|'chase'|'frozen';
export class RunProgress {
 elapsed=0;deaths=0;pickups=0;stuns=0;freezes=0;escapes=0;pressure=0;
 state:ThreatState='quiet';private wasChased=false;private safeFor=0;
 lastPickup:'blue'|'red'|'gold'|null=null;
 step(dt:number,status:{chasing:boolean;searching:boolean;hidden:boolean;frozen:boolean;burden:number}){
  this.elapsed+=Math.max(0,Math.min(.15,dt));
  this.pressure=Math.max(0,Math.min(1,status.burden));
  if(status.chasing){this.wasChased=true;this.safeFor=0;}else if(this.wasChased&&!status.frozen){this.safeFor+=dt;if(this.safeFor>=2){this.escapes++;this.wasChased=false;this.safeFor=0;}}
  this.state=status.frozen?'frozen':status.chasing?'chase':status.searching?'search':status.hidden?'hidden':'quiet';
 }
 pickup(color:'blue'|'red'|'gold'){this.pickups++;this.lastPickup=color;}
 defeated(){this.deaths++;this.pressure=0;this.wasChased=false;this.safeFor=0;this.state='quiet';}
 snapshot(){return {elapsed:Math.floor(this.elapsed),deaths:this.deaths,pickups:this.pickups,stuns:this.stuns,freezes:this.freezes,escapes:this.escapes,pressure:this.pressure,state:this.state,lastPickup:this.lastPickup};}
}
export const formatRunTime=(seconds:number)=>Math.floor(seconds/60).toString().padStart(2,'0')+':'+Math.floor(seconds%60).toString().padStart(2,'0');
