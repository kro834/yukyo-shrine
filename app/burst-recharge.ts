export const BURST_RECHARGE=14;
export class BurstRecharge {
 remaining=0;
 use(){if(this.remaining>0)return false;this.remaining=BURST_RECHARGE;return true;}
 step(dt:number){this.remaining=Math.max(0,this.remaining-Math.max(0,dt));if(this.remaining<1e-6)this.remaining=0;}
}
