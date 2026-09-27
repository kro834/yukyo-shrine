// Gameplay hearing is independent of browser audio/autoplay availability.
export class RunningSteps {
  private next=0;
  update(dt:number,running:boolean,moving:boolean){
    if(!running||!moving){this.next=0;return false;}
    this.next-=dt;if(this.next>0)return false;this.next=.29;return true;
  }
}
/** Walking and crouching are audible to the visitor only; enemies never hear them. */
export class QuietSteps {
  private next=.2;
  update(dt:number,moving:boolean,crouching:boolean){
    if(!moving){this.next=.2;return false;}
    this.next-=dt;if(this.next>0)return false;this.next=crouching?.74:.52;return true;
  }
}
