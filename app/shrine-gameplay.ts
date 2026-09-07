import {EXTRA_ENEMY_PROFILES,FINALE_BALANCE,finaleDistance,finalePhase,hatredIntercept,isFinale,traitSpeed,type FinaleKind} from './enemy-traits.ts';
import {movePlayer,SPRINT_SPEED,RADIUS,type Position,type Obstacle} from './movement.ts';
import type {Cell,DoorSpec} from './shrine-layout.ts';
import {nearbyObstacles} from './spatial.ts';
import {createAreaLookup,AREA_MULTIPLIERS,type AreaColor} from './area-rules.ts';
import {SECOND_DECK,THIRD_DECK,HIGH_STAIRS,highRails,highCaps,deckFurnitureWalls,floorBand} from './vertical-layout.ts';
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
  private blockerRevision=0;
  private blockerCache=new Map<number,{revision:number;items:Obstacle[]}>();
  constructor(specs:DoorSpec[]){
    this.states=specs.map(spec=>{let progress=0;const invalidate=()=>this.blockerRevision++;return {spec,open:false,get progress(){return progress;},set progress(value:number){if((progress<.92)!==(value<.92))invalidate();progress=value;}};});
    this.frames=this.framesFor(0);
  }
  framesFor(floor=0){return this.states.filter(d=>Math.abs((d.spec.floor??0)-floor)<.5).flatMap(({spec:d})=>[-1,1].map(s=>({minX:d.x+(d.alongX?s*1.76:0)-(d.alongX?.24:.19),maxX:d.x+(d.alongX?s*1.76:0)+(d.alongX?.24:.19),minZ:d.z+(d.alongX?0:s*1.76)-(d.alongX?.19:.24),maxZ:d.z+(d.alongX?0:s*1.76)+(d.alongX?.19:.24)})));}
  blockers(floor=0){const old=this.blockerCache.get(floor);if(old?.revision===this.blockerRevision)return old.items;const items=this.states.filter(d=>d.progress<.92&&Math.abs((d.spec.floor??0)-floor)<.5).map(d=>doorBox(d.spec));this.blockerCache.set(floor,{revision:this.blockerRevision,items});return items;}
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
      if(this.lostFor>=LOSE_SIGHT_SECONDS){this.mode='patrol';this.lastSeen=null;this.reacquireDelay=.3;this.lostFor=0;}
    }
  }
}
export const ENEMY_PROFILES={...EXTRA_ENEMY_PROFILES,normal:{sight:25,nearSight:4,cone:.05,chase:8.1,patrol:3.5,hearing:88},danger:{sight:56,nearSight:7,cone:-.3,chase:9.1,patrol:4,hearing:150},listener:{sight:16,nearSight:2.5,cone:.2,chase:7.7,patrol:2.9,hearing:145},watcher:{sight:44,nearSight:3.8,cone:.6,chase:7.9,patrol:2.5,hearing:72},stalker:{sight:22,nearSight:4.8,cone:-.15,chase:8.95,patrol:3.8,hearing:65}};
export type EnemyKind=keyof typeof ENEMY_PROFILES;
type PatrolTarget={id:string;point:Position;floor:number;visits:number;lastVisited?:number};
export type Enemy={traitTime:number;flankPoint:Position|null;id:number;kind:EnemyKind;position:Position;home:Position;homeFloor:number;searchBranches:number;facing:number;brain:EnemyBrain;waypoint:Position|null;planIn:number;step:number;route:Position[];investigate:Position|null;searchTime:number;lastNode:string|null;visits:Map<string,number>;doorWait:number;floor:number;destinationFloor:number;lastSeenFloor:number;patrol:PatrolTarget|null};
/** movePlayer caps each delta at .05. Small spatial steps preserve a boss's
 * authored speed while checking the same radius-expanded collision every time.
 * The callback updates ramp height and capture at each actual travelled point.
 */
