import {STAIRS,UPPER_HEIGHT} from './annex.ts';
import {HIGH_STAIRS} from './vertical-layout.ts';
import type {Obstacle} from './movement.ts';
/** The same solid treads rendered by the world, used only for light rays. */
export const STAIR_LIGHT_VOLUMES:Obstacle[]= [...STAIRS.map(s=>({...s,base:0})),...HIGH_STAIRS.map(s=>({...s,base:4.8}))].flatMap(s=>Array.from({length:24},(_,i)=>({
 minX:s.minX,maxX:s.maxX,minZ:s.minZ+i*(s.maxZ-s.minZ)/24,maxZ:s.minZ+(i+1)*(s.maxZ-s.minZ)/24,
 minY:s.base,maxY:s.base+(i+1)*UPPER_HEIGHT/24,
})));
