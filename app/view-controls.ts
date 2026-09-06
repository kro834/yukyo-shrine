import type {Preferences} from './preferences.ts';
export type RangeKey='stickSensitivity'|'touchSensitivity'|'mouseSensitivity'|'fov'|'brightness';
export const RANGE_LIMITS:Record<RangeKey,{min:number;max:number;step:number}>={
  stickSensitivity:{min:.25,max:3,step:.25},touchSensitivity:{min:.25,max:3,step:.25},mouseSensitivity:{min:.25,max:3,step:.25},fov:{min:55,max:95,step:1},brightness:{min:.7,max:1.8,step:.05},
};
export function adjustRange(p:Preferences,key:RangeKey,direction:number):Preferences {
  const r=RANGE_LIMITS[key];
  return {...p,[key]:Math.round(Math.max(r.min,Math.min(r.max,p[key]+direction*r.step))*100)/100};
}
export function viewDelta(source:'gamepad'|'touch'|'mouse',x:number,y:number,dt:number,p:Preferences){
  const scale=source==='gamepad'?p.stickSensitivity:source==='touch'?p.touchSensitivity:p.mouseSensitivity;
  const unit=source==='gamepad'?Math.max(0,Math.min(dt,.15)):1;
  const horizontal=source==='gamepad'?1.65:source==='touch'?.003:.002;
  const vertical=source==='gamepad'?1.3:horizontal;
  return {yaw:-x*unit*horizontal*scale,pitch:-y*unit*vertical*scale*(p.invertY?-1:1)};
}
export const hidePlayCursor=(settingsOpen:boolean)=>!settingsOpen;
