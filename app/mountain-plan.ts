import type {CircusPlan,CircusPoint} from './circus-types.ts';
import type {Cell,Room} from './shrine-layout.ts';
import {mountainHeight} from './mountain-terrain.ts';
export const MINE_SPEED=16;
export const MOUNTAIN_AREAS={ridge:'霧に沈む稜線',guide:'山腹ガイドウェイ',mine:'旧鉱山の逃走坑道',shelter:'無人の登山小屋',ore:'鉱石の選別場',reservoir:'融雪の貯水洞',summit:'雲上の観測所'} as const;
export function mountainArea(c:{kind:string;x:number;z:number}){
 if(Math.abs(c.x)===8&&Math.abs(c.z)<=46)return c.x<0&&Math.abs(c.z)<30?'mine':'guide';
 if(c.kind==='field'||c.kind==='stone')return 'ridge';
 if(c.kind==='factory'||c.kind==='cave')return 'mine';
 if(c.kind==='cistern'||c.kind==='bath')return 'reservoir';
 if(c.kind==='shop')return 'shelter';if(c.kind==='yokocho')return 'ore';return c.z>28?'summit':'guide';
}
export const mountainOutdoor=(c:{kind:string;x:number;z:number})=>['ridge','guide','summit'].includes(mountainArea(c));
export function prepareMountainLayout(grid:Map<string,Cell>,rooms:Room[]){
 // The two continuous edge routes connect all five terraces independently of
 // the shuffled branch graph. Their inner clearance also carries the railway.
 for(let z=-46;z<=46;z++)for(const x of [-8,8])if(!grid.has(x+','+z))grid.set(x+','+z,{x,z,h:4,kind:'stone'});
 for(let x=-8;x<=8;x++)for(const z of [-46,46])if(!grid.has(x+','+z))grid.set(x+','+z,{x,z,h:4,kind:'stone'});
 for(const c of grid.values())if(c.h<8)c.h=mountainOutdoor(c)?4:3.8;
 for(const r of rooms){const c=grid.get(Math.round((r.x1+r.x2)/2)+','+Math.round((r.z1+r.z2)/2))!;r.themeId='mountain-'+mountainArea(c);r.style='stone';r.h=3.8;}
}
export function createMountainPlan(layout:{grid:Map<string,Cell>;obstacles:readonly {minX:number;maxX:number;minZ:number;maxZ:number}[]}):CircusPlan{
 const raw:CircusPoint[]=[];
 // Rounded rectangle, 64 m across and 368 m from foot to summit.
 for(const [cx,cz,start] of [[31,183,0],[-31,183,Math.PI/2],[-31,-183,Math.PI],[31,-183,Math.PI*1.5]]){
  for(let i=0;i<=12;i++){const a=start+i/12*Math.PI/2;raw.push({x:cx+Math.cos(a),z:cz+Math.sin(a)});}
 }
 const track:CircusPoint[]=[];
 for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.5));for(let j=0;j<steps;j++)track.push({x:a.x+(b.x-a.x)*j/steps,z:a.z+(b.z-a.z)*j/steps});}
 const safe=(p:CircusPoint,r:number)=>layout.grid.has(Math.round(p.x/4)+','+Math.round(p.z/4))&&!layout.obstacles.some(o=>p.x>o.minX-r&&p.x<o.maxX+r&&p.z>o.minZ-r&&p.z<o.maxZ+r);
 for(const p of track)if(!safe(p,.74))throw Error('Mountain railway intersects a wall at '+p.x+','+p.z);
 const specs=[[-32,0,'旧坑口'],[-32,-76,'排水坑の退避所'],[-32,-152,'麓の積出場'],[32,-152,'登山口'],[32,-76,'一合目の分岐'],[32,0,'山腹の駅'],[32,76,'雲海の桟道'],[32,152,'山頂の観測所'],[-32,152,'尾根の帰還口'],[-32,76,'旧坑道の上口']] as const;
 const stations=specs.map(([x,z,name],i)=>({id:'mine-'+i,name,position:{x,z},exit:{x:x-Math.sign(x)*1.25,z}}));
 for(const s of stations)if(!safe(s.exit,.46))throw Error('Mountain station exit obstructed: '+s.name);
 // Start beside the central old mine, immediately reachable from the landing.
 const start=track.findIndex(p=>Math.abs(p.x+32)<.01&&Math.abs(p.z)<.3);
 const ordered=[...track.slice(start),...track.slice(0,start)];
 return {track:ordered,stations,devices:[]};
}
export const mountainAltitude=(z:number)=>Math.round(1460+mountainHeight(z));
