import type {Obstacle,Position} from './movement.ts';
import type {DoorSpec} from './shrine-layout.ts';
export const UPPER_HEIGHT=4.8;
export const ANNEX={minX:46,maxX:94,minZ:-2,maxZ:34};
export const STAIRS=[{minX:50,maxX:54,minZ:6,maxZ:26},{minX:86,maxX:90,minZ:6,maxZ:26}];
export const upperDoors:DoorSpec[]=[58,70,82].map((x,i)=>({id:'upper-'+i,x,z:8,alongX:false,room:i===2?'upper-b':'upper-a',floor:UPPER_HEIGHT}));
export const upperPartitions:Obstacle[]=[
  {minX:57.85,maxX:82.15,minZ:1.85,maxZ:2.15},
  {minX:57.85,maxX:82.15,minZ:13.85,maxZ:14.15},
  ...[58,70,82].flatMap(x=>[{minX:x-.15,maxX:x+.15,minZ:2,maxZ:6},{minX:x-.15,maxX:x+.15,minZ:10,maxZ:14}]),
];
export const stairRails:Obstacle[]=STAIRS.flatMap(s=>[s.minX,s.maxX].map(x=>({minX:x-.1,maxX:x+.1,minZ:s.minZ,maxZ:s.maxZ})));
export const upperBarriers:Obstacle[]=[
  {minX:45.8,maxX:46.2,minZ:-2,maxZ:34},{minX:93.8,maxX:94.2,minZ:-2,maxZ:34},
  {minX:46,maxX:94,minZ:-2.2,maxZ:-1.8},{minX:46,maxX:94,minZ:33.8,maxZ:34.2},
  ...STAIRS.map(s=>({minX:s.minX,maxX:s.maxX,minZ:s.minZ-.1,maxZ:s.minZ+.1})),
];
export function floorHeightAt(p:Position,previous:number){
  const stair=STAIRS.find(s=>p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ);
  if(stair)return (p.z-stair.minZ)/(stair.maxZ-stair.minZ)*UPPER_HEIGHT;
  return previous>UPPER_HEIGHT-.3&&p.x>=ANNEX.minX&&p.x<=ANNEX.maxX&&p.z>=ANNEX.minZ&&p.z<=ANNEX.maxZ?UPPER_HEIGHT:0;
}
