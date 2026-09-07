import type {Cell,DoorSpec} from './shrine-layout.ts';
import type {Obstacle,Position} from './movement.ts';
export const THIRD_HEIGHT=9.6;
export const HIGH_STAIRS=[{minX:-54,maxX:-50,minZ:102,maxZ:126},{minX:42,maxX:46,minZ:102,maxZ:126}];
export const highRails:Obstacle[]=HIGH_STAIRS.flatMap(s=>[s.minX,s.maxX].map(x=>({minX:x-.1,maxX:x+.1,minZ:s.minZ,maxZ:s.maxZ})));
export const highCaps:Obstacle[]=HIGH_STAIRS.map(s=>({minX:s.minX,maxX:s.maxX,minZ:s.minZ-.1,maxZ:s.minZ+.1}));
export const FLOOR_THEMES=['石蔵','灯籠廊','薬棚の間','朱塗りの間','古道具蔵','濡れ縁','祭具庫','鏡廊'];
function makeDeck(level:number){
 const grid=new Map<string,Cell>();
 const rect=(x1:number,z1:number,x2:number,z2:number)=>{for(let x=x1;x<=x2;x++)for(let z=z1;z<=z2;z++)grid.set(x+','+z,{x,z,h:4.3,kind:'passage'});};
 for(const x of [-25,-13,-1,11,22])rect(x,13,x,48);
 for(const z of [13,25,37,48])rect(-25,z,22,z);
 // Twelve distinct courts, joined on all four sides; their smaller chambers
 // alternate with narrow corridors rather than repeating one enormous interior.
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  const x=-19+col*12,z=19+row*12;
  rect(x-2,z-2,x+2,z+2);rect(x,13+row*12,x,Math.min(48,z+6));rect(-25+col*12,z,Math.min(22,x+6),z);
 }
 if(level===1)rect(20,8,20,13);
 const doors:DoorSpec[]=[],walls:Obstacle[]=[];
 for(const c of grid.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  if(grid.has((c.x+dx)+','+(c.z+dz)))continue;
  if(level===1&&c.x===20&&c.z===8&&dz===-1)continue;
  const x=c.x*4+dx*2,z=c.z*4+dz*2;walls.push({minX:x-(dx?.15:2),maxX:x+(dx?.15:2),minZ:z-(dz?.15:2),maxZ:z+(dz?.15:2)});
 }
 return {grid,cells:[...grid.values()],walls,doors};
}
export const SECOND_DECK=makeDeck(1),THIRD_DECK=makeDeck(2);
export const floorBand=(height:number)=>height>=9.3?9.6:height>=4.5?4.8:0;
export function deckContains(p:Position,level:number){return (level>7?THIRD_DECK:SECOND_DECK).grid.has(Math.round(p.x/4)+','+Math.round(p.z/4));}
export function deckTheme(p:Position,level:number){return FLOOR_THEMES[((Math.floor((p.x+100)/24)+Math.floor((p.z-52)/24)*3+level*3)%FLOOR_THEMES.length+FLOOR_THEMES.length)%FLOOR_THEMES.length];}
export const deckFurnitureWalls=(floor:number):Obstacle[]=>Array.from({length:12},(_,i)=>{const x=(-19+(i%4)*12)*4,z=(19+Math.floor(i/4)*12)*4;return [-1,1].map(side=>({minX:x+side*7-1,maxX:x+side*7+1,minZ:z+6.5,maxZ:z+7.9,minY:floor,maxY:floor+2.9}));}).flat();

