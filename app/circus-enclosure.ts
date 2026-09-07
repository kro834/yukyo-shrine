/** Pure height policy shared by circus rendering, collision and flash visibility.
 * Invoke only for stage === 'circus', immediately after encloseLayout.
 * Keep every footprint/door/room/grid connection unchanged.
 */
type CircusWall={x:number;z:number;h:number;insideX:number;insideZ:number;twoSided?:boolean};
type CircusRoom={x1:number;x2:number;z1:number;z2:number};
export function circusWallHeight(w:CircusWall,rooms:readonly CircusRoom[]):number{
 if(Math.abs(w.x)>34.001||Math.abs(w.z)>34.001)return w.h;
 // The enclosing eave stays six metres tall; only inner dividers become screens.
 if(!w.twoSided&&Math.max(Math.abs(w.x),Math.abs(w.z))>=33.9)return 6.15;
 if(w.twoSided)return w.h;
 // Outer room edges also have twoSided=false: inspect the occupied-side cell.
 const cellX=Math.round((w.x+w.insideX)/4),cellZ=Math.round((w.z+w.insideZ)/4);
 if(rooms.some(r=>cellX>=r.x1&&cellX<=r.x2&&cellZ>=r.z1&&cellZ<=r.z2))return w.h;
 return Math.min(w.h,2.45);
}
