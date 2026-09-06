import {STAIRS,UPPER_HEIGHT} from './annex.ts';
import type {Obstacle} from './movement.ts';
/** The same solid treads rendered by the world, used only for light rays. */
export const STAIR_LIGHT_VOLUMES:Obstacle[]=STAIRS.flatMap(s=>Array.from({length:24},(_,i)=>({
 minX:s.minX,maxX:s.maxX,minZ:s.minZ+i*(s.maxZ-s.minZ)/24,maxZ:s.minZ+(i+1)*(s.maxZ-s.minZ)/24,
 minY:0,maxY:(i+1)*UPPER_HEIGHT/24,
})));
