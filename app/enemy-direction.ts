export function enemyDirection(player:{x:number;z:number},enemy:{x:number;z:number},yaw:number){
  const dx=enemy.x-player.x,dz=enemy.z-player.z;
  const angle=Math.atan2(Math.sin(Math.atan2(dx,-dz)+yaw),Math.cos(Math.atan2(dx,-dz)+yaw));
  return {angle,distance:Math.hypot(dx,dz)};
}

export function enemyFloorHint(playerFloor:number,enemyFloor:number):'above'|'below'|'same'{return enemyFloor-playerFloor>2?'above':playerFloor-enemyFloor>2?'below':'same';}
