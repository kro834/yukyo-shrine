/** Act on every touch, including a second finger; suppress its compatibility click. */
export class TouchActionGate {
  private last=new Map<string,number>();
  down(key:string,pointerType:string,time:number){if(pointerType!=='touch'&&pointerType!=='pen')return false;this.last.set(key,time);return true;}
  end(key:string,pointerType:string,time:number){if(pointerType==='touch'||pointerType==='pen')this.last.set(key,time);}
  click(key:string,detail:number,time:number){return detail===0||time-(this.last.get(key)??-Infinity)>700;}
}
