import type {Cell,Room} from './shrine-layout.ts';
export const AREA_THEMES=['鏡の間','香炉堂','朱柱の間','石灯籠庭','蔵座敷','水盤堂','供物庫','古書の間','鈴の間'];
export function expandAreas(grid:Map<string,Cell>,rooms:Room[],courts:{x:number;z:number;rx:number;rz:number}[]){
 const added:Room[]=[];
 const rect=(x1:number,z1:number,x2:number,z2:number,h=3.8)=>{for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++)if(!grid.has(x+','+z))grid.set(x+','+z,{x,z,h,kind:'passage'});};
 const add=(x:number,z:number,w=3,d=3)=>{const n=added.length,r:Room={id:'expansion-'+String(n+1).padStart(2,'0'),x1:x,x2:x+w-1,z1:z,z2:z+d-1,h:3.8+(n%3)*.7,style:['tatami','ritual','store','stone'][n%4] as Room['style']};rect(x,z,r.x2,r.z2,r.h);for(let xx=x;xx<=r.x2;xx++)for(let zz=z;zz<=r.z2;zz++)grid.get(xx+','+zz)!.kind='hall';added.push(r);return r;};
 const candidates:{x:number;z:number;score:number}[]=[];
 for(let x=-21;x<=19;x++)for(let z=-42;z<=-8;z++)candidates.push({x,z,score:Math.abs(x+1)+Math.abs(z+25)});
 candidates.sort((a,b)=>a.score-b.score);
 for(const {x,z} of candidates){
  if(added.length===9)break;
  if([...rooms,...added].some(r=>x+2>=r.x1-1&&x<=r.x2+1&&z+2>=r.z1-1&&z<=r.z2+1)||courts.some(c=>Math.abs(x+1-c.x)<=c.rx+1&&Math.abs(z+1-c.z)<=c.rz+1))continue;
  let empty=true;for(let dx=0;dx<3;dx++)for(let dz=0;dz<3;dz++)if(grid.has((x+dx)+','+(z+dz)))empty=false;
  const sides=[[-1,0],[3,0],[0,-1],[0,3]].filter(([dx,dz],s)=>Array.from({length:3},(_,i)=>grid.has((x+dx+(s>1?i:0))+','+(z+dz+(s<2?i:0)))).some(Boolean));
  if(empty&&sides.length>=2)add(x,z);
 }
 if(added.length!==9)throw new Error('Nine central expansion rooms could not be connected');
 // Forty-eight new chambers around a six-by-eight, multiply connected cloister.
 for(let row=0;row<6;row++)for(let col=0;col<8;col++){
  const x=-24+col*6,z=14+row*6;
  rect(x-1,z-1,x+4,z-1);rect(x-1,z+4,x+4,z+4);rect(x-1,z-1,x-1,z+4);rect(x+4,z-1,x+4,z+4);
  add(x,z,3+(col%2),3+(row%2));
 }
 rect(0,8,0,13);rect(6,8,6,13);rect(-25,13,22,13);
 rooms.push(...added);return added;
}
