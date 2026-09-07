type Material='dark'|'wood'|'paper'|'steel'|'rust'|'plaster'|'red'|'rope'|'washiLit'|'light';
type Box=(x:number,y:number,z:number,w:number,h:number,d:number,m:Material)=>void;
/** All lower details remain behind the solid wall plane; only the high eave projects into the alley. */
export function buildYokochoFront(box:Box,x:number,z:number,alongX:boolean,nx:number,nz:number,variant:number){
 const p=(t:number,y:number,d:number,w:number,h:number,depth:number,m:Material)=>box(x+(alongX?t:0)+nx*d,y,z+(alongX?0:t)+nz*d,alongX?w:depth,h,alongX?depth:w,m);
 const v=variant%6;
 p(0,1.75,-.44,4,3.5,.4,'dark');p(0,.34,-.08,4,.68,.14,'wood');
 p(0,2.7,-.07,4,.55,.12,v===4?'plaster':'wood');
 p(0,1.54,-.17,3.62,1.73,.035,v===3?'steel':v===4?'plaster':v===1?'washiLit':'paper');
 for(const t of [-1.9,1.9])p(t,1.7,-.07,.18,3.4,.14,'wood');
 for(const y of [.67,2.43])p(0,y,-.04,3.8,.09,.08,'dark');
 if(v===3){for(let j=0;j<7;j++)p(0,.79+j*.24,-.03,3.55,.025,.05,'rust');}
 else if(v!==4){
   for(const t of [-1.28,-.64,0,.64,1.28])p(t,1.55,-.035,.055,1.74,.07,'wood');
   p(0,1.55,-.025,3.6,.065,.05,'wood');
   p(.28,1.18,-.014,.035,.22,.026,'rust');
 }
 // Shallow, layered eaves cast a soft shadow across the entry.
 p(0,3.02,.12,3.9,.10,.42,'dark');p(0,3.09,.04,4,.06,.58,'wood');
 if(v<3){for(let i=0;i<4;i++)p((i-1.5)*.78,2.68+(i%2)*.025,.23,.745,.48,.025,v===0?'red':v===1?'rope':'paper');}
 if(v===4){p(-1.45,1.88,-.012,.25,.36,.025,'rust');p(-1.45,1.88,-.004,.18,.23,.005,'paper');}
}
