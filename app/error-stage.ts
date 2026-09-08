import type {Room} from './shrine-layout.ts';
import type {OuterBuilder,OuterMaterial} from './outer-areas.ts';
import {seededRandom} from './seeded-random.ts';
export const ERROR_ROOMS=[
 {id:'error-noh',name:'無終の能舞台',floor:'planks',wall:'dark',accent:'red',light:'#b77861'},
 {id:'error-mirror',name:'鏡裏の間',floor:'wood',wall:'plaster',accent:'black',light:'#c0bbaa'},
 {id:'error-dressing',name:'誰もいない楽屋',floor:'tatami',wall:'paper',accent:'dark',light:'#bca27c'},
 {id:'error-masks',name:'返らぬ面蔵',floor:'stone',wall:'plaster',accent:'wood',light:'#bd8d77'},
 {id:'error-bridge',name:'戻り橋掛かり',floor:'planks',wall:'dark',accent:'red',light:'#b6796a'},
 {id:'error-seam',name:'縫い閉じの座敷',floor:'tatami',wall:'paper',accent:'rope',light:'#b8ac93'},
] as const;
export function assignErrorRooms(rooms:Room[],seed:number){
 const random=seededRandom(seed^0x6e0e62);
 rooms.forEach((room,i)=>{const theme=ERROR_ROOMS[(i+Math.floor(random()*3))%ERROR_ROOMS.length];room.themeId=theme.id;room.style=theme.floor==='tatami'?'tatami':theme.floor==='stone'?'stone':'ritual';});
}
/** Scenic irregularities occupy room corners, while the door-to-door cross stays clear. */
export function buildErrorRoom(room:Room,b:OuterBuilder,reserved=false){
 const theme=ERROR_ROOMS.find(t=>t.id===room.themeId);if(!theme)return false;
 const x=(room.x1+room.x2)*2,z=(room.z1+room.z2)*2,hw=(room.x2-room.x1+1)*2,hd=(room.z2-room.z1+1)*2;
 const {box,cylinder,fixture,block}=b;
 box(x,.029,z,hw*2-.34,.026,hd*2-.34,theme.floor);
 const ceiling=Math.min(3.58,room.h-.12);
 box(x,ceiling,z,hw*2,.12,hd*2,'dark');
 for(let dx=-hw+.5;dx<hw;dx+=2)box(x+dx,ceiling-.11,z,.11,.13,hd*2-.2,'wood');
 // Four separate wall fragments expose worn layers, without covering a central doorway.
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const cx=x+sx*(hw-1.25),cz=z+sz*(hd-.19);
  box(cx,1.65,cz,1.85,2.95,.065,theme.wall);
  box(cx,3.03,cz,1.98,.10,.10,'red');
  for(let j=0;j<5;j++)box(cx-.74+j*.37,1.57,cz-sz*.065,.028,2.55,.026,theme.accent);
 }
 fixture(x-hw+1.0,.86,z-hd+1,theme.light);box(x-hw+1,.62,z-hd+1,.22,.45,.22,'washiLit');
 if(reserved)return true;
 const corner=(sx:number,sz:number,mat:OuterMaterial)=>{
  const cx=x+sx*(hw-1.7),cz=z+sz*(hd-1.35);
  box(cx,.22,cz,1.55,.44,1.08,mat);block(cx,cz,1.65,1.18,.6);return {cx,cz};
 };
 if(theme.id==='error-noh'||theme.id==='error-bridge'){
  for(const side of [-1,1]){const {cx,cz}=corner(side,-1,'wood');
   for(const s of [-1,1])box(cx+s*.62,1.65,cz-.4,.09,2.8,.09,'red');
   box(cx,3.0,cz-.4,1.4,.10,.13,'red');
   // Suspended strips vary in length; their bottom remains above the walking headroom.
   for(let j=0;j<5;j++)box(cx-.52+j*.26,2.69-(j%2)*.055,cz-.36,.18,.45+(j%2)*.11,.018,j%2?'dark':'paper');
  }
 }else if(theme.id==='error-mirror'){
  for(const side of [-1,1]){const {cx,cz}=corner(side,1,'dark');box(cx,1.51,cz,1.30,2.2,.12,'black');box(cx,1.51,cz-.07,1.12,2.02,.025,'steel');for(const s of [-1,1])box(cx+s*.62,1.5,cz-.105,.04,2.22,.04,'red');}
 }else if(theme.id==='error-dressing'){
  for(const side of [-1,1]){const {cx,cz}=corner(side,-1,'wood');box(cx,.88,cz,1.55,.10,.82,'dark');for(let j=0;j<3;j++){cylinder(cx-.46+j*.46,1.02,cz,.07,.18,'paper');box(cx-.46+j*.46,.99,cz+.24,.25,.025,.15,'wood');}}
 }else if(theme.id==='error-masks'){
  for(const side of [-1,1]){const {cx,cz}=corner(side,1,'dark');for(let tier=0;tier<3;tier++){box(cx,.64+tier*.6,cz,1.6,.08,.72,'wood');for(let j=0;j<3;j++){box(cx-.47+j*.47,.85+tier*.6,cz,.35,.34,.43,'dark');box(cx-.47+j*.47,.85+tier*.6,cz-.224,.29,.27,.018,'paper');}}}
 }else{
  for(const side of [-1,1]){const {cx,cz}=corner(side,1,'dark');box(cx,1.6,cz,1.5,2.1,.08,'paper');for(let j=0;j<8;j++){box(cx-.62+j*.18,1.6,cz-.052,.013,2.06,.013,'rope');box(cx, .76+j*.24,cz-.058,1.46,.013,.013,'rope');}}
 }
 return true;
}
