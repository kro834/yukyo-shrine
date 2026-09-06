export type Preferences={stickSensitivity:number;touchSensitivity:number;mouseSensitivity:number;fov:number;brightness:number;quality:'low'|'medium'|'high';invertY:boolean;motion:boolean};
export const DEFAULTS:Preferences={stickSensitivity:1,touchSensitivity:1,mouseSensitivity:1,fov:70,brightness:1.15,quality:'medium',invertY:false,motion:false};
export function sanitizePreferences(input:unknown):Preferences {
  const v=input&&typeof input==='object'?input as Record<string,unknown>:{};
  const number=(key:keyof Preferences,min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key] as number)):DEFAULTS[key] as number;
  return {stickSensitivity:number('stickSensitivity',.25,3),touchSensitivity:number('touchSensitivity',.25,3),mouseSensitivity:number('mouseSensitivity',.25,3),fov:number('fov',55,95),brightness:number('brightness',.7,1.8),quality:['low','medium','high'].includes(v.quality as string)?v.quality as Preferences['quality']:'medium',invertY:typeof v.invertY==='boolean'?v.invertY:false,motion:typeof v.motion==='boolean'?v.motion:false};
}
