/** Buffer a single press near recharge completion, never a held auto-repeat. */
export class BurstInput {
 private expires=-1;
 request(now:number){this.expires=now+180;}
 clear(){this.expires=-1;}
 consume(now:number,cooldown:number):'fire'|'expired'|null{
  if(this.expires<0)return null;
  if(now>this.expires){this.clear();return 'expired';}
  if(cooldown>0)return null;
  this.clear();return 'fire';
 }
}
