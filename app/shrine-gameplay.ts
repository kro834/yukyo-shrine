import {movePlayer,SPRINT_SPEED,RADIUS,type Position,type Obstacle} from './movement.ts';
import type {Cell,DoorSpec} from './shrine-layout.ts';
export function segmentBlocked(a:Position,b:Position,obstacles:Obstacle[]){
  const dx=b.x-a.x,dz=b.z-a.z;
  return obstacles.some(o=>{
    let lo=0,hi=1;
    for(const [origin,direction,min,max] of [[a.x,dx,o.minX,o.maxX],[a.z,dz,o.minZ,o.maxZ]]){
      if(Math.abs(direction)<1e-9){if(origin<min||origin>max)return false;continue;}
      let t1=(min-origin)/direction,t2=(max-origin)/direction;
      if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;
    }
    return hi>=0&&lo<=1;
  });
}
const doorBox=(d:DoorSpec,half=1.48):Obstacle=>({minX:d.x-(d.alongX?half:.13),maxX:d.x+(d.alongX?half:.13),minZ:d.z-(d.alongX?.13:half),maxZ:d.z+(d.alongX?.13:half)});
export class Doors {
  states:({spec:DoorSpec;open:boolean;progress:number})[];
  frames:Obstacle[];
  constructor(specs:DoorSpec[]){
    this.states=specs.map(spec=>({spec,open:false,progress:0}));
    this.frames=specs.flatMap(d=>[-1,1].map(s=>({minX:d.x+(d.alongX?s*1.76:0)-(d.alongX?.24:.19),maxX:d.x+(d.alongX?s*1.76:0)+(d.alongX?.24:.19),minZ:d.z+(d.alongX?0:s*1.76)-(d.alongX?.19:.24),maxZ:d.z+(d.alongX?0:s*1.76)+(d.alongX?.19:.24)})));
  }
  blockers(){return this.states.filter(d=>d.progress<.92).map(d=>doorBox(d.spec));}
  nearest(player:Position,yaw:number,walls:Obstacle[]){
    return this.states.map(d=>({d,dx:d.spec.x-player.x,dz:d.spec.z-player.z,dist:Math.hypot(d.spec.x-player.x,d.spec.z-player.z)}))
      .filter(v=>v.dist<3.4&&(v.dist<.9||(-Math.sin(yaw)*v.dx-Math.cos(yaw)*v.dz)/v.dist>.25)&&!segmentBlocked(player,v.d.spec,walls))
      .sort((a,b)=>a.dist-b.dist)[0]?.d??null;
  }
  interact(player:Position,yaw:number,walls:Obstacle[]){const d=this.nearest(player,yaw,walls);if(!d)return false;d.open=!d.open;return true;}
  update(dt:number,player:Position){
    for(const d of this.states){
      const normal=d.spec.alongX?Math.abs(player.z-d.spec.z):Math.abs(player.x-d.spec.x);
      const tangent=d.spec.alongX?Math.abs(player.x-d.spec.x):Math.abs(player.z-d.spec.z);
      if(!d.open&&d.progress>.1&&normal<.72&&tangent<1.9)d.open=true;
      const target=d.open?1:0;d.progress=Math.max(0,Math.min(1,d.progress+Math.sign(target-d.progress)*Math.min(Math.abs(target-d.progress),dt*2)));
    }
  }
}
export const STUN_SECONDS=9;
export const LOSE_SIGHT_SECONDS=.65;
export class EnemyBrain {
  mode:'patrol'|'chase'|'stunned'='patrol';
  stunRemaining=0;lostFor=0;reacquireDelay=0;lastSeen:Position|null=null;
  stun(){this.stunRemaining=STUN_SECONDS;this.mode='stunned';this.lastSeen=null;this.lostFor=0;}
  update(dt:number,seesPlayer:boolean,player:Position){
    if(this.stunRemaining>0){
      this.stunRemaining=Math.max(0,this.stunRemaining-dt);
      if(this.stunRemaining>1e-6){this.mode='stunned';return;}
      this.stunRemaining=0;this.mode='patrol';this.reacquireDelay=1.5;return;
    }
    this.reacquireDelay=Math.max(0,this.reacquireDelay-dt);
    if(seesPlayer&&this.reacquireDelay===0){this.mode='chase';this.lostFor=0;this.lastSeen={...player};}
    else if(this.mode==='chase'){
      this.lostFor+=dt;
      if(this.lostFor>=LOSE_SIGHT_SECONDS){this.mode='patrol';this.lastSeen=null;this.reacquireDelay=2;this.lostFor=0;}
    }
  }
}
export type Enemy={id:number;position:Position;home:Position;facing:number;brain:EnemyBrain;waypoint:Position|null;planIn:number;step:number};
export class Enemies {
  nodes=new Map<string,Position>();
  graph=new Map<string,string[]>();
  actors:Enemy[];
  private walls:Obstacle[];
  constructor(cells:Cell[],walls:Obstacle[]){
    this.walls=walls;
    const free=(p:Position)=>!walls.some(o=>p.x>o.minX-RADIUS&&p.x<o.maxX+RADIUS&&p.z>o.minZ-RADIUS&&p.z<o.maxZ+RADIUS);
    for(const c of cells){const p={x:c.x*4,z:c.z*4};if(free(p))this.nodes.set(c.x+','+c.z,p);}
    for(const [key,p] of this.nodes){const [x,z]=key.split(',').map(Number);this.graph.set(key,[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(x+dx)+','+(z+dz)).filter(k=>this.nodes.has(k)&&!segmentBlocked(p,this.nodes.get(k)!,walls)));}
    this.actors=[{x:0,z:-64},{x:-44,z:-44},{x:44,z:-80},{x:0,z:-128}].map((p,id)=>{const home=this.closest(p)!.point;return {id,home:{...home},position:{...home},facing:0,brain:new EnemyBrain(),waypoint:null,planIn:0,step:0};});
  }
  private closest(p:Position){let result:{key:string;point:Position;distance:number}|null=null;for(const [key,point] of this.nodes){const distance=Math.hypot(point.x-p.x,point.z-p.z);if((!result||distance<result.distance)&&!segmentBlocked(p,point,this.walls))result={key,point,distance};}return result;}
  burst(player:Position,blockers:Obstacle[]){let count=0;for(const e of this.actors)if(Math.hypot(e.position.x-player.x,e.position.z-player.z)<=10&&!segmentBlocked(player,e.position,blockers)){e.brain.stun();count++;}return count;}
  reset(){for(const e of this.actors){e.position={...e.home};e.brain=new EnemyBrain();e.brain.reacquireDelay=4;e.waypoint=null;}}
  update(dt:number,player:Position,blockers:Obstacle[]){
    let caught=false;
    for(const e of this.actors){
      const dx=player.x-e.position.x,dz=player.z-e.position.z,distance=Math.hypot(dx,dz);
      const facing=(dx*Math.sin(e.facing)+dz*Math.cos(e.facing))/Math.max(.01,distance);
      const sees=distance<14&&(distance<3||facing>.2)&&!segmentBlocked(e.position,player,blockers);
      const previousMode=e.brain.mode;e.brain.update(dt,sees,player);
      if(previousMode!==e.brain.mode&&e.brain.mode==='patrol'){e.waypoint=null;e.planIn=0;}
      if(e.brain.mode==='stunned')continue;
      if(e.brain.mode==='chase'&&distance<.8&&sees){caught=true;continue;}
      let goal=e.brain.mode==='chase'?e.brain.lastSeen:null;
      if(!goal){
        e.planIn-=dt;
        if(!e.waypoint||Math.hypot(e.waypoint.x-e.position.x,e.waypoint.z-e.position.z)<.15||e.planIn<=0){
          const current=this.closest(e.position);e.planIn=3;
          if(current){
            if(current.distance>.35)e.waypoint=current.point;
            else {
              const choices=(this.graph.get(current.key)??[]).filter(k=>!segmentBlocked(e.position,this.nodes.get(k)!,blockers));
              e.step++;const next=choices[(e.step*13+e.id*7)%Math.max(1,choices.length)];
              e.waypoint=next?this.nodes.get(next)!:null;
            }
          }
        }
        goal=e.waypoint;
      }
      if(goal){
        const gx=goal.x-e.position.x,gz=goal.z-e.position.z,len=Math.hypot(gx,gz);
        const speed=e.brain.mode==='chase'?4.3:1.35;
        if(len>.03){e.facing=Math.atan2(gx,gz);e.position=movePlayer(e.position,gx/len,gz/len,0,true,Math.min(dt,len/speed)*speed/SPRINT_SPEED,blockers);}
      }
    }
    return caught;
  }
}

