import type {Pad} from './gamepad-input.ts';
export class ButtonEdges {
  private previous:boolean[]=[];
  private device='';
  update(pad:Pad|null){
    const device=pad?`${pad.index??0}:${pad.id??''}:${pad.mapping}`:'';
    if(device!==this.device){this.previous=[];this.device=device;}
    const rawSony=!!pad&&pad.mapping!=='standard'&&/054c|sony|dualsense|dualshock|wireless controller|playstation/i.test(pad.id??'');
    const current=pad?.buttons.map((b,i)=>b.pressed||(b.value??0)>((i===6||i===7)?(this.previous[i]?.12:.25):.5))??[];
    const pressed=current.map((b,i)=>b&&!this.previous[i]);this.previous=current;
    // Standard API: Circle=1, Cross=0. Unmapped Sony USB HID: Circle=2, Cross=1.
    const circle=rawSony?2:1,cross=rawSony?1:0;
    return {flashlight:!!pressed[5],burst:!!pressed[7],timeStop:!!pressed[6],menu:!!pressed[9],confirm:!!pressed[cross],interact:!!pressed[circle],back:!!pressed[circle],up:!!pressed[12],down:!!pressed[13],left:!!pressed[14],right:!!pressed[15]};
  }
}
export function allowMouseLook(mode:string,paused:boolean,locked:boolean){return mode!=='gamepad'&&!paused&&locked;}
export function allowExploration(mode:string,paused:boolean,focused:boolean,locked:boolean){
  return focused&&!paused&&(mode!=='gamepad'||locked);
}
export class TouchInput {
  x=0;z=0;sprint=false;
  toggleSprint(){this.sprint=!this.sprint;return this.sprint;}
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


