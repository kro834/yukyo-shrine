import type {Position} from './movement.ts';
import type {Cell} from './shrine-layout.ts';
export const RED_AREAS=['factory','bath','cistern','shop','cave','field'] as const;
export type AreaColor='blue'|'red';
export function createAreaLookup(cells:Cell[]){
 const red=new Set(cells.filter(c=>c.kind==='yokocho'||(RED_AREAS as readonly string[]).includes(c.kind)).map(c=>c.x+','+c.z));
 return (p:Position,floor=0):AreaColor=>floor>2.4?'blue':red.has(Math.round(p.x/4)+','+Math.round(p.z/4))?'red':'blue';
}
export const AREA_MULTIPLIERS={blue:{sense:.4,speed:.4,search:.4},red:{sense:1.65,speed:1.3,search:1.6}};
