export const SPRINT_CAPACITY_SECONDS=8;
export class Stamina {
 enabled=false;value=1;exhausted=false;private restDelay=0;private acknowledged=false;
 setEnabled(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;this.reset();}
 reset(){this.value=1;this.exhausted=false;this.restDelay=0;this.acknowledged=false;}
 get canSprint(){return !this.enabled||(!this.exhausted&&this.value>1e-6);}
 step(dt:number,requested:boolean,moving:boolean,ran:boolean){
  if(!this.enabled)return;
  const elapsed=Math.max(0,Math.min(.15,dt));
  if(ran&&moving){this.value=Math.max(0,this.value-elapsed/SPRINT_CAPACITY_SECONDS);this.restDelay=.8;if(this.value<1e-6){this.value=0;this.exhausted=true;this.acknowledged=false;}}
  else {
   if(this.exhausted&&(!requested||!moving))this.acknowledged=true;
   const recovery=Math.max(0,elapsed-this.restDelay);this.restDelay=Math.max(0,this.restDelay-elapsed);
   this.value=Math.min(1,this.value+recovery*.22);
   if(this.exhausted&&this.acknowledged&&this.value>=.25){this.exhausted=false;this.acknowledged=false;}
  }
 }
 snapshot(){return {enabled:this.enabled,value:this.value,exhausted:this.exhausted};}
}
