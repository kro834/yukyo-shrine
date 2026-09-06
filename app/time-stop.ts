export const TIME_STOP_DURATION=10;
export const TIME_STOP_RECHARGE=30;
export class TimeStop {
 remaining=0;cooldown=0;
 get active(){return this.remaining>0;}
 use(){if(this.cooldown>0)return false;this.remaining=TIME_STOP_DURATION;this.cooldown=TIME_STOP_RECHARGE;return true;}
 step(dt:number){
  const elapsed=Math.max(0,dt),frozen=Math.min(elapsed,this.remaining);
  this.remaining=Math.max(0,this.remaining-elapsed);this.cooldown=Math.max(0,this.cooldown-elapsed);
  if(this.remaining<1e-6)this.remaining=0;if(this.cooldown<1e-6)this.cooldown=0;
  return elapsed-frozen;
 }
}
