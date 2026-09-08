/** Pose timing follows actual AI displacement, never the patrol/chase intention. */
export type MotionSample={position?:{x:number;z:number};floor?:number;facing?:number;brain:{mode:string}};
export type GaitPose={phase:number;weight:number;run:number;forward:number;side:number};
const TAU=Math.PI*2;
export class EnemyLocomotion {
  readonly pose:GaitPose={phase:0,weight:0,run:0,forward:1,side:0};
  private previous:{x:number;z:number;floor:number;time:number}|null=null;
  sample(enemy:MotionSample,time:number):GaitPose {
    const p=enemy.position,old=this.previous,g=this.pose;
    if(!p||!Number.isFinite(p.x+p.z+time)){this.previous=null;g.weight=0;return g;}
    const floor=enemy.floor??0;
    this.previous={x:p.x,z:p.z,floor,time};
    const dt=old?(time-old.time)/1000:0;
    if(enemy.brain.mode==='stunned'){g.phase=0;g.weight=0;g.run=0;return g;}
    // A repeated simulation timestamp is a pause/time stop, not a stopped gait.
    if(old&&dt===0)return g;
    const dx=old?p.x-old.x:0,dz=old?p.z-old.z:0,distance=Math.hypot(dx,dz);
    // Respawns, stair transfers and off-screen gaps must not create giant steps.
    if(!old||dt<0||dt>.3||Math.abs(floor-old.floor)>.5||distance>Math.max(.6,dt*22)){
      g.phase=0;g.weight=0;g.run=0;return g;
    }
    const speed=distance/dt,moving=speed>.035;
    const blend=1-Math.exp(-dt*18);
    g.weight+=((moving?Math.min(1,speed/.8):0)-g.weight)*blend;
    if(g.weight<.001)g.weight=0;
    g.run+=(Math.min(1,Math.max(0,(speed-3.5)/5))-g.run)*blend;
    if(moving){
      g.phase=(g.phase+dt*TAU*Math.min(2.9,.9+speed*.16))%TAU;
      const facing=enemy.facing??0;
      g.forward=(dx*Math.sin(facing)+dz*Math.cos(facing))/distance;
      g.side=(dx*Math.cos(facing)-dz*Math.sin(facing))/distance;
    }
    return g;
  }
}

/** A longer planted interval and eased swing avoid marching with both feet up. */
export function footCycle(phase:number,index:number){
  const t=((phase/(Math.PI*2)+index*.5)%1+1)%1,stance=.58;
  if(t<stance)return {travel:1-2*t/stance,lift:0};
  const s=(t-stance)/(1-stance),ease=s*s*(3-2*s);
  return {travel:-1+2*ease,lift:Math.sin(Math.PI*s)**2};
}

/** Continuous shape-preserving slopes, unlike a separate eased cylinder per ring. */
export function clothSectionValue(points:readonly {y:number;rx:number;rz:number;z?:number}[],y:number,key:'rx'|'rz'|'z'){
  const value=(i:number)=>points[i][key]??0;
  const slope=(i:number)=>(value(i+1)-value(i))/(points[i+1].y-points[i].y);
  const tangent=(i:number)=>{
    if(i===0)return slope(0);if(i===points.length-1)return slope(i-1);
    const a=slope(i-1),b=slope(i);if(a*b<=0)return 0;
    const h0=points[i].y-points[i-1].y,h1=points[i+1].y-points[i].y;
    return 3*(h0+h1)/((2*h1+h0)/a+(h1+2*h0)/b);
  };
  let i=0;while(i<points.length-2&&y>points[i+1].y)i++;
  const h=points[i+1].y-points[i].y,t=Math.max(0,Math.min(1,(y-points[i].y)/h));
  return (2*t**3-3*t*t+1)*value(i)+(t**3-2*t*t+t)*h*tangent(i)+(-2*t**3+3*t*t)*value(i+1)+(t**3-t*t)*h*tangent(i+1);
}
