export type DeviceHints={touch?:boolean;cores?:number;memory?:number};
export class PerformanceBudget {
 readonly mobile:boolean;readonly constrained:boolean;
 scale=1;private elapsed=0;private frames=0;private settled=0;
 constructor(hints:DeviceHints={}){this.mobile=!!hints.touch;this.constrained=this.mobile&&((hints.cores??4)<=4||(hints.memory??4)<=4);}
 quality(selected:'low'|'medium'|'high'){return this.constrained&&selected==='medium'?'low':selected;}
 pixelRatio(selected:'low'|'medium'|'high',width:number,height:number,dpr:number){
  const quality=this.quality(selected),cap=quality==='low'?1:quality==='high'?2:1.5,pixels=this.mobile?700000:3200000;
  return Math.max(.45,Math.min(dpr,cap,Math.sqrt(pixels/Math.max(1,width*height)))*this.scale);
 }
 observe(ms:number,active=true){
  if(!active||ms>250||ms<4){this.elapsed=this.frames=this.settled=0;return false;}
  this.elapsed+=ms;this.frames++;this.settled+=ms;
  if(this.elapsed<1800)return false;
  const average=this.elapsed/this.frames;this.elapsed=this.frames=0;
  const old=this.scale;
  if(average>36){this.scale=Math.max(.6,this.scale-.1);this.settled=0;}
  else if(average<23&&this.settled>10000){this.scale=Math.min(1,this.scale+.05);this.settled=0;}
  return this.scale!==old;
 }
}
/** Catch up slow frames in collision-safe steps without changing game speed. */
export function simulationSteps(seconds:number){
 const elapsed=Math.max(0,Math.min(seconds,.15)),count=Math.max(1,Math.ceil(elapsed/.05));
 return {count,dt:elapsed/count};
}
