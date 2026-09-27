export type GraphicsQuality='low'|'medium'|'high'|'ultra';
export const QUALITY_LABELS={low:'低',medium:'標準',high:'高画質',ultra:'最高画質'} as const;
export type Preferences={stickSensitivity:number;touchSensitivity:number;mouseSensitivity:number;fov:number;brightness:number;quality:GraphicsQuality;invertY:boolean;motion:boolean;stamina:boolean;masterVolume:number;ambienceVolume:number;effectsVolume:number;grain:boolean};
export const DEFAULTS:Preferences={stickSensitivity:1,touchSensitivity:1,mouseSensitivity:1,fov:70,brightness:1.15,quality:'high',invertY:false,motion:false,stamina:false,masterVolume:.8,ambienceVolume:.7,effectsVolume:.85,grain:true};
export function sanitizePreferences(input:unknown):Preferences {
  const v=input&&typeof input==='object'?input as Record<string,unknown>:{};
  const number=(key:keyof Preferences,min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key] as number)):DEFAULTS[key] as number;
  return {stickSensitivity:number('stickSensitivity',.25,3),touchSensitivity:number('touchSensitivity',.25,3),mouseSensitivity:number('mouseSensitivity',.25,3),fov:number('fov',55,95),brightness:number('brightness',.7,1.8),quality:['low','medium','high','ultra'].includes(v.quality as string)?v.quality as Preferences['quality']:DEFAULTS.quality,invertY:typeof v.invertY==='boolean'?v.invertY:false,motion:typeof v.motion==='boolean'?v.motion:false,stamina:typeof v.stamina==='boolean'?v.stamina:false,masterVolume:number('masterVolume',0,1),ambienceVolume:number('ambienceVolume',0,1),effectsVolume:number('effectsVolume',0,1),grain:typeof v.grain==='boolean'?v.grain:DEFAULTS.grain};
}
/** Mobile always boots with the inexpensive material path; users can raise it in settings. */
export function startupPreferences(input:unknown,mobile:boolean):Preferences {
 const prefs=sanitizePreferences(input);
 return {...prefs,quality:mobile?'low':prefs.quality};
}
