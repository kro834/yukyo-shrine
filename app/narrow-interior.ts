type Material='dark'|'wood'|'paper'|'plaster'|'red';
type Box=(x:number,y:number,z:number,w:number,h:number,d:number,m:Material)=>void;
export const NARROW_CEILING=3;
export const NARROW_LAMP={y:2.70,r:.14,h:.34};
/** Lower joinery stays behind the same 1.36 m plane as the navigation walls. */
export function buildNarrowInterior(box:Box,x:number,z:number,alongX:boolean,variant:number){
 const p=(t:number,y:number,u:number,w:number,h:number,d:number,m:Material)=>box(x+(alongX?t:u),y,z+(alongX?u:t),alongX?w:d,h,alongX?d:w,m);
 for(const sign of [-1,1]){
  const screen=(variant+(sign===1?2:0))%4===0;
  const front=(t:number,y:number,u:number,w:number,h:number,d:number,m:Material)=>p(t,y,sign*u,w,h,d,m);
  front(0,1.5,1.74,4,3,.52,'dark');
  // Recessed infill and individually laid waist boards show the wall's construction.
  front(0,1.70,1.46,3.78,1.9,.045,screen?'paper':'plaster');
  front(0,2.79,1.46,3.78,.30,.045,'plaster');
  for(let i=0;i<12;i++)front(-1.815+i*.33,.37,1.44,.319,.68,.05,'wood');
  for(const t of [-1.91,0,1.91])front(t,1.5,1.405,.18,3,.09,'wood');
  for(const y of [.075,.745,2.655,2.93])front(0,y,1.405,3.82,y===.075?.15:.095,.09,'wood');
  if(screen){
   for(let i=-5;i<=5;i++)if(i!==0)front(i*.318,1.70,1.41,.022,1.81,.038,'wood');
   for(const y of [1.05,1.45,1.85,2.25])front(0,y,1.412,3.65,.026,.04,'wood');
  }else{
   // An offset joint keeps neighbouring plaster bays from reading as one flat sheet.
   front(variant%2?.96:-.96,1.70,1.425,.045,1.81,.04,'wood');
  }
  // Cover terminal faces at intersections without protruding past the collision box.
  for(const t of [-1.985,1.985])front(t,1.5,1.68,.03,3,.64,'wood');
 }
 p(0,3.04,0,4,.08,4,'dark');
 for(const u of [-.98,0,.98])p(0,2.982,u,4,.036,.048,'wood');
 // Beam bottoms remain above 2.84 m, including where two modules meet.
 for(const t of [-1.95,1.95])p(t,2.92,0,.10,.16,2.72,'wood');
}
