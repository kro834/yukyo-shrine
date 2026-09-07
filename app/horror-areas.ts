import type {Room} from './shrine-layout.ts';
import {outerArea,buildOuterShell,type OuterMaterial,type OuterBuilder} from './outer-areas.ts';
import {buildOuterMemoriesA} from './outer-memories-a.ts';
import {buildOuterMemoriesB} from './outer-memories-b.ts';
import {ORCHESTRA_ROOMS,buildOrchestraRoom} from './orchestra-rooms.ts';
type Mat=OuterMaterial;
type Theme={id:string;name:string;floor:Mat;wall:Mat;accent:Mat;light:string};
const rows=[
 ['white-cord','白紐の結界堂','stone','plaster','paper','moon'],['inverted-dolls','逆さ雛の座敷','tatami','paper','tile','ember'],['empty-noh','無人能舞台','wood','plaster','paper','paper'],['umbrellas','置き傘の土間','stone','plaster','paper','amber'],['comb-teeth','櫛歯の間','wood','paper','wood','moon'],
 ['empty-trays','空膳の客殿','tatami','plaster','tile','amber'],['futon-mound','布団塚','tatami','paper','paper','paper'],['drying-tabi','足袋干し廊','wood','plaster','paper','moon'],['box-pillows','箱枕の間','tatami','paper','wood','amber'],['folding-screens','屏風の迷座','tatami','plaster','paper','ember'],
 ['spinning-wheel','糸車の作業蔵','wood','plaster','wood','amber'],['cocoons','繭吊り堂','wood','plaster','paper','moon'],['obi-knots','帯結びの間','tatami','paper','paper','ember'],['lattice-cell','格子影の牢','stone','plaster','rust','cold'],['empty-buckets','空桶の洗い場','stone','tile','wood','cold'],
 ['blind-windows','盲窓の土蔵','wood','plaster','wood','paper'],['sealed-jars','壺封じの納戸','stone','plaster','tile','amber'],['white-plates','白皿の祭壇','tatami','plaster','tile','moon'],['broken-masks','欠け面の収蔵室','wood','paper','tile','ember'],['chain-hoist','錆鎖の荷揚げ場','stone','plaster','rust','amber'],
 ['silent-pump','止まった揚水室','stone','tile','rust','cold'],['basket-watch','籠戸の番屋','wood','plaster','wood','paper'],['drainwalk','排水溝の回廊','stone','tile','rust','cold'],['rain-gutters','雨樋の雨宿り処','stone','plaster','rust','moon'],['boat-ribs','舟板の納屋','wood','plaster','wood','amber'],
 ['withered-flowers','供花の枯庭','stone','plaster','tile','moon'],['shadow-crossing','影踏みの渡り廊','wood','plaster','wood','paper'],['white-curtain','白幕の送り座','tatami','plaster','paper','paper'],['paper-cranes','折鶴の納め所','wood','paper','paper','amber'],['empty-kimono','抜け殻の着物廊','tatami','paper','paper','ember'],
] as const;
export const NEW_HORROR_AREAS:readonly Theme[]=rows.map(([id,name,floor,wall,accent,light])=>({id,name,floor,wall,accent,light}));
export const horrorArea=(id?:string)=>NEW_HORROR_AREAS.find(t=>t.id===id)??outerArea(id)??ORCHESTRA_ROOMS.find(t=>t.id===id);
type Builder=OuterBuilder;
/** Shared material batches, recessed corners and overhead motifs keep all doors clear. */
export function buildHorrorArea(r:Room,b:Builder,reserved=false){
 const orchestra=ORCHESTRA_ROOMS.find(t=>t.id===r.themeId);
 if(orchestra){
  const x=(r.x1+r.x2)*2,z=(r.z1+r.z2)*2;
  b.box(x,.029,z,(r.x2-r.x1+1)*4-.38,.024,(r.z2-r.z1+1)*4-.38,orchestra.floor);
  buildOrchestraRoom(r.themeId!,r,b,reserved);return;
 }
 if(buildOuterShell(r,b)){
  if(!buildOuterMemoriesA(r.themeId!,r,b,reserved))buildOuterMemoriesB(r.themeId!,r,b,reserved);
  return;
 }
 const t=horrorArea(r.themeId);if(!t)return;const n=NEW_HORROR_AREAS.indexOf(t),cx=(r.x1+r.x2)*2,cz=(r.z1+r.z2)*2,hw=(r.x2-r.x1+1)*2,hd=(r.z2-r.z1+1)*2;
 const {box,cylinder,fixture,block}=b;
 box(cx,.018,cz,hw*2-.25,.025,hd*2-.25,t.floor==='wood'?'planks':t.floor);
 for(const side of [-1,1])for(const end of [-1,1]){const x=cx+side*(hw-1.2),z=cz+end*(hd-.24);box(x,1.6,z,1.7,2.8,.035,t.wall);box(x,.35,z,1.75,.6,.06,'dark');}
 const color=({moon:'#9aaeba',ember:'#b98058',paper:'#c7bb98',cold:'#86a4a9',amber:'#ddb077'} as Record<string,string>)[t.light];
 fixture(cx+hw-1,t.light==='moon'?3:.85,cz-hd+1,color);
 box(cx+hw-1,t.light==='moon'?3:.65,cz-hd+1,.26,.48,.26,'washiLit');
 // The floor and wall signature survive when this room holds the randomized altar.
 if(reserved)return;
 for(const side of [-1,1]){
  const x=cx+side*3,z=cz+side*3,m=t.accent;
  const beam=(dx:number,y:number,dz:number,w:number,h:number,d:number,mat:Mat=m)=>box(x+dx,y,z+dz,w,h,d,mat);
  const vessel=(dx:number,y:number,dz:number,rad:number,h:number,mat:Mat=m,base=rad)=>cylinder(x+dx,y,z+dz,rad,h,mat,base);
  switch(n){
   case 0: for(let j=-2;j<=2;j++){beam(j*.25,2.3,0,.018,1.8,.018);beam(0,1.6+j*.22,0,1.2,.018,.02);}break;
   case 1: for(let tier=0;tier<3;tier++){beam(0,.4+tier*.6,-tier*.13,1.65,.08,.6,'dark');for(let j=-1;j<=1;j++){vessel(j*.5,.65+tier*.6,-tier*.13,.05,.28,'paper',.16);vessel(j*.5,.8+tier*.6,-tier*.13,.065,.1,'tile');}}break;
   case 2: beam(0,.12,0,1.8,.24,1.4,'wood');for(const j of [-1,1])beam(j*.75,1.7,-.5,.26,2.8,.055,'paper');beam(0,3.1,-.5,1.8,.12,.12,'wood');break;
   case 3: for(let j=0;j<5;j++){vessel((j-2)*.23,.75+j*.08,0,.11,1.45+j*.1,'paper',.025);vessel((j-2)*.23,1.62+j*.12,0,.016,.25,'wood');}break;
   case 4: beam(0,1.3,0,1.65,.13,.15);for(let j=0;j<10;j++)beam(-.72+j*.16,1.85+(j%3)*.05,0,.045,1,.08);break;
   case 5: for(const j of [-.48,.48]){beam(j,.22,0,.7,.08,.65,'dark');vessel(j,.32,0,.16,.05,'tile');beam(j-.3,.13,0,.05,.2,.5,'wood');}break;
   case 6: for(let j=0;j<6;j++){beam(j%2?.07:-.08,.12+j*.16,0,1.45-j*.05,.15,1.05,'paper');beam(-.5,.205+j*.16,0,.025,.018,1,'rope');}break;
   case 7: beam(0,3.25,0,1.7,.02,.02,'rope');for(let j=0;j<4;j++){beam(-.6+j*.4,2.95,0,.14,.48,.05,'paper');beam(-.55+j*.4,2.75,.03,.22,.1,.1,'paper');}break;
   case 8: for(let j=0;j<4;j++){beam(-.55+(j%2)*1.05,.2,Math.floor(j/2)*.65-.3,.5,.4,.3,'dark');vessel(-.55+(j%2)*1.05,.43,Math.floor(j/2)*.65-.3,.13,.14,'paper');}break;
   case 9: for(let j=0;j<5;j++){beam(-.68+j*.34,1.25,j%2?.1:-.1,.33,2.4,.05,'paper');beam(-.85+j*.34,1.25,0,.025,2.5,.25,'wood');}break;
   case 10: for(let j=0;j<12;j++){const a=j*Math.PI/6;beam(Math.cos(a)*.52,1.25+Math.sin(a)*.52,0,.08,.1,.09,'wood');}beam(0,1.25,0,1.12,.06,.07,'wood');beam(0,1.25,0,.06,1.12,.07,'wood');vessel(.6,.25,.3,.2,.45,'rope');break;
   case 11: for(let j=-2;j<=2;j++){vessel(j*.28,2.62-(j%2)*.2,0,.11,.55,'paper',.055);beam(j*.28,3.16,0,.012,.55,.012,'rope');}break;
   case 12: for(let j=0;j<3;j++){beam(0,1+j*.58,0,1.2,.25,.08,'paper');beam(0,1+j*.58,.07,.2,.55,.08,'paper');}break;
   case 13: for(let j=-4;j<=4;j++)beam(j*.2,1.4,0,.035,2.8,.035,'rust');for(const y of [.12,1.4,2.72])beam(0,y,0,1.7,.06,.1,'rust');break;
   case 14: for(const j of [-.46,.46]){vessel(j,.29,0,.32,.52,'wood');vessel(j,.565,0,.28,.008,'dark');vessel(j,.3,0,.335,.035,'rust');}break;
   case 15: beam(0,1.6,-.08,1.65,1.8,.035,'washiLit');for(let j=0;j<5;j++)beam(0,.85+j*.35,0,1.7,.31,.08,'wood');break;
   case 16: for(let j=-1;j<=1;j++){vessel(j*.52,.43,0,.17,.68,'tile',.27);vessel(j*.52,.82,0,.15,.13,'paper');beam(j*.52,.9,0,.32,.04,.28,'rope');}break;
   case 17: for(let j=-2;j<=2;j++)for(let k=0;k<3+Math.abs(j);k++)vessel(j*.32,.1+k*.055,0,.14,.035,'tile');break;
   case 18: for(let j=-1;j<=1;j++){beam(j*.5,1.4,0,.045,2.5,.08,'wood');vessel(j*.5,1.6,0,.12,.33,'tile',.095);beam(j*.5-.04,1.66,.115,.025,.04,.015,'dark');beam(j*.5+.04,1.66,.115,.025,.04,.015,'dark');}break;
   case 19: beam(0,3.1,0,1.5,.18,.25,'rust');for(let j=0;j<12;j++){beam(0,2.85-j*.12,j%2?.025:-.025,.07,.09,.065,'rust');}beam(0,.25,0,1.2,.5,.9,'wood');break;
   case 20: for(const j of [-.4,.4]){vessel(j,.62,0,.23,1.1,'rust');vessel(j,1.95,0,.055,1.7,'rust');beam(j,2.78,0,.4,.12,.14,'rust');}break;
   case 21: beam(0,.5,0,1.7,.08,.9,'wood');for(let j=-3;j<=3;j++)beam(j*.22,1,0,.025,1,.03,'wood');beam(0,1.52,0,1.6,.07,.45,'wood');break;
   case 22: beam(0,.06,0,1.8,.02,.7,'dark');for(let j=-5;j<=5;j++)beam(j*.16,.075,0,.035,.018,.7,'rust');break;
   case 23: beam(0,3,0,1.8,.15,.26,'rust');for(let j=-3;j<=3;j++)beam(j*.25,2.05+(j%2)*.3,0,.012,1.6,.012,'water');break;
   case 24: for(let j=-3;j<=3;j++){beam(j*.23,.6,.3,.065,1.1,.065,'wood');beam(j*.23,1.1,0,.065,.08,.65,'wood');}beam(0,.1,0,1.65,.16,.8,'wood');break;
   case 25: for(let j=-2;j<=2;j++){vessel(j*.3,.23,0,.1,.35,'tile');beam(j*.3,.65,0,.018,.6,.018,'rope');beam(j*.3+.06,.74,.03,.14,.018,.06,'rope');}break;
   case 26: for(let j=-4;j<=4;j++){beam(j*.19,3.08,0,.08,.1,1.7,'wood');beam(j*.19,.043,0,.08,.006,1.7,'dark');}break;
   case 27: for(let j=0;j<4;j++){beam(-.6+j*.4,1.8,(j%2)*.2,.35,2.5,.025,'paper');beam(-.6+j*.4,3.1,0,.012,.2,.012,'rope');}break;
   case 28: for(let j=-2;j<=2;j++){beam(j*.32,2.4+Math.abs(j)*.17,0,.24,.018,.1,'paper');beam(j*.32,2.45+Math.abs(j)*.17,0,.05,.13,.14,'paper');beam(j*.32,2.85,0,.012,.6,.012,'rope');}break;
   case 29: beam(0,1.4,0,.55,1.6,.06,'paper');beam(0,2.13,0,1.55,.38,.075,'paper');beam(0,1.52,.04,.58,.1,.06,'rope');beam(0,2.8,0,.02,.7,.02,'rope');break;
  }
  // Corner objects are outside every room's central circulation cross.
  if(![0,7,11,23,26,28].includes(n))block(x,z,1.85,1.5,2.5);
 }
}
