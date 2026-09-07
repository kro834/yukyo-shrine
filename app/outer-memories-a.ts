/** Four closed, very old public places made from shared world materials. */
export type OuterMemoryMat='planks'|'wood'|'plaster'|'stone'|'rust'|'tatami'|'paper'|'tile'|'rope'|'dark'|'gold'|'washiLit'|'water'|'red'|'black'|'steel'|'candyRed'|'candyBlue'|'candyYellow';
export type OuterMemoryRoom={x1:number;x2:number;z1:number;z2:number;h:number};
export type OuterMemoryBuilder={
 box:(x:number,y:number,z:number,w:number,h:number,d:number,m:OuterMemoryMat)=>void;
 cylinder:(x:number,y:number,z:number,r:number,h:number,m:OuterMemoryMat,rb?:number)=>void;
 fixture:(x:number,y:number,z:number,color:string)=>void;
 block:(x:number,z:number,w:number,d:number,h?:number)=>void;
};
export const OUTER_MEMORIES_A=['outer-last-station','outer-old-school','outer-silent-cinema','outer-last-festival'] as const;

/** Returns true for a handled id, including a reserved altar room. No floor,
 * perimeter trim, lettering, texture allocations, or central-cross furniture.
 * Every visible prop and collider stays 2.65..5.45m from BOTH room centre axes.
 */
