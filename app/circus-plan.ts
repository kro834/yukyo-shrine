import type {CircusPlan,CircusPoint,CircusDevice,CircusStation} from './circus-types.ts';

type Cell={x:number;z:number;kind:string};
type Obstacle={minX:number;maxX:number;minZ:number;maxZ:number};
type Layout={stage?:string;grid:Map<string,Cell>;obstacles:readonly Obstacle[];rooms?:readonly {x1:number;x2:number;z1:number;z2:number}[]};
export const CIRCUS_RING={halfExtent:32,cornerRadius:1,railGauge:.82,cartWidth:1.18,cartLength:1.8} as const;
const key=(x:number,z:number)=>x+','+z;

/** Analytic quarter, copied around the origin. The final route contains no duplicate
 * starting point. Start faces west at the southern station; yaw uses Three's +Z axis.
 */
export function circusTrackPoints(){
 const straight=31,arc=Math.PI/2,quarter=straight*2+arc,track:CircusPoint[]=[];
 for(let q=0;q<4;q++){
  const distances=[...Array.from({length:62},(_,i)=>i*.5),...Array.from({length:13},(_,i)=>straight+arc*i/12),...Array.from({length:61},(_,i)=>straight+arc+(i+1)*.5)];
  for(const distance of distances){
   let x:number,z:number;
   if(distance<straight){x=-distance;z=32;}
   else if(distance<=straight+arc){const a=Math.PI/2+distance-straight;x=-31+Math.cos(a);z=31+Math.sin(a);}
   else {x=-32;z=31-(distance-straight-arc);}
   for(let i=0;i<q;i++)[x,z]=[-z,x];
   track.push({x,z});
  }
  // The next quarter starts at the next station. Its final 0.5 m link closes this one.
  if(Math.abs(quarter-(straight+arc+30.5))>.500001)throw Error('Circus quarter sampling mismatch');
 }
 return track;
}

export function createCircusPlan(_seed:number,layout:Layout):CircusPlan{
 if(layout.stage&&layout.stage!=='circus')return {track:[],stations:[],devices:[]};
 const safe=(p:CircusPoint,radius:number)=>{
  // Sample a disk, rather than its AABB, so the round inner corner is not rejected.
  for(const [dx,dz] of [[0,0],...[0,1,2,3,4,5,6,7].map(i=>[Math.cos(i*Math.PI/4)*radius,Math.sin(i*Math.PI/4)*radius])])if(!layout.grid.has(key(Math.round((p.x+dx)/4),Math.round((p.z+dz)/4))))return false;
  return !layout.obstacles.some(o=>p.x>o.minX-radius&&p.x<o.maxX+radius&&p.z>o.minZ-radius&&p.z<o.maxZ+radius);
 };
 const track=circusTrackPoints();
 for(let i=0;i<track.length;i++){
  const a=track[i],b=track[(i+1)%track.length];
  for(let j=0;j<=4;j++){
   const p={x:a.x+(b.x-a.x)*j/4,z:a.z+(b.z-a.z)*j/4};
   if(!safe(p,.74))throw new Error(`Circus rail route intersects layout at ${p.x.toFixed(3)},${p.z.toFixed(3)}; retain the central hall ring before enclosure`);
  }
 }
 const stations:CircusStation[]=[
  {id:'circus-south',name:'南口乗り場',position:{x:0,z:32},exit:{x:0,z:30.75}},
  {id:'circus-west',name:'裏舞台乗り場',position:{x:-32,z:0},exit:{x:-30.75,z:0}},
  {id:'circus-north',name:'北幕乗り場',position:{x:0,z:-32},exit:{x:0,z:-30.75}},
  {id:'circus-east',name:'見世物小屋乗り場',position:{x:32,z:0},exit:{x:30.75,z:0}},
 ];
 for(const s of stations)if(!safe(s.exit,.46)||!safe(s.position,.74))throw Error(`Unsafe circus station ${s.id}`);
 const specs=[
  {id:'circus-turntable',name:'回転舞台',kind:'turntable' as const,position:{x:0,z:2},control:{x:0,z:5.15},yaw:0},
  {id:'circus-curtain',name:'からくり緞帳',kind:'curtain' as const,position:{x:0,z:-18},control:{x:0,z:-14.85},yaw:0},
  {id:'circus-drawbridge',name:'跳ね上げ舞台橋',kind:'drawbridge' as const,position:{x:18,z:0},control:{x:14.85,z:0},yaw:Math.PI/2},
  {id:'circus-lure',name:'呼び鈴の舞台',kind:'lure' as const,position:{x:-16,z:0},control:{x:-12.85,z:0},yaw:Math.PI/2},
 ];
 const devices:CircusDevice[]=specs.map(s=>{
  if(!safe(s.position,.46))throw Error(`Unsafe circus device ${s.id}`);
  if(!safe(s.control,.46)){
   const alternatives=[{x:s.position.x,z:s.position.z+3.15},{x:s.position.x-3.15,z:s.position.z},{x:s.position.x,z:s.position.z-3.15},{x:s.position.x+3.15,z:s.position.z}];
   const control=alternatives.find(p=>safe(p,.46));if(!control)throw Error(`No safe circus control ${s.id}`);return {...s,control};
  }
  return s;
 });
 return {track,stations,devices};
}
