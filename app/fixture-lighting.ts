import {lightBlocked} from './flash-visibility.ts';
import type {Obstacle,Position} from './movement.ts';
type Point3=Position&{y:number};
export type LightFixture={id:number;position:Point3;floor:number;color:string;shadowPosition?:Point3;power?:number};
type Slot={current:LightFixture|null;target:LightFixture|null;gain:number};
/** Stable fixture ownership: fade out before moving a pooled light to another lamp. */
export class FixtureLighting {
 readonly slots:Slot[]=Array.from({length:6},()=>({current:null,target:null,gain:0}));
 select(viewer:Point3,floor:number,fixtures:LightFixture[],walls:Obstacle[],count:number){
  const assigned=new Set(this.slots.map(s=>s.target?.id));
  const candidates=fixtures.filter(f=>Math.abs(f.floor-floor)<.7).map(f=>({fixture:f,distance:Math.hypot(f.position.x-viewer.x,f.position.y-viewer.y,f.position.z-viewer.z)})).filter(f=>f.distance<14);
  candidates.sort((a,b)=>a.distance*(assigned.has(a.fixture.id)?.8:1)-b.distance*(assigned.has(b.fixture.id)?.8:1));
  const chosen:LightFixture[]=[];for(const c of candidates.slice(0,64)){if(!lightBlocked(viewer,c.fixture.position,walls))chosen.push(c.fixture);if(chosen.length===count)break;}
  const ids=new Set(chosen.map(f=>f.id));
  this.slots.forEach((slot,i)=>{if(i>=count||slot.target&&!ids.has(slot.target.id))slot.target=null;});
  const claimed=new Set(this.slots.map(s=>s.target?.id));
  for(const fixture of chosen)if(!claimed.has(fixture.id)){const slot=this.slots.find(s=>!s.target);if(slot){slot.target=fixture;claimed.add(fixture.id);}}
 }
 step(dt:number){
  const fade=Math.min(.1,Math.max(0,dt))/ .18;
  for(const slot of this.slots){
   if(slot.current?.id!==slot.target?.id){slot.gain=Math.max(0,slot.gain-fade);if(slot.gain===0)slot.current=slot.target;}
   else slot.gain=Math.min(slot.target?1:0,slot.gain+fade);
  }
 }
}