export function moveFinaleToward(position:Position,target:Position,speed:number,dt:number,obstacles:Obstacle[],onStep?:(point:Position)=>boolean){
 const dx=target.x-position.x,dz=target.z-position.z,length=Math.hypot(dx,dz);
 if(length<1e-9||speed<=0||dt<=0)return position;
 const distance=Math.min(length,speed*dt),steps=Math.max(1,Math.ceil(distance/(RADIUS*.4))),step=distance/steps;
 let next=position;
 for(let i=0;i<steps;i++){
  const moved=movePlayer(next,dx/length,dz/length,0,true,step/SPRINT_SPEED,obstacles);
  if(moved.x===next.x&&moved.z===next.z)break;
  next=moved;if(onStep?.(next))break;
 }
 return next;
}
export function openPursuedDoor(doors:Doors,e:Enemy,walls:Obstacle[],dt:number){
  const d=(e.brain.mode==='chase'||e.investigate||e.patrol)&&e.brain.mode!=='stunned'?doors.nearest(e.position,e.facing+Math.PI,walls,floorBand(e.floor)):null;
  const close=d&&!d.open&&Math.hypot(d.spec.x-e.position.x,d.spec.z-e.position.z)<1.65;
  e.doorWait=close?e.doorWait+dt:0;
  const delay=isFinale(e.kind)?FINALE_BALANCE[e.kind].doorDelay:e.brain.mode==='chase'||e.investigate?.8:1.5;
  if(close&&e.doorWait>delay){d.open=true;e.doorWait=0;if(isFinale(e.kind)){e.planIn=0;e.route=[];e.waypoint=null;}return true;}return false;
}
export class Enemies {
  nodes=new Map<string,Position>();
  graph=new Map<string,string[]>();
  actors:Enemy[];
  pressure=0;
  difficulty={enemies:true,sense:1,speed:1,search:1};
  patrolClock=0;finalKind:FinaleKind|null=null;private regularActors:Enemy[]|null=null;
  readonly patrolOwners=new Map<string,number>();
  private ownerSignature='';
  private squadCooldown=0;
  private finaleObservation:{point:Position;floor:number;velocity:Position}|null=null;
  patrolTargets:PatrolTarget[]=[];
  private walls:Obstacle[];
  private mechanismSource:Obstacle[]|null=null;
  private mechanismWalls:Obstacle[]=[];
  setMechanismBlockers(items:Obstacle[]){
    if(items===this.mechanismSource)return;this.mechanismSource=items;
    this.mechanismWalls=items.map(o=>({...o,minX:o.minX-RADIUS,maxX:o.maxX+RADIUS,minZ:o.minZ-RADIUS,maxZ:o.maxZ+RADIUS}));
  }
  private areaAt:(p:Position,floor?:number)=>AreaColor;
  private wingAt:(p:Position)=>Cell['kind']|undefined;
  private thirdWalls=[...THIRD_DECK.walls,...deckFurnitureWalls(9.6),...highRails,...highCaps];
  private thirdNodes=new Map<string,Position>();
  private thirdGraph=new Map<string,string[]>();
  private upperWalls=[...SECOND_DECK.walls,...deckFurnitureWalls(4.8),...highRails,...upperPartitions,...upperBarriers,...stairRails,...new Doors(upperDoors).framesFor(UPPER_HEIGHT)];
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
    for(const [deck,nodes,walls] of [[SECOND_DECK,this.upperNodes,this.upperWalls],[THIRD_DECK,this.thirdNodes,this.thirdWalls]] as const)for(const c of deck.cells){const p={x:c.x*4,z:c.z*4};if(HIGH_STAIRS.some(s=>p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ)||walls.some(o=>p.x>o.minX-RADIUS&&p.x<o.maxX+RADIUS&&p.z>o.minZ-RADIUS&&p.z<o.maxZ+RADIUS))continue;nodes.set(c.x+','+c.z,p);}
    for(const [key,p] of this.thirdNodes){const [x,z]=key.split(',').map(Number);this.thirdGraph.set(key,[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(x+dx)+','+(z+dz)).filter(k=>this.thirdNodes.has(k)&&!segmentBlocked(p,this.thirdNodes.get(k)!,this.thirdWalls)));}
    for(const [key,p] of this.upperNodes){const [x,z]=key.split(',').map(Number);this.upperGraph.set(key,[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(x+dx)+','+(z+dz)).filter(k=>this.upperNodes.has(k)&&!segmentBlocked(p,this.upperNodes.get(k)!,this.upperWalls)));}
    this.actors=[{x:0,z:-64},{x:-44,z:-44},{x:44,z:-80},{x:44,z:148},{x:132,z:172},{x:128,z:-116},{x:-144,z:-100},{x:-52,z:76},{x:-120,z:100},{x:100,z:-36},{x:-28,z:124},{x:92,z:148}].map((p,id)=>{const homeFloor=id===3||id===10?4.8:id===7||id===11?9.6:0,homeNodes=homeFloor>9?this.thirdNodes:homeFloor?this.upperNodes:this.nodes;const home=[...homeNodes.values()].reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b);return {traitTime:0,flankPoint:null,id,kind:id>=8?(['mire','warden','fox','pilgrim'] as const)[id-8]:id===4?'danger':(['normal','listener','watcher','stalker'] as EnemyKind[])[id%4],home:{...home},homeFloor,searchBranches:0,position:{...home},facing:0,brain:new EnemyBrain(),waypoint:null,planIn:0,step:0,route:[],investigate:null,searchTime:0,lastNode:null,visits:new Map<string,number>(),doorWait:0,floor:homeFloor,destinationFloor:homeFloor,lastSeenFloor:homeFloor,patrol:null};});
  }
  addPatrolTargets(points:{id:string;position:Position;floor:number}[]){
    if(!this.patrolTargets.length){
      const sectors=new Map<string,{point:Position;floor:number;distance:number}>();
      for(const [nodes,floor] of [[this.nodes,0],[this.upperNodes,UPPER_HEIGHT],[this.thirdNodes,9.6]] as const)for(const p of nodes.values()){
        const x=Math.floor(p.x/24),z=Math.floor(p.z/24),id=floor+':'+x+','+z,distance=Math.hypot(p.x-x*24-12,p.z-z*24-12);
        if(!sectors.has(id)||distance<sectors.get(id)!.distance)sectors.set(id,{point:p,floor,distance});
      }
      for(const [id,t] of sectors)this.patrolTargets.push({id,point:t.point,floor:t.floor,visits:0,lastVisited:0});
    }
    for(const p of points){const nearest=this.closest(p.position,p.floor);if(nearest&&!this.patrolTargets.some(t=>t.id===p.id))this.patrolTargets.push({id:p.id,point:nearest.point,floor:p.floor,visits:0,lastVisited:0});}
  }
  private distancesFrom(point:Position,floor:number){
    const graph=floor>9?this.thirdGraph:floor>1?this.upperGraph:this.graph;
    const first=this.closest(point,floor),distances=new Map<string,number>();
    if(!first)return distances;
    const queue=[first.key];distances.set(first.key,0);
    for(let i=0;i<queue.length;i++)for(const key of graph.get(queue[i])??[])if(!distances.has(key)){distances.set(key,distances.get(queue[i])!+4);queue.push(key);}
    return distances;
  }
  private targetKey(t:PatrolTarget){return Math.round(t.point.x/4)+','+Math.round(t.point.z/4);}
  private assignPatrol(e:Enemy){
    if(!this.patrolTargets.length)this.addPatrolTargets([]);
    const signature=this.actors.map(a=>a.id+':'+a.homeFloor).join('|')+':'+this.patrolTargets.length;
    if(signature!==this.ownerSignature){
      this.patrolOwners.clear();this.ownerSignature=signature;
      const fields=new Map(this.actors.map(a=>[a.id,this.distancesFrom(a.home,a.homeFloor)]));
      for(const t of this.patrolTargets){
        const local=this.actors.filter(a=>Math.abs(a.homeFloor-t.floor)<.3);
        if(!local.length)continue;
        const key=this.targetKey(t),owner=local.reduce((best,a)=>(fields.get(a.id)?.get(key)??Infinity)<(fields.get(best.id)?.get(key)??Infinity)?a:best);
        this.patrolOwners.set(t.id,owner.id);
      }
    }
    const owned=this.patrolTargets.filter(t=>this.patrolOwners.get(t.id)===e.id);
    if(!owned.length){e.patrol=null;return;}
    const minVisits=Math.min(...owned.map(t=>t.visits)),field=this.distancesFrom(e.position,e.homeFloor);
    const candidates=owned.filter(t=>t.visits===minVisits);
    candidates.sort((a,b)=>Math.floor((a.lastVisited??0)/30)-Math.floor((b.lastVisited??0)/30)||(field.get(this.targetKey(a))??Infinity)-(field.get(this.targetKey(b))??Infinity)||a.id.localeCompare(b.id));
    e.patrol=candidates[0];e.destinationFloor=e.patrol.floor;e.route=[];e.waypoint=null;e.planIn=0;
  }
  private closest(p:Position,upper:boolean|number=false){
    const nodes=typeof upper==='number'&&upper>9?this.thirdNodes:upper?this.upperNodes:this.nodes,cx=Math.round(p.x/4),cz=Math.round(p.z/4),walls=typeof upper==='number'&&upper>9?this.thirdWalls:upper?this.upperWalls:this.walls;
    const local:{key:string;point:Position;distance:number}[]=[];
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const key=(cx+dx)+','+(cz+dz),point=nodes.get(key);if(point)local.push({key,point,distance:Math.hypot(point.x-p.x,point.z-p.z)});}
    const clear=(point:Position)=>!segmentBlocked(p,point,walls)&&(!!upper||!segmentBlocked(p,point,this.mechanismWalls));
    local.sort((a,b)=>a.distance-b.distance);const nearby=local.find(c=>clear(c.point));if(nearby)return nearby;
    const candidates=Array.from(nodes,([key,point])=>({key,point,distance:Math.hypot(point.x-p.x,point.z-p.z)})).sort((a,b)=>a.distance-b.distance);
    return candidates.find(c=>clear(c.point))??null;
  }
  private path(start:Position,target:Position,upper:boolean|number=false):Position[]{
    const a=this.closest(start,upper),b=this.closest(target,upper);if(!a||!b)return [];
    const graph=typeof upper==='number'&&upper>9?this.thirdGraph:upper?this.upperGraph:this.graph,nodes=typeof upper==='number'&&upper>9?this.thirdNodes:upper?this.upperNodes:this.nodes,walls=typeof upper==='number'&&upper>9?this.thirdWalls:upper?this.upperWalls:this.walls;
    const queue=[a.key],parent=new Map<string,string|null>([[a.key,null]]);
    for(let i=0;i<queue.length&&!parent.has(b.key);i++)for(const n of graph.get(queue[i])??[])if(!parent.has(n)&&(!!upper||!segmentBlocked(nodes.get(queue[i])!,nodes.get(n)!,this.mechanismWalls))){parent.set(n,queue[i]);queue.push(n);}
    if(!parent.has(b.key))return [];
    const result:Position[]=[];let k:string|null=b.key;
    while(k&&k!==a.key){result.push(nodes.get(k)!);k=parent.get(k)??null;}
    result.reverse();if(a.distance>.3&&(!result[0]||segmentBlocked(start,result[0],walls)||!upper&&segmentBlocked(start,result[0],this.mechanismWalls)))result.unshift(a.point);return result;
  }
  hear(position:Position,floor=0){
    const balance=AREA_MULTIPLIERS[this.areaAt(position,floor)];
    let count=0;for(const e of this.actors){
      if(e.brain.mode==='stunned'||e.brain.mode==='chase'||Math.hypot(e.position.x-position.x,e.position.z-position.z)>ENEMY_PROFILES[e.kind].hearing*balance.sense*this.difficulty.sense)continue;
      const nextFloor=floor>7.2?9.6:floor>2.4?UPPER_HEIGHT:0;
      if(!e.investigate||e.destinationFloor!==nextFloor){e.planIn=Math.min(e.planIn,.03*e.id);e.route=[];}
      e.investigate={...position};e.destinationFloor=nextFloor;e.searchBranches=e.kind==='warden'?5:e.kind==='listener'?3:2;e.searchTime=Math.max((e.kind==='warden'?65:45)*balance.search*this.difficulty.search,Math.hypot(e.position.x-position.x,e.position.z-position.z)/(3.3*balance.speed)+8*balance.search);count++;
    }return count;
  }
  burst(player:Position&{y?:number},blockers:Obstacle[],floor=0,yaw=0,pitch=0){let count=0;for(const e of this.actors)if(flashHits({x:player.x,z:player.z,y:player.y??floor+1.5},e.position,floor,e.floor,yaw,pitch,blockers,e.kind==='mire'?[.22,.42,.58]:undefined)){e.brain.stun();e.route=[];e.investigate=null;e.searchBranches=0;e.searchTime=0;if(isFinale(e.kind)){e.planIn=0;e.waypoint=null;e.flankPoint=null;e.doorWait=0;this.finaleObservation=null;if(e.kind==='wrath')e.traitTime=0;}count++;}return count;}
  beginFinale(player:Position,floor:number,random:()=>number){
    if(this.finalKind)return this.finalKind;
    this.finalKind=random()<.5?'hatred':'wrath';this.regularActors=this.actors;
    const level=floorBand(floor),nodes=level>9?this.thirdNodes:level>4?this.upperNodes:this.nodes;
    const candidates=[...nodes.values()].filter(p=>Math.hypot(p.x-player.x,p.z-player.z)>=22&&Math.hypot(p.x-player.x,p.z-player.z)<=38);
    const home=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]??[...nodes.values()].reduce((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)>Math.hypot(b.x-player.x,b.z-player.z)?a:b);
    const boss:Enemy={...this.actors[0],id:12,kind:this.finalKind,home:{...home},position:{...home},homeFloor:level,floor:level,destinationFloor:level,lastSeenFloor:level,brain:new EnemyBrain(),route:[],waypoint:null,investigate:null,searchTime:0,searchBranches:0,planIn:0,traitTime:0,flankPoint:null,visits:new Map(),patrol:null,doorWait:0,lastNode:null,step:0,facing:Math.atan2(player.x-home.x,player.z-home.z)};
    this.finaleObservation=null;this.actors=[boss];this.patrolOwners.clear();this.ownerSignature='';return this.finalKind;
  }
  reset(){if(this.regularActors){this.actors=this.regularActors;this.regularActors=null;}this.finalKind=null;this.finaleObservation=null;this.squadCooldown=0;this.patrolClock=0;for(const t of this.patrolTargets){t.visits=0;t.lastVisited=0;}for(const e of this.actors){e.position={...e.home};e.traitTime=0;e.flankPoint=null;e.brain=new EnemyBrain();e.brain.reacquireDelay=4;e.waypoint=null;e.route=[];e.planIn=0;e.investigate=null;e.searchTime=0;e.doorWait=0;e.floor=e.homeFloor;e.destinationFloor=e.homeFloor;e.searchBranches=0;e.patrol=null;}}
  update(dt:number,player:Position,groundBlockers:Obstacle[],playerFloor=0,upperBlockers:Obstacle[]=this.upperWalls,detectable=true,thirdBlockers:Obstacle[]=this.thirdWalls,lightOn=detectable){
    if(!this.difficulty.enemies||!Number.isFinite(dt)||dt<=0)return false;
    if(this.finalKind){
      const old=this.finaleObservation;this.finaleObservation=null;
      if(this.actors[0].brain.stunRemaining<=0){
        const velocity={x:0,z:0};
        if(old&&Math.abs(old.floor-playerFloor)<.3){
          const dx=player.x-old.point.x,dz=player.z-old.point.z,length=Math.hypot(dx,dz);
          // Time-stop repositioning and teleports cannot become extreme lead targets.
          if(length<=SPRINT_SPEED*dt*1.25+.02){
            const rate=Math.min(SPRINT_SPEED,length/dt),blend=1-Math.exp(-dt*12);
            velocity.x=old.velocity.x+(dx/Math.max(length,.001)*rate-old.velocity.x)*blend;
            velocity.z=old.velocity.z+(dz/Math.max(length,.001)*rate-old.velocity.z)*blend;
          }
        }
        this.finaleObservation={point:{...player},floor:playerFloor,velocity};
      }
    }
    let caught=false;this.patrolClock+=dt;this.squadCooldown=Math.max(0,this.squadCooldown-dt);
    let sighting:{source:Enemy;point:Position;floor:number}|null=null;
    const transits=[...STAIRS.map(s=>({...s,footprint:s,low:0,high:4.8})),...HIGH_STAIRS.map(s=>({...s,footprint:s,low:4.8,high:9.6}))];
    const rampAt=(p:Position,height:number)=>transits.find(s=>p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ&&Math.abs(height-(s.low+(p.z-s.minZ)/(s.maxZ-s.minZ)*(s.high-s.low)))<.05);
    for(const e of this.actors){
      const upstairs=floorBand(e.floor),blockers=upstairs>9?thirdBlockers:upstairs?upperBlockers:groundBlockers;
      const dx=player.x-e.position.x,dz=player.z-e.position.z,distance=Math.hypot(dx,dz);
      const facing=(dx*Math.sin(e.facing)+dz*Math.cos(e.facing))/Math.max(.01,distance);
      const base=ENEMY_PROFILES[e.kind],balance=AREA_MULTIPLIERS[this.areaAt(e.position,e.floor)];
      const dangerScale=this.wingAt(e.position)==='yokocho'?1.3:1,pressureScale=1+Math.max(0,Math.min(1,this.pressure))*.18;
      const movementScale=Math.max(.9,balance.speed);
      const profile={...base,sight:base.sight*balance.sense*dangerScale*pressureScale*this.difficulty.sense,nearSight:base.nearSight*balance.sense,chase:Math.min(8.9,base.chase*movementScale*dangerScale*pressureScale*this.difficulty.speed),patrol:Math.max(2.6,base.patrol*movementScale*pressureScale*this.difficulty.speed)};
      const omniscient=isFinale(e.kind);
      const targetStair=omniscient?rampAt(player,playerFloor):undefined;
      const currentStair=omniscient?rampAt(e.position,e.floor):transits.find(s=>e.floor>s.low+1e-6&&e.floor<s.high-1e-6&&e.position.x>=s.minX&&e.position.x<=s.maxX&&e.position.z>=s.minZ&&e.position.z<=s.maxZ),onStair=!!currentStair;
      // A ramp footprint blocks ground navigation, but not sight along its surface.
      const sightBlockers=targetStair&&currentStair===targetStair?blockers.filter(o=>o!==targetStair.footprint):blockers;
      const sees=(omniscient||detectable&&(e.kind!=='mire'||lightOn))&&Math.abs(playerFloor-e.floor)<1&&distance<profile.sight&&(distance<profile.nearSight||facing>profile.cone)&&!lightBlocked({...e.position,y:e.floor+(e.kind==='mire'?.52:2.05)},{...player,y:playerFloor+1.5},sightBlockers);
      const previousMode=e.brain.mode,lastSeen=e.brain.lastSeen?{...e.brain.lastSeen}:null,stunAtStart=e.brain.stunRemaining;
      if(omniscient&&stunAtStart>0){if(e.kind==='wrath')e.traitTime=0;e.flankPoint=null;}
      e.brain.update(dt,sees,player);
      if(omniscient&&e.brain.mode!=='stunned'){e.brain.mode='chase';e.brain.lastSeen={...player};e.destinationFloor=playerFloor>7.2?9.6:playerFloor>2.4?UPPER_HEIGHT:0;e.lastSeenFloor=e.destinationFloor;}
      if(previousMode==='chase'&&e.brain.mode==='patrol'){e.investigate=lastSeen;e.destinationFloor=e.lastSeenFloor;e.flankPoint=null;e.searchBranches=e.kind==='warden'?5:e.kind==='danger'?3:e.kind==='watcher'?1:2;e.searchTime=14*balance.search*this.difficulty.search;e.waypoint=null;e.route=[];e.planIn=0;}
      if(sees&&e.brain.mode==='chase'){e.searchBranches=0;e.investigate=null;e.searchTime=0;e.lastSeenFloor=playerFloor>7.2?9.6:playerFloor>2.4?UPPER_HEIGHT:0;e.destinationFloor=e.lastSeenFloor;if(!sighting&&this.squadCooldown===0)sighting={source:e,point:{...e.brain.lastSeen!},floor:e.lastSeenFloor};}
      if(e.brain.mode==='stunned')continue;
      const activeDt=omniscient?Math.max(0,dt-stunAtStart):dt;
      if(activeDt<1e-9)continue;
      const oldTraitTime=e.traitTime,oldPhase=finalePhase(e.kind,e.traitTime);
      e.traitTime=e.brain.mode==='chase'?e.traitTime+activeDt:0;
      if(omniscient&&oldPhase!==finalePhase(e.kind,e.traitTime)){e.planIn=0;e.route=[];e.waypoint=null;}
      if(e.brain.mode==='chase'&&distance<.8&&Math.abs(playerFloor-e.floor)<.6&&sees){caught=true;continue;}
      e.searchTime=Math.max(0,e.searchTime-dt);if(e.searchTime===0){e.investigate=null;e.searchBranches=0;}
      if(e.brain.mode==='patrol'&&!e.investigate){
        if(e.patrol&&Math.abs(e.floor-e.patrol.floor)<.3&&Math.hypot(e.position.x-e.patrol.point.x,e.position.z-e.patrol.point.z)<.45){e.patrol.visits++;e.patrol.lastVisited=this.patrolClock;e.patrol=null;}
        if(!e.patrol)this.assignPatrol(e);else e.destinationFloor=e.patrol.floor;
      }
      let goal=e.brain.mode==='chase'?e.brain.lastSeen:e.investigate??e.patrol?.point??null;
      if(e.kind==='hatred'){
        e.flankPoint=null;
        if(goal&&!onStair&&!targetStair&&Math.abs(playerFloor-e.floor)<.3&&distance>2.5&&this.finaleObservation){
          const target=hatredIntercept(player,this.finaleObservation.velocity,e.traitTime,distance),node=this.closest(target,upstairs);
          if(node&&node.distance<2.8&&!segmentBlocked(player,target,blockers)&&(!upstairs?!segmentBlocked(player,target,this.mechanismWalls):true)){
            goal=target;e.flankPoint={...target};
          }
        }
      }
      if(e.kind==='fox'&&distance<=7)e.flankPoint=null;
      if(e.kind==='fox'&&e.brain.mode==='chase'&&sees&&goal&&distance>7){
        if(!e.flankPoint&&e.planIn<=0){const side=e.id%2?1:-1,target={x:goal.x-dz/Math.max(1,distance)*4*side,z:goal.z+dx/Math.max(1,distance)*4*side};const flank=this.closest(target,upstairs);if(flank&&flank.distance<3)e.flankPoint={...flank.point};e.planIn=1.8;}
        if(e.flankPoint){if(Math.hypot(e.flankPoint.x-e.position.x,e.flankPoint.z-e.position.z)>.65)goal=e.flankPoint;else e.flankPoint=null;}
      }
      let stairTravel=false;
      if(goal&&targetStair&&(currentStair===targetStair||!onStair&&(upstairs===targetStair.low||upstairs===targetStair.high))){
        const x=(targetStair.minX+targetStair.maxX)/2,ascending=upstairs===targetStair.low,entry={x,z:ascending?targetStair.minZ-1:targetStair.maxZ+1};
        stairTravel=currentStair===targetStair||(Math.hypot(e.position.x-entry.x,e.position.z-entry.z)<1.4&&Math.abs(e.position.x-x)<.6);
        goal=stairTravel?{...player}:entry;
      }else if(goal&&(onStair||e.destinationFloor!==upstairs)){
        const ascending=currentStair?e.destinationFloor>=currentStair.high:e.destinationFloor>upstairs;
        const stair=currentStair??transits.filter(s=>ascending?s.low===upstairs:s.high===upstairs).sort((a,b)=>Math.hypot((a.minX+a.maxX)/2-e.position.x,(ascending?a.minZ:a.maxZ)-e.position.z)-Math.hypot((b.minX+b.maxX)/2-e.position.x,(ascending?b.minZ:b.maxZ)-e.position.z))[0];
        const x=(stair.minX+stair.maxX)/2,entry={x,z:ascending?stair.minZ-1:stair.maxZ+1};
        stairTravel=onStair||(Math.hypot(e.position.x-entry.x,e.position.z-entry.z)<1.4&&Math.abs(e.position.x-x)<.6);
        goal=stairTravel?{x,z:ascending?stair.maxZ+1:stair.minZ-1}:entry;
      }
      if(goal){
        e.planIn-=activeDt;
        if(!stairTravel&&(segmentBlocked(e.position,goal,blockers)||!upstairs&&segmentBlocked(e.position,goal,this.mechanismWalls))){
          if(e.planIn<=0&&(!e.route.length||e.brain.mode==='chase'||e.investigate||!upstairs&&e.route[0]&&segmentBlocked(e.position,e.route[0],this.mechanismWalls))){e.route=this.path(e.position,goal,upstairs);e.planIn=isFinale(e.kind)?FINALE_BALANCE[e.kind].replan:.9+e.id*.017;}
          while(e.route[0]&&Math.hypot(e.route[0].x-e.position.x,e.route[0].z-e.position.z)<.22)e.route.shift();
          goal=e.route[0]??null;
        }else e.route=[];
        if(e.investigate&&Math.abs(e.floor-e.destinationFloor)<.3&&Math.hypot(e.investigate.x-e.position.x,e.investigate.z-e.position.z)<.4){e.investigate=null;goal=null;
          if(e.searchBranches>0&&e.searchTime>0){
            const current=this.closest(e.position,upstairs),nodes=upstairs>9?this.thirdNodes:upstairs?this.upperNodes:this.nodes,graph=upstairs>9?this.thirdGraph:upstairs?this.upperGraph:this.graph;
            if(current){const options=(graph.get(current.key)??[]).filter(k=>k!==e.lastNode).sort((a,b)=>(e.visits.get(a)??0)-(e.visits.get(b)??0)||((a.charCodeAt(0)+e.id)%7)-((b.charCodeAt(0)+e.id)%7));if(options[0]){e.lastNode=current.key;e.visits.set(current.key,(e.visits.get(current.key)??0)+1);e.investigate={...nodes.get(options[0])!};e.planIn=0;e.route=[];}}
            e.searchBranches--;
          }
        }
      }
      if(!goal){
        e.planIn-=activeDt;
        if(!e.waypoint||Math.hypot(e.waypoint.x-e.position.x,e.waypoint.z-e.position.z)<.15||e.planIn<=0){
          const current=this.closest(e.position,upstairs);e.planIn=omniscient?.22:3;
          if(current){
            if(current.distance>.35)e.waypoint=current.point;
            else {
              const nodes=upstairs>9?this.thirdNodes:upstairs?this.upperNodes:this.nodes;
              const choices=((upstairs>9?this.thirdGraph:upstairs?this.upperGraph:this.graph).get(current.key)??[]).filter(k=>!segmentBlocked(e.position,nodes.get(k)!,blockers));
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
        const baseSpeed=e.brain.mode==='chase'?profile.chase:e.investigate?(e.kind==='warden'?5.1:Math.max(3.6,3.3*movementScale)):profile.patrol;
        const speed=isFinale(e.kind)?finaleDistance(e.kind,oldTraitTime,activeDt,this.difficulty.speed)/activeDt:traitSpeed(e.kind,e.brain.mode==='chase',e.traitTime,baseSpeed);
        if(len>.03){
          e.facing=Math.atan2(gx,gz);const movementWalls=stairTravel?blockers.filter(o=>!STAIRS.includes(o)&&!HIGH_STAIRS.includes(o)):blockers;
          if(omniscient)e.position=moveFinaleToward(e.position,goal,speed,activeDt,movementWalls,point=>{
            e.position=point;e.floor=floorHeightAt(point,e.floor);
            if(Math.hypot(player.x-point.x,player.z-point.z)>=.8||Math.abs(playerFloor-e.floor)>=.6)return false;
            const level=floorBand(e.floor),ramp=rampAt(point,e.floor),walls=level>9?thirdBlockers:level?upperBlockers:groundBlockers;
            const sight=targetStair&&ramp===targetStair?walls.filter(o=>o!==targetStair.footprint):walls;
            if(!lightBlocked({...point,y:e.floor+2.05},{...player,y:playerFloor+1.5},sight))caught=true;
            return caught;
          });
          else {e.position=movePlayer(e.position,gx/len,gz/len,0,true,Math.min(dt,len/speed)*speed/SPRINT_SPEED,movementWalls);e.floor=floorHeightAt(e.position,e.floor);}
        }
      }
    }
    // A report is a finite memory of an actual sighting, never the hidden player's position.
    if(sighting){
      const {source,point,floor}=sighting;
      const responders=this.actors.filter(a=>a!==source&&a.brain.mode==='patrol'&&a.brain.reacquireDelay===0&&!a.investigate&&Math.abs(a.floor-floor)<.3&&Math.hypot(a.position.x-point.x,a.position.z-point.z)<56)
        .sort((a,b)=>Math.hypot(a.position.x-point.x,a.position.z-point.z)-Math.hypot(b.position.x-point.x,b.position.z-point.z)||a.id-b.id).slice(0,source.kind==='watcher'?2:1);
      for(const a of responders){a.investigate={...point};a.destinationFloor=floor;a.searchTime=12;a.searchBranches=2;a.route=[];a.waypoint=null;a.planIn=0;}
      this.squadCooldown=6;
    }
    return caught;
  }
}