export function buildOuterMemoriesA(id:string,r:OuterMemoryRoom,b:OuterMemoryBuilder,reserved=false):boolean{
 if(!(OUTER_MEMORIES_A as readonly string[]).includes(id))return false;
 if(reserved)return true;
 const hw=(r.x2-r.x1+1)*2,hd=(r.z2-r.z1+1)*2;
 if(hw<6||hd<6||r.h<3.15)return true;
 const cx=(r.x1+r.x2)*2,cz=(r.z1+r.z2)*2;
 const group=(sx:number,sz:number,swap=false)=>{
  const point=(u:number,v:number)=>swap?[cx+sx*(4.05+v),cz+sz*(4.05+u)]:[cx+sx*(4.05+u),cz+sz*(4.05+v)];
  return {
   box:(u:number,y:number,v:number,w:number,h:number,d:number,m:OuterMemoryMat)=>{const [x,z]=point(u,v);b.box(x,y,z,swap?d:w,h,swap?w:d,m);},
   cylinder:(u:number,y:number,v:number,rad:number,h:number,m:OuterMemoryMat,rb=rad)=>{const [x,z]=point(u,v);b.cylinder(x,y,z,rad,h,m,rb);},
   block:(u:number,v:number,w:number,d:number,h:number)=>{const [x,z]=point(u,v);b.block(x,z,swap?d:w,swap?w:d,h);},
   fixture:(u:number,y:number,v:number,color:string)=>{const [x,z]=point(u,v);b.fixture(x,y,z,color);},
  };
 };
 type Group=ReturnType<typeof group>;
 const bench=(g:Group,u:number,v:number,width=2.45)=>{
  // Individual seat/back slats, two trestles, foot rail and iron bolt heads.
  for(let i=0;i<5;i++)g.box(u,.46,v-.225+i*.112,width,.058,.092,'planks');
  for(let i=0;i<4;i++)g.box(u,.69+i*.105,v+.27,width,.078,.054,'wood');
  for(const side of [-1,1]){
   const x=u+side*(width/2-.18);
   g.box(x,.235,v,.11,.45,.57,'wood');g.box(x,.74,v+.26,.085,.54,.08,'wood');
   g.box(x,.14,v,.18,.085,.6,'dark');g.box(x,.48,v-.284,.035,.035,.015,'rust');
  }
  g.box(u,.18,v+.1,width-.22,.085,.08,'wood');
  g.block(u,v+.012,width,.61,1.045);
 };
 const caseBox=(g:Group,u:number,y:number,v:number,w:number,h:number,d:number,m:OuterMemoryMat='dark')=>{
  g.box(u,y+h/2,v,w,h,d,m);g.box(u,y+h-.025,v,w+.012,.04,d+.012,'wood');
  for(const side of [-1,1]){
   g.box(u+side*w*.3,y+h/2,v-d/2-.009,.032,h,.022,'rope');
   g.box(u+side*w*.3,y+h+.002,v,.032,.018,d,'rope');
   g.box(u+side*w*.3,y+h*.7,v-d/2-.022,.07,.055,.012,'rust');
  }
  g.box(u,y+h/2,v-d/2-.025,.15,.045,.035,'wood');
 };
 const lantern=(g:Group,u:number,v:number,y:number,lit=false)=>{
  g.cylinder(u,y,v,.115,.29,lit?'washiLit':'paper',.115);
  for(const sy of [-1,1])g.cylinder(u,y+sy*.155,v,.122,.026,'dark');
  g.box(u,(y+3.02)/2+.08,v,.012,3.02-y-.16,.012,'rope');
 };
 const windowPartition=(g:Group)=>{
  // A surviving timber partition, grounded below the opaque old window panes.
  g.box(0,.62,1.18,2.56,1.24,.09,'planks');g.block(0,1.18,2.56,.09,2.84);
  g.box(0,2.015,1.17,2.43,1.42,.035,'paper');
  for(const u of [-1.26,0,1.26])g.box(u,2.03,1.12,.052,1.64,.08,'wood');
  for(const y of [1.24,2.03,2.82])g.box(0,y,1.12,2.58,.06,.09,'wood');
  for(const u of [-.63,.63])g.box(u,2.03,1.12,.032,1.53,.055,'wood');
  for(const u of [-1.12,1.12]){g.box(u,.06,1.12,.2,.12,.4,'wood');g.block(u,1.12,.2,.4,.12);}
 };
 const stool=(g:Group,u:number,v:number)=>{
  g.box(u,.47,v,.43,.065,.43,'wood');
  for(const x of [-.16,.16])for(const z of [-.16,.16])g.box(u+x,.23,v+z,.055,.46,.055,'wood');
  for(const x of [-.16,.16])g.box(u+x,.15,v,.045,.045,.35,'wood');
  g.block(u,v,.43,.43,.503);
 };

 if(id==='outer-last-station'){
  const nw=group(-1,-1),sw=group(-1,1,true),ne=group(1,-1),se=group(1,1);
  bench(nw,0,-.7);bench(nw,0,.25);windowPartition(nw);
  bench(sw,0,-.7);bench(sw,0,.25);windowPartition(sw);
  // Ticket counter with a real low service opening and fine upper grille.
  ne.box(0,.465,.35,2.52,.93,.76,'planks');ne.box(0,.97,.31,2.65,.1,.89,'wood');
  ne.block(0,.31,2.65,.89,1.02);
  for(const u of [-1.25,1.25]){ne.box(u,1.56,.64,.095,2.96,.12,'wood');ne.block(u,.64,.095,.12,3.04);}
  ne.box(0,2.98,.64,2.61,.12,.15,'wood');
  for(let i=-6;i<=6;i++)ne.box(i*.183,2.24,.64,.025,1.36,.035,'rust');
  for(const y of [1.56,2.25,2.91])ne.box(0,y,.64,2.43,.035,.045,'steel');
  // The empty opening under the grille is intentional; the counter remains solid.
  ne.box(0,1.052,-.02,.5,.055,.32,'dark');ne.box(0,1.087,-.02,.39,.012,.23,'paper');
  ne.box(-.96,1.15,.22,.2,.23,.2,'dark');ne.cylinder(-.96,1.29,.22,.075,.04,'gold');
  for(const u of [-.64,.64])ne.box(u,.47,-.045,.035,.81,.025,'wood');
  lantern(ne,.88,.72,2.66,true);ne.fixture(.86,2.6,.4,'#d6b182');
  // Trunk rack: open shelving, luggage straps, worn handles and two empty bays.
  for(const u of [-1.16,1.16]){se.box(u,1.22,.23,.1,2.44,1.75,'wood');se.block(u,.23,.1,1.75,2.44);}
  for(const y of [.14,.88,1.62,2.36]){
   for(let i=0;i<5;i++)se.box(0,y,-.5+i*.35,2.3,.06,.27,'planks');
   se.block(0,.2,2.3,1.67,y+.03);
  }
  caseBox(se,-.55,.18,.03,.79,.5,.66);caseBox(se,.51,.18,.3,.82,.56,.77,'wood');
  caseBox(se,-.31,.92,.26,1.34,.46,.84);caseBox(se,.63,1.66,.43,.67,.45,.55);
  return true;
 }

 if(id==='outer-old-school'){
  const deskAndChair=(g:Group,u:number,v:number)=>{
   g.box(u,.745,v,.89,.065,.56,'planks');g.box(u,.635,v+.02,.78,.045,.46,'wood');
   for(const x of [-.345,.345])for(const z of [-.19,.19])g.box(u+x,.35,v+z,.058,.7,.058,'wood');
   for(const x of [-.345,.345])g.box(u+x,.17,v,.047,.045,.4,'wood');
   g.box(u,.69,v+.22,.78,.085,.044,'wood');g.block(u,v,.89,.56,.778);
   const cv=v+.59;
   g.box(u,.425,cv,.44,.055,.44,'wood');g.box(u,.735,cv+.204,.44,.16,.042,'wood');
   for(const x of [-.165,.165])for(const z of [-.165,.165])g.box(u+x,.205,cv+z,.045,.41,.045,'wood');
   for(const x of [-.165,.165])g.box(u+x,.63,cv+.185,.045,.46,.045,'wood');
   g.block(u,cv+.018,.44,.476,.86);
  };
  for(const sx of [-1,1]){
   const g=group(sx,1);
   for(const u of [-.62,.62])for(const v of [-.98,.27])deskAndChair(g,u,v);
   // Unmarked exercise books; no raster labels or lettering.
   g.box(-.64,.786,-1,.25,.018,.2,'paper');g.box(.65,.786,.22,.22,.018,.18,'paper');
  }
  const nw=group(-1,-1),ne=group(1,-1);
  // Blank chalkboard on its surviving frame, with chalk trough and eraser.
  nw.box(0,2.05,.93,2.42,1.15,.065,'black');
  nw.block(0,.93,2.42,.065,2.625);
  for(const u of [-1.245,1.245]){nw.box(u,1.415,.95,.075,2.83,.11,'wood');nw.block(u,.95,.075,.11,2.83);}
  for(const y of [1.43,2.665])nw.box(0,y,.91,2.56,.065,.115,'wood');
  nw.box(0,1.4,.78,2.54,.07,.27,'wood');nw.box(.65,1.452,.77,.17,.037,.075,'dark');
  // Teacher's desk: panelled pedestal and open knee recess, separate footprints.
  nw.box(0,.84,-.44,1.95,.075,.75,'planks');
  nw.box(-.7,.4,-.44,.5,.8,.68,'wood');nw.block(-.7,-.44,.5,.68,.88);
  for(const u of [.62,.84]){nw.box(u,.4,-.44,.075,.8,.64,'wood');nw.block(u,-.44,.075,.64,.88);}
  nw.block(0,-.44,1.95,.75,.88);
  for(const y of [.26,.5,.72]){nw.box(-.7,y,-.793,.43,.185,.027,'planks');nw.box(-.7,y,-.817,.105,.025,.022,'rust');}
  nw.box(0,.45,-.125,1.4,.62,.046,'wood');stool(nw,.04,.26);
  nw.box(-.05,.897,-.43,.36,.035,.25,'paper');
  nw.box(.1,2.82,.6,.35,.18,.22,'washiLit');nw.box(.1,2.92,.6,.4,.025,.26,'wood');nw.fixture(.1,2.82,.6,'#bdb38f');
  // Open shoe/book cupboard, distinct small compartments and a washing shelf.
  const top=2.72;
  for(const u of [-1.24,1.24])ne.box(u,top/2,.66,.085,top,1.03,'wood');
  ne.box(0,1.37,1.145,2.48,2.67,.055,'planks');
  for(const y of [.12,.77,1.42,2.07,2.72])ne.box(0,y,.66,2.56,.06,1.06,'wood');
  for(const u of [-.42,.42])ne.box(u,1.42,.66,.045,2.56,1.01,'wood');
  ne.block(0,.66,2.57,1.085,2.75);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
   if((row+col)%3===1)continue;const u=(col-1)*.82,y=.83+row*.65;
   for(let j=0;j<3;j++)ne.box(u-.18+j*.12,y+.16,.67,.084,.31-j*.022,.29,j===1?'paper':'dark');
  }
  ne.box(-.55,.67,-.7,1.08,.075,.62,'wood');
  for(const u of [-.96,-.14]){ne.box(u,.33,-.7,.075,.66,.49,'wood');ne.block(u,-.7,.075,.49,.71);}
  ne.cylinder(-.55,.764,-.7,.205,.12,'tile',.175);ne.block(-.55,-.7,1.08,.62,.825);
  return true;
 }

 if(id==='outer-silent-cinema'){
  const nw=group(-1,-1),sw=group(-1,1),ne=group(1,-1,true),se=group(1,1);
  // Screen on an intact small proscenium. Pleated red side curtains are geometric.
  nw.box(0,.09,.6,2.62,.18,1.34,'wood');nw.block(0,.6,2.62,1.34,.18);
  nw.box(0,1.94,.98,1.82,1.58,.07,'black');nw.box(0,1.94,.934,1.67,1.43,.02,'paper');
  nw.block(0,.97,1.82,.09,2.73);
  for(const u of [-1.255,1.255]){nw.box(u,1.57,.98,.105,2.91,.13,'wood');nw.block(u,.98,.105,.13,3.025);}
  nw.box(0,2.98,.98,2.62,.11,.18,'wood');
  for(const side of [-1,1])for(let i=0;i<4;i++)nw.box(side*(.91+i*.105),1.95,.83+(i%2)*.055,.12,1.96-.04*(i%3),.09,'red');
  for(const side of [-1,1])nw.block(side*1.0675,.8575,.435,.145,2.93);
  for(let i=0;i<9;i++)nw.box(-1.16+i*.29,2.855,.84,.3,.22+(i%2)*.035,.095,'red');
  nw.box(0,2.75,.42,.36,.14,.18,'washiLit');nw.box(0,2.83,.42,.4,.025,.23,'wood');nw.fixture(0,2.75,.42,'#aa957a');
  const seat=(g:Group,u:number,v:number)=>{
   g.box(u,.43,v,.52,.095,.52,'dark');g.box(u,.8,v+.216,.5,.57,.11,'red');
   g.box(u,.477,v-.025,.455,.034,.41,'red');
   for(const x of [-.23,.23]){
    g.box(u+x,.225,v+.13,.05,.45,.065,'steel');g.box(u+x,.06,v,.075,.12,.58,'steel');
    g.box(u+x,.595,v-.005,.065,.055,.48,'wood');g.box(u+x,.47,v+.11,.035,.25,.045,'steel');
   }
   g.block(u,v,.535,.58,1.085);
  };
  for(const g of [sw,ne])for(const v of [-.73,.58])for(const u of [-.87,0,.87])seat(g,u,v);
  // A mechanical projector with two vertical, stepped-octagonal film reels.
  se.box(0,.95,.23,1.28,.1,.93,'wood');
  for(const u of [-.49,.49])for(const v of [-.12,.56])se.box(u,.47,v,.075,.94,.075,'wood');
  se.box(0,1.31,.28,.77,.59,.55,'rust');se.box(0,1.33,-.095,.255,.25,.28,'black');
  se.box(0,1.33,-.26,.2,.195,.055,'steel');se.box(0,1.33,-.292,.134,.133,.014,'black');
  for(const u of [-.33,.33]){
   for(let i=0;i<5;i++)se.box(u,1.9+(i-2)*.087,.24,[.28,.44,.53,.44,.28][i],.09,.065,'steel');
   se.box(u,1.9,.197,.075,.075,.026,'gold');
   se.box(u,1.665,.24,.045,.25,.04,'dark');
   for(const dx of [-.13,.13])se.box(u+dx,1.9,.199,.05,.12,.018,'black');
  }
  se.block(0,.23,1.28,.93,2.12);
  se.block(0,-.1285,.255,.341,1.455);
  for(let i=0;i<4;i++)se.cylinder(-.81,.065+i*.093,-.85,.25,.085,i%2?'steel':'rust');
  se.block(-.81,-.85,.5,.5,.39);
  se.box(.77,.445,-.82,.67,.89,.69,'wood');se.block(.77,-.82,.67,.69,.89);
  for(const y of [.25,.54,.81]){se.box(.77,y,-1.18,.59,.205,.025,'dark');se.box(.77,y,-1.198,.13,.028,.02,'gold');}
  return true;
 }

 if(id==='outer-last-festival'){
  const stall=(g:Group,accent:OuterMemoryMat,closed=true)=>{
   for(const u of [-1.22,1.22]){
    g.box(u,1.445,.5,.095,2.89,.105,'wood');g.block(u,.5,.095,.105,2.89);
    g.box(u,.99,-.8,.075,1.98,.075,'wood');g.block(u,-.8,.075,.075,1.98);
   }
   g.box(0,.395,.54,2.48,.79,.85,'planks');g.block(0,.54,2.48,.85,.79);
   g.box(0,.87,-.38,2.6,.085,1.19,'wood');g.block(0,-.38,2.6,1.19,.913);
   g.box(0,2.86,.3,2.66,.105,1.65,'wood');
   for(let i=0;i<6;i++)g.box(0,2.932+i*.012,.96-i*.28,2.7,.045,.26,'planks');
   g.box(0,2.62,-.57,2.58,.36,.035,accent);
   for(let i=0;i<6;i++)g.box(-1.075+i*.43,2.42,-.57,.027,.18,.036,'dark');
   // Closed wooden shutters, with visible board gaps and a bottom lock rail.
   const rows=closed?11:6;
   for(let i=0;i<rows;i++)g.box(0,2.33-i*.125,.48,2.33,.109,.06,'planks');
   g.box(0,2.33-(rows-1)*.125-.083,.45,2.4,.07,.095,'wood');
   g.block(0,.45625,2.4,.1075,2.39);
   if(closed)g.box(.06,1.03,.405,.11,.1,.04,'rust');
   for(const u of [-1.17,1.17])g.box(u,1.64,.46,.07,1.47,.11,'dark');
   // Lantern suspension stays within each stall; nothing spans a doorway.
   g.box(0,3.02,-.95,2.6,.018,.018,'rope');
   for(const u of [-.86,0,.86])lantern(g,u,-.95,2.71,u===0);
  };
  const nw=group(-1,-1),ne=group(1,-1),sw=group(-1,1),se=group(1,1);
  stall(nw,'candyRed');stall(ne,'candyYellow');stall(sw,'candyBlue',false);stall(se,'paper');
  // Empty sweet trays beneath a closed shutter.
  for(const u of [-.67,0,.67]){nw.box(u,.937,-.45,.5,.04,.43,'dark');nw.box(u,.963,-.45,.4,.016,.33,'paper');}
  nw.fixture(0,2.62,-.98,'#cba06c');
  // A dark iron griddle, cooling tools and two unmarked storage boxes.
  ne.box(0,.946,-.46,1.88,.055,.61,'black');
  for(const u of [-.62,-.21,.21,.62])ne.cylinder(u,.978,-.46,.12,.009,'rust');
  ne.box(.93,1.001,-.6,.04,.035,.42,'wood');ne.box(.93,1.026,-.83,.14,.025,.17,'steel');
  // Shallow goldfish trough with a water surface, rim and a few muted tokens.
  sw.box(0,.945,-.4,1.95,.085,.66,'dark');sw.box(0,.994,-.4,1.75,.012,.48,'water');
  for(const u of [-.945,.945])sw.box(u,1.01,-.4,.055,.095,.69,'wood');
  for(const v of [-.72,-.08])sw.box(0,1.01,v,1.94,.095,.045,'wood');
  for(const [u,v,m] of [[-.52,-.43,'candyRed'],[.12,-.31,'candyYellow'],[.59,-.49,'paper']] as const){sw.box(u,1.009,v,.13,.016,.045,m);sw.box(u+.071,1.009,v,.04,.014,.073,m);}
  sw.fixture(0,2.62,-.98,'#b9a077');
  // Festival drum, tied barrel and short mallets stored on the closed counter.
  se.cylinder(0,1.23,-.35,.36,.54,'wood',.39);se.cylinder(0,1.235,-.35,.398,.33,'dark');
  for(const y of [.953,1.505])se.cylinder(0,y,-.35,.385,.035,'paper');
  se.block(0,-.35,.796,.796,1.5225);
  for(let i=0;i<10;i++){const a=i*Math.PI/5;se.box(Math.cos(a)*.37,1.23,-.35+Math.sin(a)*.37,.025,.5,.025,'rope');}
  for(const u of [-.55,.55]){se.box(u,1.009,-.43,.045,.035,.62,'wood');se.cylinder(u,1.035,-.73,.053,.05,'wood');}
  return true;
 }
 return false;
}
