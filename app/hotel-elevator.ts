import {HOTEL_LIFT} from './hotel-layout.ts';
type Point={x:number;y:number;z:number};
type Phase='idle'|'boarding'|'closing'|'moving'|'opening'|'leaving';
export class HotelElevator {
 floor=0;target=0;y=0;doors=1;phase:Phase='idle';riding=false;
 private clock=0;private origin=0;private duration=0;private start:Point={x:HOTEL_LIFT.x,y:1.68,z:HOTEL_LIFT.z+2.6};
 near(p:{x:number;z:number},floor:number){return Math.abs(floor-Math.round(floor/4.8)*4.8)<.12&&Math.abs(p.x-HOTEL_LIFT.x)<.9&&p.z>HOTEL_LIFT.z+1.8&&p.z<HOTEL_LIFT.z+4.4;}
 prompt(p:{x:number;z:number},floor:number){if(this.phase!=='idle')return '';if(!this.near(p,floor))return '';return Math.abs(floor-this.y)<.2?'〇 エレベーター · '+((this.floor+1)%3+1)+'Fへ':'〇 エレベーターを呼ぶ';}
 interact(p:Point,floor:number){
  if(this.phase!=='idle'||!this.near(p,floor))return false;
  this.clock=0;this.origin=this.y;this.start={...p};
  if(Math.abs(floor-this.y)<.2){this.riding=true;this.target=(this.floor+1)%3;this.phase='boarding';}
  else {this.target=Math.max(0,Math.min(2,Math.round(floor/4.8)));this.phase='closing';}
  return true;
 }
 step(dt:number):{position:Point;floor:number}|null{
  // Integrate exact phase boundaries, independent of frame rate and pauses.
  let remaining=Math.max(0,Math.min(.1,dt)),result:null|{position:Point;floor:number}=null;
  while(remaining>1e-8&&this.phase!=='idle'){
   const duration=this.phase==='moving'?this.duration:this.phase==='boarding'||this.phase==='leaving'?.9:1.15;
   const delta=Math.min(remaining,duration-this.clock);this.clock+=delta;remaining-=delta;const t=Math.min(1,this.clock/duration),ease=t*t*(3-2*t);
   if(this.phase==='closing')this.doors=1-ease;
   if(this.phase==='opening')this.doors=ease;
   if(this.phase==='moving')this.y=this.origin+(HOTEL_LIFT.floors[this.target]-this.origin)*ease;
   if(this.riding){
    const boarding=this.phase==='boarding',leaving=this.phase==='leaving';
    result={position:{x:boarding?this.start.x+(HOTEL_LIFT.x-this.start.x)*ease:HOTEL_LIFT.x,y:this.y+1.68,z:boarding?this.start.z+(HOTEL_LIFT.z-this.start.z)*ease:HOTEL_LIFT.z+(leaving?2.6*ease:0)},floor:this.y};
   }
   if(t>=1){this.clock=0;
    if(this.phase==='boarding')this.phase='closing';
    else if(this.phase==='closing'){this.phase='moving';this.origin=this.y;this.duration=Math.max(3.4,Math.abs(HOTEL_LIFT.floors[this.target]-this.y)/1.4);}
    else if(this.phase==='moving'){this.y=HOTEL_LIFT.floors[this.target];this.floor=this.target;this.phase='opening';}
    else if(this.phase==='opening')this.phase=this.riding?'leaving':'idle';
    else {this.phase='idle';this.riding=false;}
   }
  }
  return result;
 }
 hint(){return this.phase==='idle'?'':this.phase==='moving'?'エレベーター · '+(this.target+1)+'Fへ移動中':this.phase==='closing'?'ドアが閉まります':this.phase==='opening'||this.phase==='leaving'?'ドアが開きます':'エレベーターに乗り込む';}
 reset(){this.floor=this.target=0;this.y=0;this.doors=1;this.clock=0;this.phase='idle';this.riding=false;}
}
