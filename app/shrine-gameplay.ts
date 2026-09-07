import {movePlayer,SPRINT_SPEED,RADIUS,type Position,type Obstacle} from './movement.ts';
import type {Cell,DoorSpec} from './shrine-layout.ts';
import {nearbyObstacles} from './spatial.ts';
import {createAreaLookup,AREA_MULTIPLIERS,RED_AREAS,type AreaColor} from './area-rules.ts';
import {flashHits,lightBlocked} from './flash-visibility.ts';
import {STAIRS,UPPER_HEIGHT,floorHeightAt,upperPartitions,upperBarriers,stairRails,upperDoors} from './annex.ts';
export function segmentBlocked(a:Position,b:Position,obstacles:Obstacle[]){
  const dx=b.x-a.x,dz=b.z-a.z;
  return nearbyObstacles(obstacles,Math.min(a.x,b.x),Math.min(a.z,b.z),Math.max(a.x,b.x),Math.max(a.z,b.z)).some(o=>{
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
  private blockerCache=new Map<number,{key:string;items:Obstacle[]}>();
  constructor(specs:DoorSpec[]){
    this.states=specs.map(spec=>({spec,open:false,progress:0}));
    this.frames=this.framesFor(0);
  }
  framesFor(floor=0){return this.states.filter(d=>Math.abs((d.spec.floor??0)-floor)<.5).flatMap(({spec:d})=>[-1,1].map(s=>({minX:d.x+(d.alongX?s*1.76:0)-(d.alongX?.24:.19),maxX:d.x+(d.alongX?s*1.76:0)+(d.alongX?.24:.19),minZ:d.z+(d.alongX?0:s*1.76)-(d.alongX?.19:.24),maxZ:d.z+(d.alongX?0:s*1.76)+(d.alongX?.19:.24)})));}
  blockers(floor=0){const closed=this.states.filter(d=>d.progress<.92&&Math.abs((d.spec.floor??0)-floor)<.5),key=closed.map(d=>d.spec.id).join('|');const old=this.blockerCache.get(floor);if(old?.key===key)return old.items;const items=closed.map(d=>doorBox(d.spec));this.blockerCache.set(floor,{key,items});return items;}
  nearest(player:Position,yaw:number,walls:Obstacle[],floor=0){
    return this.states.filter(d=>Math.abs((d.spec.floor??0)-floor)<.5).map(d=>{
      const p={x:d.spec.alongX?Math.max(d.spec.x-1.25,Math.min(d.spec.x+1.25,player.x)):d.spec.x,z:d.spec.alongX?d.spec.z:Math.max(d.spec.z-1.25,Math.min(d.spec.z+1.25,player.z))};
      return {d,p,dx:p.x-player.x,dz:p.z-player.z,dist:Math.hypot(p.x-player.x,p.z-player.z)};
    }).filter(v=>v.dist<5.5&&(v.dist<1.5||(-Math.sin(yaw)*v.dx-Math.cos(yaw)*v.dz)/v.dist>.15)&&!segmentBlocked(player,v.p,walls))
      .sort((a,b)=>a.dist-b.dist)[0]?.d??null;
  }
  interact(player:Position,yaw:number,walls:Obstacle[],floor=0){const d=this.nearest(player,yaw,walls,floor);if(!d)return false;d.open=!d.open;return true;}
  update(dt:number,player:Position,floor=0){
    for(const d of this.states){
      const normal=d.spec.alongX?Math.abs(player.z-d.spec.z):Math.abs(player.x-d.spec.x);
      const tangent=d.spec.alongX?Math.abs(player.x-d.spec.x):Math.abs(player.z-d.spec.z);
      if(!d.open&&d.progress>.1&&normal<.72&&tangent<1.9&&Math.abs((d.spec.floor??0)-floor)<.5)d.open=true;
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
export const ENEMY_PROFILES={normal:{sight:22,nearSight:3.5,cone:.1,chase:7.2,patrol:2.8,hearing:70},danger:{sight:46,nearSight:6,cone:-.25,chase:9,patrol:3.2,hearing:120},listener:{sight:14,nearSight:2,cone:.2,chase:6.8,patrol:2.3,hearing:110},watcher:{sight:36,nearSight:3,cone:.65,chase:7,patrol:1.8,hearing:55},stalker:{sight:18,nearSight:4,cone:-.1,chase:8.6,patrol:3.1,hearing:45}};
export type EnemyKind=keyof typeof ENEMY_PROFILES;
type PatrolTarget={id:string;point:Position;floor:number;visits:number};
export type Enemy={id:number;kind:EnemyKind;position:Position;home:Position;facing:number;brain:EnemyBrain;waypoint:Position|null;planIn:number;step:number;route:Position[];investigate:Position|null;searchTime:number;lastNode:string|null;visits:Map<string,number>;doorWait:number;floor:number;destinationFloor:number;lastSeenFloor:number;patrol:PatrolTarget|null};
export function openPursuedDoor(doors:Doors,e:Enemy,walls:Obstacle[],dt:number){
  const d=(e.brain.mode==='chase'||e.investigate||e.patrol)&&e.brain.mode!=='stunned'?doors.nearest(e.position,e.facing+Math.PI,walls,e.floor>4.5?UPPER_HEIGHT:0):null;
  const close=d&&!d.open&&Math.hypot(d.spec.x-e.position.x,d.spec.z-e.position.z)<1.65;
  e.doorWait=close?e.doorWait+dt:0;
  const delay=e.brain.mode==='chase'||e.investigate?.8:1.5;
  if(close&&e.doorWait>delay){d.open=true;e.doorWait=0;return true;}return false;
}
export class Enemies {
  nodes=new Map<string,Position>();
  graph=new Map<string,string[]>();
  actors:Enemy[];
  patrolTargets:PatrolTarget[]=[];
  private walls:Obstacle[];
  private areaAt:(p:Position,floor?:number)=>AreaColor;
  private wingAt:(p:Position)=>Cell['kind']|undefined;
  private upperWalls=[...upperPartitions,...upperBarriers,...stairRails,...new Doors(upperDoors).framesFor(UPPER_HEIGHT)];
  private upperNodes=new Map<string,Position>();
  private upperGraph=new Map<string,string[]>();
  constructor(cells:Cell[],walls:Obstacle[]){
    this.walls=walls;
    this.areaAt=createAreaLookup(cells);
    const kinds=new Map(cells.map(c=>[c.x+','+c.z,c.kind]));
    this.wingAt=p=>kinds.get(Math.round(p.x/4)+','+Math.round(p.z/4));
    const free=(p:Position)=>!walls.some(o=>p.x>o.minX-RADIUS&&p.x<o.maxX+RADIUS&&p.z>o.minZ-RADIUS&&p.z<o.maxZ+RADIUS);
    for(const c of cells){const p={x:c.x*4,z:c.z*4};if(free(p))this.nodes.set(c.x+','+c.z,p);}
    for(const [key,p] of this.nodes){const [x,z]=key.split(',').map(Number);this.graph.set(key,[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(x+dx)+','+(z+dz)).filter(k=>this.nodes.has(k)&&!segmentBlocked(p,this.nodes.get(k)!,walls)));}
    for(let x=12;x<=23;x++)for(let z=0;z<=8;z++){
      const p={x:x*4,z:z*4};if(STAIRS.some(s=>p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ)||this.upperWalls.some(o=>p.x>o.minX-RADIUS&&p.x<o.maxX+RADIUS&&p.z>o.minZ-RADIUS&&p.z<o.maxZ+RADIUS))continue;
      this.upperNodes.set(x+','+z,p);
    }
    for(const [key,p] of this.upperNodes){const [x,z]=key.split(',').map(Number);this.upperGraph.set(key,[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(x+dx)+','+(z+dz)).filter(k=>this.upperNodes.has(k)&&!segmentBlocked(p,this.upperNodes.get(k)!,this.upperWalls)));}
    this.actors=[{x:0,z:-64},{x:-44,z:-44},{x:44,z:-80},{x:0,z:112},{x:132,z:172},{x:128,z:-116},{x:-144,z:-100},{x:0,z:-212}].map((p,id)=>{const home=[...this.nodes.values()].reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b);return {id,kind:id===4?'danger':(['normal','listener','watcher','stalker'] as EnemyKind[])[id%4],home:{...home},position:{...home},facing:0,brain:new EnemyBrain(),waypoint:null,planIn:0,step:0,route:[],investigate:null,searchTime:0,lastNode:null,visits:new Map<string,number>(),doorWait:0,floor:0,destinationFloor:0,lastSeenFloor:0,patrol:null};});
  }
  addPatrolTargets(points:{id:string;position:Position;floor:number}[]){
    if(!this.patrolTargets.length){
      const sectors=new Map<string,{point:Position;floor:number;distance:number}>();
      for(const [nodes,floor] of [[this.nodes,0],[this.upperNodes,UPPER_HEIGHT]] as const)for(const p of nodes.values()){
        const x=Math.floor(p.x/24),z=Math.floor(p.z/24),id=floor+':'+x+','+z,distance=Math.hypot(p.x-x*24-12,p.z-z*24-12);
        if(!sectors.has(id)||distance<sectors.get(id)!.distance)sectors.set(id,{point:p,floor,distance});
      }
      for(const [id,t] of sectors)this.patrolTargets.push({id,point:t.point,floor:t.floor,visits:0});
    }
    for(const p of points){const nearest=this.closest(p.position,p.floor>2.4);if(nearest&&!this.patrolTargets.some(t=>t.id===p.id))this.patrolTargets.push({id:p.id,point:nearest.point,floor:p.floor,visits:0});}
  }
  private assignPatrol(e:Enemy){
    if(!this.patrolTargets.length)this.addPatrolTargets([]);
    const assigned=new Set(this.actors.filter(a=>a!==e).map(a=>a.patrol?.id));
    const score=(t:PatrolTarget)=>(t.visits+(assigned.has(t.id)?2:0))*500+Math.hypot(e.position.x-t.point.x,e.position.z-t.point.z)+(Math.abs(e.floor-t.floor)>1?75:0);
    const homeWing=this.wingAt(e.home);
    const local=this.patrolTargets.filter(t=>homeWing==='yokocho'?this.wingAt(t.point)==='yokocho':true),candidates=local.length?local:this.patrolTargets;
    e.patrol=candidates.reduce((best,t)=>score(t)<score(best)?t:best);
    e.destinationFloor=e.patrol.floor;e.route=[];e.waypoint=null;e.planIn=0;
  }
  private closest(p:Position,upper=false){
    const nodes=upper?this.upperNodes:this.nodes,cx=Math.round(p.x/4),cz=Math.round(p.z/4),walls=upper?this.upperWalls:this.walls;
    const local:{key:string;point:Position;distance:number}[]=[];
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const key=(cx+dx)+','+(cz+dz),point=nodes.get(key);if(point)local.push({key,point,distance:Math.hypot(point.x-p.x,point.z-p.z)});}
    local.sort((a,b)=>a.distance-b.distance);const nearby=local.find(c=>!segmentBlocked(p,c.point,walls));if(nearby)return nearby;
    const candidates=Array.from(nodes,([key,point])=>({key,point,distance:Math.hypot(point.x-p.x,point.z-p.z)})).sort((a,b)=>a.distance-b.distance);
    return candidates.find(c=>!segmentBlocked(p,c.point,upper?this.upperWalls:this.walls))??null;
  }
  private path(start:Position,target:Position,upper=false):Position[]{
    const a=this.closest(start,upper),b=this.closest(target,upper);if(!a||!b)return [];
    const queue=[a.key],parent=new Map<string,string|null>([[a.key,null]]);
    for(let i=0;i<queue.length&&!parent.has(b.key);i++)for(const n of (upper?this.upperGraph:this.graph).get(queue[i])??[])if(!parent.has(n)){parent.set(n,queue[i]);queue.push(n);}
    if(!parent.has(b.key))return [];
    const result:Position[]=[];let k:string|null=b.key;
    while(k&&k!==a.key){result.push((upper?this.upperNodes:this.nodes).get(k)!);k=parent.get(k)??null;}
    result.reverse();if(a.distance>.3&&(!result[0]||segmentBlocked(start,result[0],upper?this.upperWalls:this.walls)))result.unshift(a.point);return result;
  }
  hear(position:Position,floor=0){
    const balance=AREA_MULTIPLIERS[this.areaAt(position,floor)];
    let count=0;for(const e of this.actors){
      if(e.brain.mode==='stunned'||Math.hypot(e.position.x-position.x,e.position.z-position.z)>ENEMY_PROFILES[e.kind].hearing*balance.sense)continue;
      const nextFloor=floor>2.4?UPPER_HEIGHT:0;
      if(!e.investigate||e.destinationFloor!==nextFloor){e.planIn=Math.min(e.planIn,.03*e.id);e.route=[];}
      e.investigate={...position};e.destinationFloor=nextFloor;e.searchTime=Math.max(45*balance.search,Math.hypot(e.position.x-position.x,e.position.z-position.z)/(3.3*balance.speed)+8*balance.search);count++;
    }return count;
  }
  burst(player:Position&{y?:number},blockers:Obstacle[],floor=0,yaw=0,pitch=0){let count=0;for(const e of this.actors)if(flashHits({x:player.x,z:player.z,y:player.y??floor+1.5},e.position,floor,e.floor,yaw,pitch,blockers)){e.brain.stun();e.route=[];e.investigate=null;e.searchTime=0;count++;}return count;}
  reset(){for(const e of this.actors){e.position={...e.home};e.brain=new EnemyBrain();e.brain.reacquireDelay=4;e.waypoint=null;e.route=[];e.investigate=null;e.searchTime=0;e.doorWait=0;e.floor=0;e.destinationFloor=0;e.patrol=null;}}
  update(dt:number,player:Position,groundBlockers:Obstacle[],playerFloor=0,upperBlockers:Obstacle[]=this.upperWalls,detectable=true){
    let caught=false;
    for(const e of this.actors){
      const upstairs=e.floor>4.5,blockers=upstairs?upperBlockers:groundBlockers;
      const dx=player.x-e.position.x,dz=player.z-e.position.z,distance=Math.hypot(dx,dz);
      const facing=(dx*Math.sin(e.facing)+dz*Math.cos(e.facing))/Math.max(.01,distance);
      const base=ENEMY_PROFILES[e.kind],balance=AREA_MULTIPLIERS[this.areaAt(player,playerFloor)];
      const dangerScale=this.wingAt(player)==='yokocho'?1.3:1;
      const profile={...base,sight:base.sight*balance.sense*dangerScale,nearSight:base.nearSight*balance.sense,chase:Math.min(8.9,base.chase*balance.speed*dangerScale),patrol:base.patrol*balance.speed};
      const sees=detectable&&Math.abs(playerFloor-e.floor)<1&&distance<profile.sight&&(distance<profile.nearSight||facing>profile.cone)&&!lightBlocked({...e.position,y:e.floor+2.05},{...player,y:playerFloor+1.5},blockers);
      const previousMode=e.brain.mode,lastSeen=e.brain.lastSeen?{...e.brain.lastSeen}:null;e.brain.update(dt,sees,player);
      if(previousMode==='chase'&&e.brain.mode==='patrol'){e.investigate=lastSeen;e.destinationFloor=e.lastSeenFloor;e.searchTime=5*balance.search;e.waypoint=null;e.route=[];e.planIn=0;}
      if(sees){e.investigate=null;e.searchTime=0;e.lastSeenFloor=playerFloor>2.4?UPPER_HEIGHT:0;e.destinationFloor=e.lastSeenFloor;}
      if(e.brain.mode==='stunned')continue;
      if(e.brain.mode==='chase'&&distance<.8&&sees){caught=true;continue;}
      e.searchTime=Math.max(0,e.searchTime-dt);if(e.searchTime===0)e.investigate=null;
      if(e.brain.mode==='patrol'&&!e.investigate){
        if(e.patrol&&Math.abs(e.floor-e.patrol.floor)<.3&&Math.hypot(e.position.x-e.patrol.point.x,e.position.z-e.patrol.point.z)<.45){e.patrol.visits++;e.patrol=null;}
        if(!e.patrol)this.assignPatrol(e);else e.destinationFloor=e.patrol.floor;
      }
      let goal=e.brain.mode==='chase'?e.brain.lastSeen:e.investigate??e.patrol?.point??null;
      const onStair=e.floor>.01&&e.floor<UPPER_HEIGHT-.01;
      let stairTravel=false;
      if(goal&&(onStair||(e.destinationFloor>2.4)!==upstairs)){
        const ascending=e.destinationFloor>2.4;
        const stair=STAIRS.slice().sort((a,b)=>Math.hypot((a.minX+a.maxX)/2-e.position.x,(ascending?a.minZ:a.maxZ)-e.position.z)-Math.hypot((b.minX+b.maxX)/2-e.position.x,(ascending?b.minZ:b.maxZ)-e.position.z))[0];
        const x=(stair.minX+stair.maxX)/2,entry={x,z:ascending?stair.minZ-1:stair.maxZ+1};
        stairTravel=onStair||(Math.hypot(e.position.x-entry.x,e.position.z-entry.z)<1.4&&Math.abs(e.position.x-x)<.6);
        goal=stairTravel?{x,z:ascending?stair.maxZ+1:stair.minZ-1}:entry;
      }
      if(goal){
        e.planIn-=dt;
        if(!stairTravel&&segmentBlocked(e.position,goal,blockers)){
          if(e.planIn<=0&&(!e.route.length||e.brain.mode==='chase'||e.investigate)){e.route=this.path(e.position,goal,upstairs);e.planIn=.9+e.id*.017;}
          while(e.route[0]&&Math.hypot(e.route[0].x-e.position.x,e.route[0].z-e.position.z)<.22)e.route.shift();
          goal=e.route[0]??null;
        }else e.route=[];
        if(e.investigate&&Math.abs(e.floor-e.destinationFloor)<.3&&Math.hypot(e.investigate.x-e.position.x,e.investigate.z-e.position.z)<.4){e.investigate=null;goal=null;}
      }
      if(!goal){
        e.planIn-=dt;
        if(!e.waypoint||Math.hypot(e.waypoint.x-e.position.x,e.waypoint.z-e.position.z)<.15||e.planIn<=0){
          const current=this.closest(e.position,upstairs);e.planIn=3;
          if(current){
            if(current.distance>.35)e.waypoint=current.point;
            else {
              const nodes=upstairs?this.upperNodes:this.nodes;
              const choices=((upstairs?this.upperGraph:this.graph).get(current.key)??[]).filter(k=>!segmentBlocked(e.position,nodes.get(k)!,blockers));
              e.step++;e.visits.set(current.key,(e.visits.get(current.key)??0)+1);
              choices.sort((a,b)=>((e.visits.get(a)??0)+(a===e.lastNode?4:0))-((e.visits.get(b)??0)+(b===e.lastNode?4:0))||((a.charCodeAt(0)+e.id+e.step)%7)-((b.charCodeAt(0)+e.id+e.step)%7));
              const next=choices[0];e.lastNode=current.key;
              e.waypoint=next?nodes.get(next)!:null;
            }
          }
        }
        goal=e.waypoint;
      }
      if(goal){
        const gx=goal.x-e.position.x,gz=goal.z-e.position.z,len=Math.hypot(gx,gz);
        const speed=e.brain.mode==='chase'?profile.chase:e.investigate?3.3*balance.speed:profile.patrol;
        if(len>.03){e.facing=Math.atan2(gx,gz);const movementWalls=stairTravel?blockers.filter(o=>!STAIRS.includes(o)):blockers;e.position=movePlayer(e.position,gx/len,gz/len,0,true,Math.min(dt,len/speed)*speed/SPRINT_SPEED,movementWalls);e.floor=floorHeightAt(e.position,e.floor);}
      }
    }
    return caught;
  }
}




