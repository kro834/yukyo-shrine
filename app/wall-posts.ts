import type {Wall} from './shrine-layout.ts';

/** A shared timber joint belongs to the building, not to each adjoining bay.
 * Keep it on the wall centre line so perpendicular faces meet without overlap. */
export function createWallPostCollector(){
 const posts=new Map<string,{x:number;z:number;h:number}>();
 return {
  add(w:Pick<Wall,'x'|'z'|'alongX'|'h'>){
   for(const sign of [-1,1]){
    const x=w.x+(w.alongX?sign*2:0),z=w.z+(w.alongX?0:sign*2),key=x+','+z;
    const old=posts.get(key);
    if(!old||old.h<w.h)posts.set(key,{x,z,h:w.h});
   }
  },
  values:()=>[...posts.values()],
 };
}
