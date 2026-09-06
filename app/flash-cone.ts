import type {Position} from './movement.ts';
export function inFlashCone(origin:Position&{y?:number},target:Position&{y?:number},yaw:number,pitch=0){
 const dx=target.x-origin.x,dy=(target.y??0)-(origin.y??0),dz=target.z-origin.z,length=Math.hypot(dx,dy,dz);
 if(length<1e-6)return true;
 const dot=(-Math.sin(yaw)*Math.cos(pitch)*dx+Math.sin(pitch)*dy-Math.cos(yaw)*Math.cos(pitch)*dz)/length;
 return dot>=.5-1e-9;
}
