import type {Room} from './shrine-layout.ts';
import type {StageId} from './stage-profile.ts';
import {seededRandom} from './seeded-random.ts';
import {belowUpperDeck} from './ground-clearance.ts';

export type OuterMaterial='planks'|'wood'|'plaster'|'stone'|'rust'|'tatami'|'paper'|'tile'|'rope'|'dark'|'gold'|'washiLit'|'water'|'red'|'black'|'steel'|'candyRed'|'candyBlue'|'candyYellow';
export type OuterBuilder={
 box:(x:number,y:number,z:number,w:number,h:number,d:number,m:OuterMaterial)=>void;
 cylinder:(x:number,y:number,z:number,r:number,h:number,m:OuterMaterial,rb?:number)=>void;
 fixture:(x:number,y:number,z:number,color:string)=>void;
 block:(x:number,z:number,w:number,d:number,h?:number)=>void;
};
type Theme={id:string;name:string;floor:OuterMaterial;wall:OuterMaterial;accent:OuterMaterial;light:string};
export const OUTER_MEMORY_AREAS:readonly Theme[]=[
 {id:'outer-last-station',name:'終電の去った木造駅',floor:'planks',wall:'plaster',accent:'wood',light:'#c4a477'},
 {id:'outer-old-school',name:'夕暮れの廃校舎',floor:'planks',wall:'plaster',accent:'dark',light:'#c9ae88'},
 {id:'outer-silent-cinema',name:'閉館した銀映館',floor:'planks',wall:'dark',accent:'red',light:'#b99873'},
 {id:'outer-last-festival',name:'祭りのあとの縁日',floor:'stone',wall:'wood',accent:'red',light:'#c89a65'},
 {id:'outer-rain-inn',name:'雨待ちの旧旅籠',floor:'tatami',wall:'paper',accent:'wood',light:'#c1a07a'},
 {id:'outer-bathhouse',name:'忘れ湯の浴場',floor:'tile',wall:'tile',accent:'rust',light:'#95afb0'},
 {id:'outer-post-office',name:'宛先のない郵便局',floor:'planks',wall:'plaster',accent:'gold',light:'#c4aa7d'},
 {id:'outer-record-parlor',name:'夕凪の蓄音室',floor:'planks',wall:'paper',accent:'dark',light:'#b9a083'},
];
export const outerArea=(id?:string)=>OUTER_MEMORY_AREAS.find(t=>t.id===id);

/** Only themes change: generation, room ordering, bead routes and the altar RNG stay intact. */
export function assignOuterAreas(rooms:Room[],seed:number,stage:StageId){
 if(stage!=='outer')return;
 const random=seededRandom(seed^0x714ee2),sector=(r:Room)=>`${Math.round((r.x1+r.x2)/2/19)},${Math.round((r.z1+r.z2)/2/19)}`;
 const candidates=rooms.filter(r=>!r.themeId&&!belowUpperDeck(r.x1*4-2,r.x2*4+2,r.z1*4-2,r.z2*4+2)).map(room=>({room,rank:random(),large:room.x2-room.x1>2||room.z2-room.z1>2})).sort((a,b)=>Number(b.large)-Number(a.large)||a.rank-b.rank);
 const used=new Set<string>();let index=0;
 for(const {room} of candidates){
  const key=sector(room);if(used.has(key))continue;
  room.themeId=OUTER_MEMORY_AREAS[index++].id;used.add(key);
  if(index===OUTER_MEMORY_AREAS.length)return;
 }
 throw new Error('Not enough separate rooms for Outer memory areas');
}

/** A complete low ceiling and weathered corner linings turn outdoor rooms into old interiors. */
export function buildOuterShell(r:Room,b:OuterBuilder){
 const theme=outerArea(r.themeId);if(!theme)return false;
 const cx=(r.x1+r.x2)*2,cz=(r.z1+r.z2)*2,hw=(r.x2-r.x1+1)*2,hd=(r.z2-r.z1+1)*2,ceiling=Math.min(3.72,r.h-.08);
 const {box,fixture}=b;
 // Above the field's14mm relief; no coplanar floor patches.
 box(cx,.028,cz,hw*2-.38,.024,hd*2-.38,theme.floor);
 box(cx,ceiling,cz,hw*2,.10,hd*2,'planks');
 for(let dx=-hw+.24;dx<hw;dx+=2)box(cx+dx,ceiling-.10,cz,.10,.13,hd*2-.3,'wood');
 for(const side of [-1,1]){
  box(cx,ceiling-.10,cz+side*(hd-.24),hw*2-.3,.13,.12,'wood');
  for(const end of [-1,1]){
   const x=cx+side*(hw-1.52),z=cz+end*(hd-.22);
   box(x,1.62,z,2.44,3.06,.025,theme.wall);
   for(const y of [.13,.84,2.99])box(x,y,z-end*.035,2.48,.085,.055,'wood');
   for(const dx of [-1.21,1.21])box(x+dx,1.57,z-end*.036,.07,3.04,.055,'wood');
   // Waist boards and seams use actual depth rather than painted dark stripes.
   for(let dx=-1.12;dx<1.2;dx+=.25)box(x+dx,.47,z-end*.05,.235,.62,.04,theme.accent==='red'?'dark':'wood');
  }
 }
 // Two modest shaded wall lanterns illuminate furniture without flooding the whole room.
 for(const side of [-1,1]){
  const x=cx+side*(hw-1),z=cz+hd-.42,y=2.58;
  box(x,y,z,.23,.36,.20,'washiLit');
  for(const dx of [-.13,.13])box(x+dx,y,z,.025,.41,.24,'wood');
  for(const dy of [-.20,.20])box(x,y+dy,z,.29,.025,.25,'wood');
  fixture(x,y,z-.17,theme.light);
 }
 return true;
}
