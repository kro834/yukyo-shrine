import type {Pad} from './gamepad-input.ts';
export class ButtonEdges {
  private previous:boolean[]=[];
  update(pad:Pad|null){const current=pad?.buttons.map(b=>b.pressed)??[];const pressed=current.map((b,i)=>b&&!this.previous[i]);this.previous=current;return {flashlight:!!pressed[5],burst:!!pressed[7],menu:!!pressed[9],confirm:!!pressed[0],interact:!!pressed[0],back:!!pressed[1],up:!!pressed[12],down:!!pressed[13],left:!!pressed[14],right:!!pressed[15]};}
}
export function allowMouseLook(mode:string,paused:boolean,locked:boolean){return mode!=='gamepad'&&!paused&&locked;}
export function allowExploration(mode:string,paused:boolean,focused:boolean,locked:boolean){
  return focused&&!paused&&(mode!=='gamepad'||locked);
}
export class TouchInput {
  x=0;z=0;sprint=false;
  pointers=new Map<number,{kind:'move'|'look'|'sprint';x:number;y:number}>();
  start(id:number,kind:'move'|'look'|'sprint',x:number,y:number){
    if([...this.pointers.values()].some(p=>p.kind===kind))return false;
    this.pointers.set(id,{kind,x,y});if(kind==='sprint')this.sprint=true;return true;
  }
  move(id:number,x:number,y:number){
    const p=this.pointers.get(id);if(!p)return {yaw:0,pitch:0};
    const dx=x-p.x,dy=y-p.y;
    if(p.kind==='move'){const length=Math.max(42,Math.hypot(dx,dy));this.x=dx/length;this.z=dy/length;}
    if(p.kind==='look'){p.x=x;p.y=y;return {yaw:dx,pitch:dy};}
    return {yaw:0,pitch:0};
  }
  end(id:number){const p=this.pointers.get(id);if(p?.kind==='move')this.x=this.z=0;if(p?.kind==='sprint')this.sprint=false;this.pointers.delete(id);}
  clear(){this.x=this.z=0;this.sprint=false;this.pointers.clear();}
}

